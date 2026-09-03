/**
 * Withings OAuth2 (Public API) + measure `getmeas` for body composition.
 * @see https://developer.withings.com/
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { CONFIG } from '../config/env';
import {
  buildDaysFromSessions,
  lastNLocalDayKeysOldestFirst,
  localDayKeyFromMs,
  MAX_TREND_PERIOD_DAYS,
  resolveCompositionPeriodAnchor,
  type BodyCompositionTrendPayload,
  type CompositionSession,
  type MetabolicTrend7dDay,
} from '../logic/metabolicTrend7d';
import { fetchWithTimeout } from './fetchWithTimeout';
import { authFetch } from './AuthApiService';
import {
  METRICS_DEEP_LOOKBACK_DAYS,
  METRICS_SHALLOW_LOOKBACK_DAYS,
} from './metricsSyncLookback';

const WITHINGS_FETCH_TIMEOUT_MS = 12_000;

async function withingsFetch(url: string, init: RequestInit): Promise<Response> {
  return fetchWithTimeout(url, init, WITHINGS_FETCH_TIMEOUT_MS);
}
const WITHINGS_AUTHORIZE_URL = 'https://account.withings.com/oauth2_user/authorize2';
const WITHINGS_MEASURE_URL = 'https://wbsapi.withings.net/measure';

/** Android SecureStore keys may only use [a-zA-Z0-9._-] — no colons. */
const SECURE_TOKEN_KEY = 'healthings_withings_tokens';
const WEB_TOKEN_FALLBACK_KEY = 'healthings_withings_tokens_web';

/** Default scope — includes activity so getintradayactivity (watch HR) works. */
export const DEFAULT_WITHINGS_SCOPE = 'user.metrics,user.activity';

/** Withings measure `type` ids we surface on the dashboard. */
export const WITHINGS_MEASURE_TYPES = {
  WEIGHT_KG: 1,
  FAT_MASS_KG: 8,
  MUSCLE_MASS_KG: 76,
  /** Visceral fat index (Body Scan). Type 88 is bone mass (kg) — not visceral. */
  VISCERAL_FAT_INDEX: 170,
  /** Basal metabolic rate (kcal/day). */
  BMR_KCAL_DAY: 226,
  /** Heart rate (bpm). Spot readings from scale/watch/BPM cuff (not continuous). */
  HEART_RATE_BPM: 11,
} as const;

const DASHBOARD_TYPE_LIST = [
  WITHINGS_MEASURE_TYPES.WEIGHT_KG,
  WITHINGS_MEASURE_TYPES.FAT_MASS_KG,
  WITHINGS_MEASURE_TYPES.MUSCLE_MASS_KG,
  WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX,
  WITHINGS_MEASURE_TYPES.BMR_KCAL_DAY,
] as const;

const TREND_MEASURE_TYPES = [
  WITHINGS_MEASURE_TYPES.WEIGHT_KG,
  WITHINGS_MEASURE_TYPES.FAT_MASS_KG,
  WITHINGS_MEASURE_TYPES.MUSCLE_MASS_KG,
  WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX,
  WITHINGS_MEASURE_TYPES.BMR_KCAL_DAY,
] as const;

/** Latest body-composition snapshot for HealthDashboard-style UIs. */
export type WeightMetricsForDashboard = {
  measuredAt: string | null;
  weightKg: number | null;
  fatMassKg: number | null;
  muscleMassKg: number | null;
  visceralFatIndex: number | null;
  bmrKcalDay: number | null;
};

/** @deprecated Prefer `WeightMetricsForDashboard` — same shape, legacy name from body-scan mock. */
export type BodyScanMetrics = WeightMetricsForDashboard;

export type WithingsOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userid?: string;
  scope?: string;
  tokenType?: string;
};

type WithingsMeasure = {
  value: number;
  type: number;
  unit: number;
};

type WithingsMeasureGrp = {
  grpid?: number;
  date: number;
  measures?: WithingsMeasure[];
};

type WithingsGetMeasBody = {
  measuregrps?: WithingsMeasureGrp[];
};

type WithingsGetMeasJson = {
  status: number;
  body?: WithingsGetMeasBody;
  error?: string;
};

function assertWithingsClientId(): string {
  const clientId = CONFIG.withingsClientId.trim();
  if (!clientId) {
    throw new Error(
      'Withings is not available in this build (client id missing). ' +
        'Developers: set WITHINGS_CLIENT_ID in app/.env (EAS: Environment variables) and rebuild.',
    );
  }
  return clientId;
}

/** `redirect_uri` for authorize + token exchange — always `CONFIG.withingsCallbackUrl` from `.env` `WITHINGS_CALLBACK_URL` (never Expo `exp://`). */
function withingsOAuthRedirectUri(): string {
  return CONFIG.withingsCallbackUrl.trim();
}

async function postRequestToken(
  grant:
    | { grantType: 'authorization_code'; code: string }
    | { grantType: 'refresh_token'; refreshToken: string },
  previousUserid?: string,
): Promise<WithingsOAuthTokens> {
  const res = await authFetch(
    '/v1/withings/oauth/token',
    {
      method: 'POST',
      body: JSON.stringify(
        grant.grantType === 'authorization_code'
          ? { grantType: 'authorization_code', code: grant.code }
          : { grantType: 'refresh_token', refreshToken: grant.refreshToken },
      ),
    },
    { timeoutMs: 20_000 },
  );
  if (res.status === 401) {
    throw new Error('Session expired — sign in again, then re-link Withings.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Withings token request failed (${res.status})`);
  }
  const tokens = (await res.json()) as WithingsOAuthTokens;
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error('Withings token request failed: empty response');
  }
  if (!tokens.userid && previousUserid) {
    return { ...tokens, userid: previousUserid };
  }
  return tokens;
}

/**
 * Builds the URL for `GET https://account.withings.com/oauth2_user/authorize2?...`
 * including `redirect_uri` from `WITHINGS_CALLBACK_URL` / `CONFIG.withingsCallbackUrl` (must match Withings portal; not `exp://`).
 */
export function buildAuthorizationUrl(state: string, scope: string = DEFAULT_WITHINGS_SCOPE): string {
  const clientId = assertWithingsClientId();
  const redirectUri = withingsOAuthRedirectUri();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    state,
    scope,
    redirect_uri: redirectUri,
  });
  return `${WITHINGS_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchanges the authorization `code` for tokens via
 * `POST https://wbsapi.withings.net/v2/oauth2` with `action=requesttoken` (same `redirect_uri` as authorize).
 */
export async function exchangeCodeForTokens(code: string): Promise<WithingsOAuthTokens> {
  return postRequestToken({
    grantType: 'authorization_code',
    code: code.trim(),
  });
}

/**
 * Refreshes the access token using a refresh token (does not persist).
 */
export async function refreshAccessToken(refreshToken: string): Promise<WithingsOAuthTokens> {
  const stored = await loadWithingsTokens();
  const previousUserid =
    stored && stored.refreshToken.trim() === refreshToken.trim() ? stored.userid : undefined;
  return postRequestToken(
    {
      grantType: 'refresh_token',
      refreshToken: refreshToken.trim(),
    },
    previousUserid,
  );
}

/** Parses `code` and optional `state` from the OAuth redirect URL. */
export function parseOAuthRedirectUrl(redirectUrl: string): { code: string; state: string | null } {
  let url: URL;
  try {
    url = new URL(redirectUrl);
  } catch {
    throw new Error('Invalid OAuth redirect URL.');
  }
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error('Redirect URL is missing the "code" query parameter.');
  }
  const state = url.searchParams.get('state');
  return { code, state };
}

/**
 * Full callback handler: parse redirect URL → exchange code → persist tokens.
 * Pass the full redirect URL returned to your app (e.g. from `WebBrowser.openAuthSessionAsync`).
 */
export async function handleOAuthCallback(redirectUrl: string): Promise<WithingsOAuthTokens> {
  const { code } = parseOAuthRedirectUrl(redirectUrl);
  const tokens = await exchangeCodeForTokens(code);
  await saveWithingsTokens(tokens);
  return tokens;
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

function tokenStorageKey(): string {
  return Platform.OS === 'web' ? WEB_TOKEN_FALLBACK_KEY : SECURE_TOKEN_KEY;
}

/** Persists tokens (SecureStore on iOS/Android; AsyncStorage on web). */
export async function saveWithingsTokens(tokens: WithingsOAuthTokens): Promise<void> {
  const payload = JSON.stringify(tokens);
  await secureSet(tokenStorageKey(), payload);
}

export async function loadWithingsTokens(): Promise<WithingsOAuthTokens | null> {
  const raw = await secureGet(tokenStorageKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WithingsOAuthTokens;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearWithingsTokens(): Promise<void> {
  await secureDelete(tokenStorageKey());
}

function isAccessTokenExpired(tokens: WithingsOAuthTokens, skewMs: number = 60_000): boolean {
  const t = Date.parse(tokens.expiresAt);
  if (Number.isNaN(t)) return true;
  return Date.now() + skewMs >= t;
}

/**
 * Returns a valid access token, refreshing with the stored refresh token when needed.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await loadWithingsTokens();
  if (!tokens) return null;
  if (!isAccessTokenExpired(tokens)) {
    return tokens.accessToken;
  }
  try {
    const next = await refreshAccessToken(tokens.refreshToken);
    await saveWithingsTokens(next);
    return next.accessToken;
  } catch {
    return null;
  }
}

/** Withings encodes numeric values as `value * 10^unit`. */
export function decodeWithingsMeasureValue(value: number, unit: number): number {
  return value * Math.pow(10, unit);
}

function emptyDashboardMetrics(): WeightMetricsForDashboard {
  return {
    measuredAt: null,
    weightKg: null,
    fatMassKg: null,
    muscleMassKg: null,
    visceralFatIndex: null,
    bmrKcalDay: null,
  };
}

function pickLatestVisceralFromGroups(
  groups: WithingsMeasureGrp[]
): { value: number; unit: number; date: number } | null {
  const sorted = [...groups].filter((g) => g && typeof g.date === 'number').sort((a, b) => b.date - a.date);
  const typeId = WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX;
  for (const grp of sorted) {
    const hit = grp.measures?.find((m) => m.type === typeId);
    if (hit && typeof hit.value === 'number' && typeof hit.unit === 'number') {
      return { value: hit.value, unit: hit.unit, date: grp.date };
    }
  }
  return null;
}

/**
 * Picks the newest measurement per `type` by scanning `measuregrps` newest-first.
 */
function pickLatestMeasuresByType(groups: WithingsMeasureGrp[]): Map<number, { value: number; unit: number; date: number }> {
  const sorted = [...groups].filter((g) => g && typeof g.date === 'number').sort((a, b) => b.date - a.date);
  const out = new Map<number, { value: number; unit: number; date: number }>();
  for (const typeId of DASHBOARD_TYPE_LIST) {
    if (typeId === WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX) continue;
    for (const grp of sorted) {
      const hit = grp.measures?.find((m) => m.type === typeId);
      if (hit && typeof hit.value === 'number' && typeof hit.unit === 'number') {
        out.set(typeId, { value: hit.value, unit: hit.unit, date: grp.date });
        break;
      }
    }
  }
  const visceral = pickLatestVisceralFromGroups(groups);
  if (visceral) {
    out.set(WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX, visceral);
  }
  return out;
}

function mapPickedToDashboard(
  picked: Map<number, { value: number; unit: number; date: number }>
): WeightMetricsForDashboard {
  if (picked.size === 0) return emptyDashboardMetrics();

  const dates = [...picked.values()].map((v) => v.date);
  const measuredAt = new Date(Math.max(...dates) * 1000).toISOString();

  const get = (typeId: number): number | null => {
    const row = picked.get(typeId);
    if (!row) return null;
    return decodeWithingsMeasureValue(row.value, row.unit);
  };

  return {
    measuredAt,
    weightKg: get(WITHINGS_MEASURE_TYPES.WEIGHT_KG),
    fatMassKg: get(WITHINGS_MEASURE_TYPES.FAT_MASS_KG),
    muscleMassKg: get(WITHINGS_MEASURE_TYPES.MUSCLE_MASS_KG),
    visceralFatIndex: get(WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX),
    bmrKcalDay: get(WITHINGS_MEASURE_TYPES.BMR_KCAL_DAY),
  };
}

/** Dev/offline sample aligned with `WeightMetricsForDashboard`. */
export function getMockWeightMetricsForDashboard(): WeightMetricsForDashboard {
  return {
    measuredAt: new Date().toISOString(),
    weightKg: 78.4,
    fatMassKg: 17.9,
    muscleMassKg: 56.2,
    visceralFatIndex: 4.1,
    bmrKcalDay: 1842,
  };
}

/**
 * Fetches the latest weight / composition metrics from Withings (`getmeas`).
 * Returns offline mock data only when there is no valid session (not linked yet or refresh failed).
 */
/** Default full-year lookback (deep / first fill). Shallow sync should pass ~14d. */
export const WITHINGS_WEIGHT_DEEP_LOOKBACK_DAYS = 365;
export const WITHINGS_WEIGHT_SHALLOW_LOOKBACK_DAYS = 14;

export async function fetchWeightMetrics(
  lookbackDays: number = WITHINGS_WEIGHT_DEEP_LOOKBACK_DAYS,
): Promise<WeightMetricsForDashboard> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return getMockWeightMetricsForDashboard();
  }

  const stored = await loadWithingsTokens();
  const end = Math.floor(Date.now() / 1000);
  const days = Math.max(1, Math.floor(lookbackDays));
  const start = end - days * 24 * 3600;

  const form = new URLSearchParams({
    action: 'getmeas',
    access_token: accessToken,
    category: '1',
    startdate: String(start),
    enddate: String(end),
    meastypes: DASHBOARD_TYPE_LIST.join(','),
  });
  if (stored?.userid) {
    form.set('userid', stored.userid);
  }

  const res = await withingsFetch(WITHINGS_MEASURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const json = (await res.json()) as WithingsGetMeasJson;
  if (json.status !== 0) {
    const detail = json.error ?? res.statusText;
    throw new Error(`Withings getmeas failed (status ${json.status}): ${detail}`);
  }

  const groups = json.body?.measuregrps ?? [];
  const picked = pickLatestMeasuresByType(groups);
  return mapPickedToDashboard(picked);
}

export async function fetchWithingsData(): Promise<WeightMetricsForDashboard> {
  return fetchWeightMetrics();
}

/** Read composition fields from a single `measuregrp` (one scale session — do not mix groups). */
function measuresFromSingleGroup(
  grp: WithingsMeasureGrp
): Pick<MetabolicTrend7dDay, 'weightKg' | 'fatMassKg' | 'muscleMassKg' | 'visceralFatIndex'> {
  let weightKg: number | null = null;
  let fatMassKg: number | null = null;
  let muscleMassKg: number | null = null;
  let visceralFatIndex: number | null = null;
  for (const m of grp.measures ?? []) {
    if (typeof m.value !== 'number' || typeof m.unit !== 'number') continue;
    const v = decodeWithingsMeasureValue(m.value, m.unit);
    if (m.type === WITHINGS_MEASURE_TYPES.WEIGHT_KG) weightKg = v;
    else if (m.type === WITHINGS_MEASURE_TYPES.FAT_MASS_KG) fatMassKg = v;
    else if (m.type === WITHINGS_MEASURE_TYPES.MUSCLE_MASS_KG) muscleMassKg = v;
    else if (m.type === WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX) visceralFatIndex = v;
  }
  return { weightKg, fatMassKg, muscleMassKg, visceralFatIndex };
}

function groupMeasureTypes(g: WithingsMeasureGrp): Set<number> {
  return new Set((g.measures ?? []).map((m) => m.type));
}

function isFullBiaGroup(g: WithingsMeasureGrp): boolean {
  const types = groupMeasureTypes(g);
  return (
    types.has(WITHINGS_MEASURE_TYPES.WEIGHT_KG) &&
    types.has(WITHINGS_MEASURE_TYPES.FAT_MASS_KG) &&
    types.has(WITHINGS_MEASURE_TYPES.MUSCLE_MASS_KG)
  );
}

/** Newest weight reading per calendar day (any measuregrp — includes weight-only steps). */
function extractLatestWeightKgByDay(groups: WithingsMeasureGrp[]): Map<string, number> {
  const latest = new Map<string, { dateMs: number; kg: number }>();
  for (const g of groups) {
    if (!g || typeof g.date !== 'number') continue;
    const dateMs = g.date * 1000;
    const dayKey = localDayKeyFromMs(dateMs);
    for (const m of g.measures ?? []) {
      if (
        m.type !== WITHINGS_MEASURE_TYPES.WEIGHT_KG ||
        typeof m.value !== 'number' ||
        typeof m.unit !== 'number'
      ) {
        continue;
      }
      const kg = decodeWithingsMeasureValue(m.value, m.unit);
      const prev = latest.get(dayKey);
      if (!prev || dateMs >= prev.dateMs) latest.set(dayKey, { dateMs, kg });
    }
  }
  const out = new Map<string, number>();
  for (const [dayKey, { kg }] of latest) out.set(dayKey, kg);
  return out;
}

function mergeWeightOnlyIntoTrendDays(
  days: MetabolicTrend7dDay[],
  weightByDay: Map<string, number>
): MetabolicTrend7dDay[] {
  return days.map((d) => {
    if (d.weightKg != null && Number.isFinite(d.weightKg)) return d;
    const w = weightByDay.get(d.dayKey);
    return w != null ? { ...d, weightKg: w } : d;
  });
}

/** Newest visceral index per calendar day (any measuregrp). */
function extractLatestVisceralByDay(groups: WithingsMeasureGrp[]): Map<string, number> {
  const latest = new Map<string, { dateMs: number; index: number }>();
  for (const g of groups) {
    if (!g || typeof g.date !== 'number') continue;
    const dateMs = g.date * 1000;
    const dayKey = localDayKeyFromMs(dateMs);
    for (const m of g.measures ?? []) {
      if (
        m.type !== WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX ||
        typeof m.value !== 'number' ||
        typeof m.unit !== 'number'
      ) {
        continue;
      }
      const index = decodeWithingsMeasureValue(m.value, m.unit);
      const prev = latest.get(dayKey);
      if (!prev || dateMs >= prev.dateMs) latest.set(dayKey, { dateMs, index });
    }
  }
  const out = new Map<string, number>();
  for (const [dayKey, { index }] of latest) out.set(dayKey, index);
  return out;
}

function mergeVisceralIntoTrendDays(
  days: MetabolicTrend7dDay[],
  visceralByDay: Map<string, number>
): MetabolicTrend7dDay[] {
  return days.map((d) => {
    if (d.visceralFatIndex != null && Number.isFinite(d.visceralFatIndex)) return d;
    const v = visceralByDay.get(d.dayKey);
    return v != null ? { ...d, visceralFatIndex: v } : d;
  });
}

/** Newest BMR (kcal/day) per calendar day (any measuregrp). */
function extractLatestBmrByDay(groups: WithingsMeasureGrp[]): Map<string, number> {
  const latest = new Map<string, { dateMs: number; kcal: number }>();
  for (const g of groups) {
    if (!g || typeof g.date !== 'number') continue;
    const dateMs = g.date * 1000;
    const dayKey = localDayKeyFromMs(dateMs);
    for (const m of g.measures ?? []) {
      if (
        m.type !== WITHINGS_MEASURE_TYPES.BMR_KCAL_DAY ||
        typeof m.value !== 'number' ||
        typeof m.unit !== 'number'
      ) {
        continue;
      }
      const kcal = decodeWithingsMeasureValue(m.value, m.unit);
      const prev = latest.get(dayKey);
      if (!prev || dateMs >= prev.dateMs) latest.set(dayKey, { dateMs, kcal });
    }
  }
  const out = new Map<string, number>();
  for (const [dayKey, { kcal }] of latest) out.set(dayKey, kcal);
  return out;
}

function mergeBmrIntoTrendDays(
  days: MetabolicTrend7dDay[],
  bmrByDay: Map<string, number>
): MetabolicTrend7dDay[] {
  return days.map((d) => {
    if (d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay)) return d;
    const b = bmrByDay.get(d.dayKey);
    return b != null ? { ...d, bmrKcalDay: b } : d;
  });
}

export type WithingsActivityDay = {
  /** Active-only kcal from getactivity (legacy / display). */
  activeKcal: number;
  /** Daily distance in meters (normalized from getactivity). */
  distanceM: number | null;
  /** Daily steps from getactivity (fallback when distance missing). */
  steps: number | null;
};

/** Merge getactivity distance (+ optional active kcal) onto trend days by dayKey. */
export function mergeActivityDistanceIntoTrendDays(
  days: MetabolicTrend7dDay[],
  activityByDay: Map<string, WithingsActivityDay>,
): MetabolicTrend7dDay[] {
  if (activityByDay.size === 0) {
    return days.map((d) => ({
      ...d,
      distanceM: d.distanceM ?? null,
      steps: d.steps ?? null,
    }));
  }
  return days.map((d) => {
    const a = activityByDay.get(d.dayKey);
    if (!a) {
      return { ...d, distanceM: d.distanceM ?? null, steps: d.steps ?? null };
    }
    const nextKcal =
      d.activityKcalDay != null && Number.isFinite(d.activityKcalDay)
        ? d.activityKcalDay
        : a.activeKcal > 0
          ? a.activeKcal
          : d.activityKcalDay;
    return {
      ...d,
      activityKcalDay: nextKcal ?? null,
      distanceM: a.distanceM != null ? a.distanceM : (d.distanceM ?? null),
      steps: a.steps != null ? a.steps : (d.steps ?? null),
    };
  });
}

function mergeActivityIntoTrendDays(
  days: MetabolicTrend7dDay[],
  activityByDay: Map<string, WithingsActivityDay>
): MetabolicTrend7dDay[] {
  return mergeActivityDistanceIntoTrendDays(days, activityByDay);
}

type WithingsGetActivityJson = {
  status: number;
  body?: { activities?: Array<Record<string, unknown>> };
  error?: string;
};

/**
 * Normalize Withings getactivity distance to meters.
 * Docs say meters; some responses look like kilometers (e.g. 8.8 for an 8.8 km day).
 * Use steps to disambiguate small values.
 */
export function normalizeWithingsDistanceToMeters(
  raw: number,
  steps?: number | null,
): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  // Clearly meters (100 m+ for any real day walk).
  if (raw >= 100) return raw;
  // Small number: compare to step-based estimate.
  if (steps != null && steps > 200) {
    const approxM = steps * 0.78;
    const asKm = raw * 1000;
    if (Math.abs(approxM - asKm) < Math.abs(approxM - raw)) {
      return asKm;
    }
  }
  // Default per Withings docs: meters (short days can be <100 m).
  return raw;
}

/**
 * Fetches daily active calories + distance from Withings getactivity for the given day keys.
 * One API call covers the full date range. Requires user.activity scope.
 * Distance is stored as meters (hybrid walk kcal = km × weight × 0.55).
 */
export async function fetchActivityByDay(
  dayKeys: string[],
  accessToken: string,
  userid?: string
): Promise<Map<string, WithingsActivityDay>> {
  if (dayKeys.length === 0) return new Map();

  const sorted = [...dayKeys].sort();
  // Official fields only — `active_calories` is not valid and can break the response.
  const form = new URLSearchParams({
    action: 'getactivity',
    access_token: accessToken,
    startdateymd: sorted[0],
    enddateymd: sorted[sorted.length - 1],
    data_fields: 'steps,distance,calories,totalcalories',
  });
  if (userid) form.set('userid', userid);

  try {
    const res = await withingsFetch('https://wbsapi.withings.net/v2/measure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json = (await res.json()) as WithingsGetActivityJson;

    // Always log a compact sample so release builds can verify distance (logcat).
    console.warn('[WithingsActivity] getactivity', {
      status: json.status,
      error: json.error,
      activityCount: json.body?.activities?.length ?? 0,
      sample: (json.body?.activities ?? []).slice(0, 2).map((a) => ({
        date: a.date,
        distance: a.distance,
        steps: a.steps,
        calories: a.calories,
      })),
    });

    if (json.status !== 0) return new Map();

    const out = new Map<string, WithingsActivityDay>();
    for (const act of json.body?.activities ?? []) {
      const dateYmd = String(act.date ?? '');
      if (!dateYmd) continue;
      // Withings: 'calories' = active-only burn; 'totalcalories' includes BMR
      const active = Number(act.calories ?? act.active_calories ?? 0);
      const stepsRaw = Number(act.steps ?? NaN);
      const steps = Number.isFinite(stepsRaw) && stepsRaw >= 0 ? Math.round(stepsRaw) : null;
      const hasDistance = act.distance != null && act.distance !== '';
      const rawDist = hasDistance ? Number(act.distance) : NaN;
      const distanceM =
        hasDistance && Number.isFinite(rawDist)
          ? normalizeWithingsDistanceToMeters(rawDist, steps)
          : null;
      const activeKcal = Number.isFinite(active) && active > 0 ? Math.round(active) : 0;
      out.set(dateYmd, { activeKcal, distanceM, steps });
    }

    console.warn(
      '[WithingsActivity] mapped',
      [...out.entries()].slice(-3).map(([k, v]) => [k, v]),
    );

    return out;
  } catch (err) {
    console.warn('[WithingsActivity] fetch error', err);
    return new Map();
  }
}

function extractFullBiaSessions(groups: WithingsMeasureGrp[]): CompositionSession[] {
  const sessions: CompositionSession[] = [];
  for (const g of groups) {
    if (!g || typeof g.date !== 'number' || !isFullBiaGroup(g)) continue;
    const m = measuresFromSingleGroup(g);
    if (m.weightKg == null || m.fatMassKg == null || m.muscleMassKg == null) continue;
    sessions.push({
      dateMs: g.date * 1000,
      dayKey: localDayKeyFromMs(g.date * 1000),
      weightKg: m.weightKg,
      fatMassKg: m.fatMassKg,
      muscleMassKg: m.muscleMassKg,
      visceralFatIndex: m.visceralFatIndex,
    });
  }
  return sessions.sort((a, b) => a.dateMs - b.dateMs);
}

/** Lookback covers the largest selectable window plus a buffer for the skip-first-day anchor. */
const TREND_LOOKBACK_DAYS = MAX_TREND_PERIOD_DAYS + 7;

/** Synthetic multi-day series for dev UI (slight drift so paths are visible). */
export function getMockBodyCompositionTrend7d(dayKeys: string[]): MetabolicTrend7dDay[] {
  const len = Math.max(1, dayKeys.length);
  return dayKeys.map((dayKey, i) => {
    const frac = i / Math.max(1, len - 1);
    const phase = frac * 6;
    const w = 78.1 + Math.sin(phase * Math.PI) * 0.55 + frac * 1.6;
    const bmr = Math.round(1835 + frac * 80 + Math.sin(phase * Math.PI) * 18);
    return {
      dayKey,
      weightKg: w,
      fatMassKg: Math.max(14.2, 16.1 - frac * 2.4 + Math.sin(phase * 2) * 0.15),
      muscleMassKg: Math.max(58.5, 60.2 + frac * 1.2 + Math.cos(phase * Math.PI) * 0.2),
      visceralFatIndex: Math.max(3.9, 4.2 - frac * 2 + Math.sin(phase * 2) * 0.08),
      bmrKcalDay: bmr,
      activityKcalDay: Math.round(280 + Math.sin(phase * 1.5) * 120 + Math.cos(phase * 0.8) * 60),
      distanceM: Math.round(4000 + Math.sin(phase * 1.2) * 1500),
    };
  });
}

function mockTrendPayload(dayKeys: string[]): BodyCompositionTrendPayload {
  const days = getMockBodyCompositionTrend7d(dayKeys);
  const sessions: CompositionSession[] = days
    .filter((d) => d.fatMassKg != null && d.muscleMassKg != null && d.weightKg != null)
    .map((d) => ({
      dateMs: dayKeyStartMsFromDay(d.dayKey),
      dayKey: d.dayKey,
      weightKg: d.weightKg!,
      fatMassKg: d.fatMassKg!,
      muscleMassKg: d.muscleMassKg!,
      visceralFatIndex: d.visceralFatIndex,
    }));
  const anchor = resolveCompositionPeriodAnchor(sessions, dayKeys);
  return {
    days,
    periodAnchor: anchor,
    debug: {
      sessions,
      periodStart: anchor?.start ?? null,
      periodEnd: anchor?.end ?? null,
      lookbackDays: TREND_LOOKBACK_DAYS,
    },
  };
}

function dayKeyStartMsFromDay(dayKey: string): number {
  const parts = dayKey.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  return d.getTime();
}

/** Shallow trend pull — merges into cached 128d via mergeTrendDays. */
export const WITHINGS_TREND_SHALLOW_PERIOD_DAYS = 8;

/**
 * Daily weight, fat mass, muscle mass, and visceral fat index for the last `periodDays`
 * local days (default full `MAX_TREND_PERIOD_DAYS`). Callers slice the store to 8/16/32/64/128.
 * Period deltas skip the first in-window BIA day (Withings-style) and compare 2nd day → last day.
 */
export async function fetchBodyCompositionTrend7d(
  periodDays: number = MAX_TREND_PERIOD_DAYS,
): Promise<BodyCompositionTrendPayload> {
  const n = Math.max(2, Math.min(MAX_TREND_PERIOD_DAYS, Math.floor(periodDays)));
  const dayKeys = lastNLocalDayKeysOldestFirst(n);
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return mockTrendPayload(dayKeys);
  }

  const stored = await loadWithingsTokens();
  const end = Math.floor(Date.now() / 1000);
  const apiLookbackDays = n + 7;
  const start = end - apiLookbackDays * 24 * 3600;

  const form = new URLSearchParams({
    action: 'getmeas',
    access_token: accessToken,
    category: '1',
    startdate: String(start),
    enddate: String(end),
    meastypes: TREND_MEASURE_TYPES.join(','),
  });
  if (stored?.userid) {
    form.set('userid', stored.userid);
  }

  const res = await withingsFetch(WITHINGS_MEASURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const json = (await res.json()) as WithingsGetMeasJson;
  if (json.status !== 0) {
    const detail = json.error ?? res.statusText;
    throw new Error(`Withings getmeas failed (status ${json.status}): ${detail}`);
  }

  const groups = json.body?.measuregrps ?? [];
  const sessions = extractFullBiaSessions(groups);
  const weightByDay = extractLatestWeightKgByDay(groups);
  const visceralByDay = extractLatestVisceralByDay(groups);
  const bmrByDay = extractLatestBmrByDay(groups);
  const activityByDay = await fetchActivityByDay(dayKeys, accessToken, stored?.userid);
  const days = mergeActivityIntoTrendDays(
    mergeBmrIntoTrendDays(
      mergeVisceralIntoTrendDays(
        mergeWeightOnlyIntoTrendDays(buildDaysFromSessions(dayKeys, sessions), weightByDay),
        visceralByDay
      ),
      bmrByDay
    ),
    activityByDay
  );
  const anchor = resolveCompositionPeriodAnchor(sessions, dayKeys);

  if (__DEV__) {
    const fmt = (s: CompositionSession | null | undefined) =>
      s
        ? `${s.dayKey} W${s.weightKg.toFixed(1)} F${s.fatMassKg.toFixed(1)} M${s.muscleMassKg.toFixed(1)}`
        : '—';
    const visceralTypeCounts: Record<string, number> = {};
    for (const g of groups) {
      for (const m of g.measures ?? []) {
        if (m.type === 88 || m.type === 170) {
          visceralTypeCounts[String(m.type)] = (visceralTypeCounts[String(m.type)] ?? 0) + 1;
        }
      }
    }
    console.warn(
      '[WithingsTrend]',
      JSON.stringify(
        {
          sessionCount: sessions.length,
          visceralMeasureTypesInFetch: visceralTypeCounts,
          periodStart: fmt(anchor?.start),
          periodEnd: fmt(anchor?.end),
          weekFat: anchor ? (anchor.end.fatMassKg - anchor.start.fatMassKg).toFixed(1) : null,
          weekMuscle: anchor ? (anchor.end.muscleMassKg - anchor.start.muscleMassKg).toFixed(1) : null,
          dayCount: days.length,
          recentDays: days
            .slice(-7)
            .map(
              (d) =>
                `${d.dayKey} f=${d.fatMassKg?.toFixed(1) ?? '—'} m=${d.muscleMassKg?.toFixed(1) ?? '—'} v=${d.visceralFatIndex?.toFixed(1) ?? '—'} bmr=${d.bmrKcalDay != null ? Math.round(d.bmrKcalDay) : '—'}`
            ),
          bmrDaysInWindow: bmrByDay.size,
        },
        null,
        2
      )
    );
  }

  return {
    days,
    periodAnchor: anchor,
    debug: {
      sessions,
      periodStart: anchor?.start ?? null,
      periodEnd: anchor?.end ?? null,
      lookbackDays: TREND_LOOKBACK_DAYS,
    },
  };
}

/** A single heart-rate reading (bpm) at a point in time. */
export type WithingsHeartRatePoint = { timestamp: string; value: number };

/** Calorie burn for a short time slot (kcal) from Withings intraday data. */
export type WithingsCaloriePoint = { timestamp: string; kcal: number };

/** Combined result from a single `getintradayactivity` call: HR readings + calorie slots. */
export type WithingsIntradayData = {
  heartRate: WithingsHeartRatePoint[];
  calories: WithingsCaloriePoint[];
};

export type WithingsIntradayTodayFetch = WithingsIntradayData & {
  apiStatus: number | null;
  apiError: string | null;
};

/** Deep history pull for HR + intraday calories — same depth as phone health / workouts. */
export const WITHINGS_HR_DEEP_LOOKBACK_DAYS = METRICS_DEEP_LOOKBACK_DAYS;
/** Routine sync: yesterday + today only — persistence already holds older days. */
export const WITHINGS_SHALLOW_LOOKBACK_DAYS = METRICS_SHALLOW_LOOKBACK_DAYS;
/** @deprecated use WITHINGS_HR_DEEP_LOOKBACK_DAYS */
const HEART_RATE_LOOKBACK_DAYS = WITHINGS_HR_DEEP_LOOKBACK_DAYS;
/** Parallel Withings intraday requests (one calendar day each). */
const INTRADAY_FETCH_CONCURRENCY = 6;

const WITHINGS_MEASURE_V2_URL = 'https://wbsapi.withings.net/v2/measure';

type WithingsIntradayBody = {
  series?: Record<string, { heart_rate?: number; calories?: number }>;
};

type WithingsIntradayJson = {
  status: number;
  body?: WithingsIntradayBody;
  error?: string;
};

/** Generate mock intraday HR + calorie data for one day (every 30 min). */
function mockIntradayForDay(dayStartMs: number): { hr: WithingsHeartRatePoint[]; cal: WithingsCaloriePoint[] } {
  const hr: WithingsHeartRatePoint[] = [];
  const cal: WithingsCaloriePoint[] = [];
  for (let i = 0; i < 48; i++) {
    const tsMs = dayStartMs + i * 30 * 60 * 1000;
    const hour = (tsMs / 3600000) % 24;
    // Lower overnight, higher during day
    const base = hour < 6 || hour > 22 ? 58 : hour < 9 || hour > 20 ? 68 : 72;
    const bpm = Math.round(base + Math.sin(i * 0.4) * 6 + (Math.random() - 0.5) * 4);
    hr.push({ timestamp: new Date(tsMs).toISOString(), value: Math.max(45, bpm) });

    // Simulate activity: moderate walk bursts during 8-9am and 5-7pm
    const isActivity = (hour >= 8 && hour < 9) || (hour >= 17 && hour < 19);
    const actKcal = isActivity ? Math.round(60 + Math.random() * 40) : 0;
    if (actKcal > 0) {
      cal.push({ timestamp: new Date(tsMs).toISOString(), kcal: actKcal });
    }
  }
  return { hr, cal };
}

async function fetchIntradayOneDay(
  daysAgo: number,
  accessToken: string,
  userid?: string,
  /** For today only: end at now so Withings returns the latest synced watch buckets. */
  endAtNow = false,
): Promise<{
  hr: WithingsHeartRatePoint[];
  cal: WithingsCaloriePoint[];
  apiStatus: number | null;
  apiError: string | null;
}> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  dayStart.setDate(dayStart.getDate() - daysAgo);
  const startSec = Math.floor(dayStart.getTime() / 1000);
  const endSec =
    endAtNow && daysAgo === 0
      ? Math.floor(Date.now() / 1000)
      : startSec + 24 * 3600 - 1;

  const form = new URLSearchParams({
    action: 'getintradayactivity',
    access_token: accessToken,
    startdate: String(startSec),
    enddate: String(endSec),
    data_fields: 'heart_rate,calories',
  });
  if (userid) {
    form.set('userid', userid);
  }

  const hr: WithingsHeartRatePoint[] = [];
  const cal: WithingsCaloriePoint[] = [];
  let apiStatus: number | null = null;
  let apiError: string | null = null;

  try {
    const res = await withingsFetch(WITHINGS_MEASURE_V2_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json = (await res.json()) as WithingsIntradayJson;
    apiStatus = json.status ?? null;
    apiError = json.error ?? null;
    if (json.status !== 0) {
      if (__DEV__) {
        console.warn('[WithingsIntraday] API error', { daysAgo, status: json.status, error: json.error });
      }
      return { hr, cal, apiStatus, apiError };
    }

    const series = json.body?.series ?? {};
    for (const [tsSec, entry] of Object.entries(series)) {
      const raw = Number(tsSec);
      if (!Number.isFinite(raw) || raw <= 0) continue;
      // Withings series keys are unix seconds; guard ms keys if API ever returns them.
      const tsMs = raw >= 1e12 ? Math.round(raw) : Math.round(raw * 1000);
      const ts = new Date(tsMs).toISOString();

      const bpm = entry.heart_rate;
      if (typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0) {
        hr.push({ timestamp: ts, value: Math.round(bpm) });
      }
      const kcal = entry.calories;
      if (typeof kcal === 'number' && Number.isFinite(kcal) && kcal > 0) {
        cal.push({ timestamp: ts, kcal });
      }
    }
  } catch (err) {
    apiError = err instanceof Error ? err.message : 'network error';
  }

  return { hr, cal, apiStatus, apiError };
}

/**
 * Fetches continuous 24/7 watch heart-rate + calorie history from Withings `getintradayactivity`
 * (requires `user.activity` scope — included in DEFAULT_WITHINGS_SCOPE).
 * Each calendar day is a separate API call (Withings limit: 24h per request).
 * Returns oldest → newest, all days merged.
 */
export async function fetchHeartRateHistory(
  lookbackDays: number = HEART_RATE_LOOKBACK_DAYS
): Promise<WithingsIntradayData> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    // Dev mock: last N days of synthetic data
    const heartRate: WithingsHeartRatePoint[] = [];
    const calories: WithingsCaloriePoint[] = [];
    for (let i = lookbackDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const { hr, cal } = mockIntradayForDay(d.getTime());
      heartRate.push(...hr);
      calories.push(...cal);
    }
    return { heartRate, calories };
  }

  const stored = await loadWithingsTokens();
  const heartRate: WithingsHeartRatePoint[] = [];
  const calories: WithingsCaloriePoint[] = [];
  const n = Math.max(1, Math.floor(lookbackDays));
  const dayOffsets = Array.from({ length: n }, (_, idx) => n - 1 - idx);

  for (let i = 0; i < dayOffsets.length; i += INTRADAY_FETCH_CONCURRENCY) {
    const chunk = dayOffsets.slice(i, i + INTRADAY_FETCH_CONCURRENCY);
    const results = await Promise.all(
      chunk.map((daysAgo) => fetchIntradayOneDay(daysAgo, accessToken, stored?.userid)),
    );
    for (const day of results) {
      heartRate.push(...day.hr);
      calories.push(...day.cal);
    }
  }

  heartRate.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  calories.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (__DEV__) {
    console.warn(
      '[WithingsIntraday]',
      JSON.stringify({ lookbackDays, hrPoints: heartRate.length, calPoints: calories.length }, null, 2)
    );
  }

  return { heartRate, calories };
}

/**
 * Re-fetches only today's intraday HR + calories from Withings (1 API call, end = now).
 * Used for periodic background refresh without re-requesting the full history.
 */
export async function fetchIntradayToday(): Promise<WithingsIntradayTodayFetch> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const { hr, cal } = mockIntradayForDay(d.getTime());
    return { heartRate: hr, calories: cal, apiStatus: 0, apiError: null };
  }
  const stored = await loadWithingsTokens();
  const { hr, cal, apiStatus, apiError } = await fetchIntradayOneDay(
    0,
    accessToken,
    stored?.userid,
    true,
  );
  if (__DEV__) {
    const latest = hr.length > 0 ? hr[hr.length - 1]!.timestamp : null;
    console.warn('[WithingsIntraday] today', { hrPoints: hr.length, latest, apiStatus, apiError });
  }
  return { heartRate: hr, calories: cal, apiStatus, apiError };
}

/** @deprecated alias — use fetchIntradayToday */
export async function fetchTodayHeartRate(): Promise<WithingsIntradayData> {
  return fetchIntradayToday();
}

/** Ignore aborted / accidental starts (e.g. 5s bike) before they pollute merge/chart. */
export const MIN_WORKOUT_DURATION_MS = 2 * 60 * 1000;

/** A single Withings workout session with calorie data. */
export type WorkoutSession = {
  /** Activity category (Withings numeric: 1=walk, 2=run, 187=bike, etc.). */
  category: number;
  /** Human-readable label derived from category. */
  activityLabel: string;
  startMs: number;
  endMs: number;
  /** Active calories burned (kcal). */
  kcal: number;
  /** Total calories including BMR component (kcal), if available. */
  totalKcal?: number;
  /** Total distance in meters, if recorded. */
  distanceM?: number;
  /** Total steps, if recorded. */
  steps?: number;
  /** Data origin when not from Withings cloud API. */
  source?: 'withings' | 'health-connect';
  /** User manual override calories (kcal) — takes precedence over watch kcal. */
  manualKcal?: number;
  /** User manual override duration (minutes) — takes precedence over watch duration. */
  manualMinutes?: number;
  /** Timestamp when the user edited/overrode this session. */
  manualUpdatedAt?: number;
};

/** True when the session has a real end time at least MIN_WORKOUT_DURATION_MS long. */
export function isKeepableWorkout(w: Pick<WorkoutSession, 'startMs' | 'endMs'>): boolean {
  if (!Number.isFinite(w.startMs) || w.startMs <= 0) return false;
  if (!Number.isFinite(w.endMs)) return false;
  return w.endMs - w.startMs >= MIN_WORKOUT_DURATION_MS;
}

/** Withings activity category → label map (partial; covers common types). */
const WORKOUT_CATEGORY_LABELS: Record<number, string> = {
  1: 'Walk', 2: 'Run', 3: 'Hike', 4: 'Skating',
  5: 'BMX', 6: 'Biking', 7: 'Swimming', 11: 'Soccer',
  18: 'Basketball', 21: 'Aerobics', 23: 'Elliptical',
  24: 'Pilates', 27: 'Tennis', 28: 'Yoga', 29: 'Zumba',
  35: 'Cardio', 70: 'Gym', 187: 'Indoor Biking', 128: 'Golf',
};
function workoutLabel(category: number): string {
  return WORKOUT_CATEGORY_LABELS[category] ?? `Activity ${category}`;
}

type WithingsWorkoutsBody = {
  series?: Array<{
    startdate?: number;
    enddate?: number;
    category?: number;
    data?: {
      calories?: number;
      totalcalories?: number;
      manual_calories?: number;
      distance?: number;
      manual_distance?: number;
      steps?: number;
    };
  }>;
  more?: boolean | number;
  offset?: number;
};
type WithingsWorkoutsJson = { status: number; body?: WithingsWorkoutsBody; error?: string };

/** Result of getworkouts — keepable sessions plus startMs markers for short non-keepable spans. */
export type WithingsWorkoutsFetch = {
  keepable: WorkoutSession[];
  /** Positive duration under MIN — not keepable; store retains prior solid session at this startMs. */
  abortStartMs: number[];
  /** Every startdate seen in the API (including incomplete zero-span rows). */
  seenStartMs: number[];
  /** Earliest ms covered by this fetch (local lookback start). */
  lookbackStartMs: number;
};

/** Withings measure timestamps are unix seconds; guard ms if API ever returns them. */
function withingsUnixToMs(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1e12 ? Math.round(value) : Math.round(value * 1000);
}

/** Deep workout history lookback (on-demand / first link) — same as HR / phone health. */
export const WITHINGS_WORKOUT_DEEP_LOOKBACK_DAYS = METRICS_DEEP_LOOKBACK_DAYS;
/** @deprecated use WITHINGS_WORKOUT_DEEP_LOOKBACK_DAYS */
const WORKOUT_LOOKBACK_DAYS = WITHINGS_WORKOUT_DEEP_LOOKBACK_DAYS;

/** Generate mock workout sessions (today: bike ride at 9 AM). */
function mockWorkouts(lookbackDays: number): WithingsWorkoutsFetch {
  const keepable: WorkoutSession[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lookbackStart = new Date(today);
  lookbackStart.setDate(lookbackStart.getDate() - lookbackDays + 1);

  // Today: bike ride 9:03 → 9:25
  if (lookbackDays >= 1) {
    const d = new Date(today);
    keepable.push({
      category: 187,
      activityLabel: 'Indoor Biking',
      startMs: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 3, 0).getTime(),
      endMs:   new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 25, 10).getTime(),
      kcal: 189,
      totalKcal: 209,
      source: 'withings',
    });
  }
  // Yesterday: walk 7:30 → 8:00
  if (lookbackDays >= 2) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    keepable.push({
      category: 1,
      activityLabel: 'Walk',
      startMs: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7, 30, 0).getTime(),
      endMs:   new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0, 0).getTime(),
      kcal: 120,
      totalKcal: 140,
      source: 'withings',
    });
  }
  return {
    keepable,
    abortStartMs: [],
    seenStartMs: keepable.map((w) => w.startMs),
    lookbackStartMs: lookbackStart.getTime(),
  };
}

function parseWorkoutSeriesRow(
  w: NonNullable<WithingsWorkoutsBody['series']>[number],
): {
  startMs: number;
  endMs: number;
  durationMs: number;
  session?: WorkoutSession;
  abort?: boolean;
} | null {
  const startMs = withingsUnixToMs(w.startdate ?? 0);
  const endMs = withingsUnixToMs(w.enddate ?? 0);
  if (!startMs) return null;
  const durationMs = endMs - startMs;
  if (durationMs > 0 && durationMs < MIN_WORKOUT_DURATION_MS) {
    return { startMs, endMs, durationMs, abort: true };
  }
  if (durationMs < MIN_WORKOUT_DURATION_MS) {
    return { startMs, endMs, durationMs };
  }
  const kcal =
    w.data?.calories ?? w.data?.manual_calories ?? w.data?.totalcalories ?? 0;
  const dist = w.data?.distance ?? w.data?.manual_distance;
  const distanceM = Number.isFinite(dist) && (dist as number) > 0 ? Math.round(dist as number) : undefined;
  const steps = Number.isFinite(w.data?.steps) && (w.data?.steps as number) > 0 ? Math.round(w.data?.steps as number) : undefined;
  return {
    startMs,
    endMs,
    durationMs,
    session: {
      category: w.category ?? 0,
      activityLabel: workoutLabel(w.category ?? 0),
      startMs,
      endMs,
      kcal: Number.isFinite(kcal) && kcal > 0 ? kcal : 0,
      totalKcal: w.data?.totalcalories,
      distanceM,
      steps,
      source: 'withings',
    },
  };
}

/**
 * Fetches workout session history from Withings `getworkouts`.
 * Workouts (e.g. bike, run) are tracked separately from passive intraday activity.
 * Both endpoints are needed for a complete calorie picture.
 *
 * Paginates with `more`/`offset` — a single page is capped (~300); without paging,
 * recent rides (e.g. today's bike) are often missing when lookback is long.
 *
 * Note: Withings often returns calories:0 even for real sessions — do not drop on kcal.
 * Short positive durations (<2 min) are flagged in abortStartMs as "not keepable".
 * The metrics store retains any prior solid session at that startMs (edit glitch);
 * only absence from the paginated fetch removes a cached workout.
 * Zero-span rows (enddate === startdate) are seen but not keepable (retain prior if any).
 */
export async function fetchWorkoutsHistory(
  lookbackDays: number = WORKOUT_LOOKBACK_DAYS
): Promise<WithingsWorkoutsFetch> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return mockWorkouts(lookbackDays);
  }

  const stored = await loadWithingsTokens();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays + 1);
  startDate.setHours(0, 0, 0, 0);
  const lookbackStartMs = startDate.getTime();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const keepableByStart = new Map<number, WorkoutSession>();
  const abortStartMs = new Set<number>();
  const seenStartMs = new Set<number>();

  let offset: number | undefined;
  const maxPages = 40; // ~300 rows/page → plenty for 128d history
  for (let page = 0; page < maxPages; page++) {
    const form = new URLSearchParams({
      action: 'getworkouts',
      access_token: accessToken,
      startdateymd: fmt(startDate),
      enddateymd: fmt(endDate),
      data_fields: 'calories,totalcalories,manual_calories',
    });
    if (stored?.userid) form.set('userid', stored.userid);
    if (offset != null) form.set('offset', String(offset));

    const res = await withingsFetch(WITHINGS_MEASURE_V2_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json = (await res.json()) as WithingsWorkoutsJson;
    if (json.status !== 0) {
      throw new Error(`Withings getworkouts failed (status ${json.status})`);
    }

    const series = json.body?.series ?? [];
    for (const w of series) {
      const parsed = parseWorkoutSeriesRow(w);
      if (!parsed) continue;
      seenStartMs.add(parsed.startMs);
      if (parsed.abort) {
        abortStartMs.add(parsed.startMs);
        keepableByStart.delete(parsed.startMs);
        continue;
      }
      if (parsed.session) {
        const prev = keepableByStart.get(parsed.startMs);
        if (!prev || parsed.session.endMs - parsed.session.startMs >= prev.endMs - prev.startMs) {
          keepableByStart.set(parsed.startMs, parsed.session);
        }
      }
    }

    const more = json.body?.more === true || json.body?.more === 1;
    const nextOffset = json.body?.offset;
    if (!more || nextOffset == null || series.length === 0) break;
    if (offset != null && nextOffset === offset) break;
    offset = nextOffset;
  }

  const keepable = [...keepableByStart.values()].sort((a, b) => a.startMs - b.startMs);

  if (__DEV__) {
    console.warn(
      '[WithingsWorkouts]',
      JSON.stringify(
        {
          lookbackDays,
          keepable: keepable.length,
          aborts: abortStartMs.size,
          seen: seenStartMs.size,
        },
        null,
        2,
      ),
    );
  }

  return {
    keepable,
    abortStartMs: [...abortStartMs],
    seenStartMs: [...seenStartMs],
    lookbackStartMs,
  };
}

// ─── User height ─────────────────────────────────────────────────────────────

const HEIGHT_CACHE_KEY = 'user_height_cm';

/**
 * Fetches the user's height from Withings (meastype 4 = height in metres).
 * Converts to cm and caches in AsyncStorage. Returns null if not available.
 */
export async function fetchUserHeight(): Promise<number | null> {
  const cached = await AsyncStorage.getItem(HEIGHT_CACHE_KEY);
  if (cached) {
    const cm = parseFloat(cached);
    if (!isNaN(cm) && cm > 0) return cm;
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const stored = await loadWithingsTokens();
  const end = Math.floor(Date.now() / 1000);
  const start = end - 10 * 365 * 24 * 3600; // look back 10 years

  const form = new URLSearchParams({
    action: 'getmeas',
    access_token: accessToken,
    category: '1',
    startdate: String(start),
    enddate: String(end),
    meastypes: '4', // 4 = height (metres)
  });
  if (stored?.userid) form.set('userid', stored.userid);

  try {
    const res = await withingsFetch(WITHINGS_MEASURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json = (await res.json()) as WithingsGetMeasJson;
    if (json.status !== 0) return null;

    for (const grp of (json.body?.measuregrps ?? [])) {
      const hit = grp.measures?.find((m) => m.type === 4);
      if (hit && typeof hit.value === 'number' && typeof hit.unit === 'number') {
        const metres = decodeWithingsMeasureValue(hit.value, hit.unit);
        if (metres && metres > 0) {
          const cm = Math.round(metres * 100);
          await AsyncStorage.setItem(HEIGHT_CACHE_KEY, String(cm));
          return cm;
        }
      }
    }
  } catch { /* non-fatal */ }

  return null;
}

export type {
  BodyCompositionTrendDebug,
  BodyCompositionTrendPayload,
  CompositionSession,
  MetabolicTrend7dDay,
} from '../logic/metabolicTrend7d';
