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

const WITHINGS_AUTHORIZE_URL = 'https://account.withings.com/oauth2_user/authorize2';
/** Token endpoint: POST, `Content-Type: application/x-www-form-urlencoded`, body includes `action=requesttoken`. */
const WITHINGS_TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';
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

type WithingsTokenResponseBody = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  userid?: number | string;
  scope?: string;
  token_type?: string;
};

type WithingsOAuthJson = {
  status: number;
  body?: WithingsTokenResponseBody;
  error?: string;
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

function assertWithingsConfigured(): { clientId: string; clientSecret: string } {
  const clientId = CONFIG.withingsClientId.trim();
  const clientSecret = CONFIG.withingsClientSecret.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      'Withings OAuth is not configured. Set WITHINGS_CLIENT_ID and WITHINGS_CLIENT_SECRET in .env.'
    );
  }
  return { clientId, clientSecret };
}

/** `redirect_uri` for authorize + token exchange — always `CONFIG.withingsCallbackUrl` from `.env` `WITHINGS_CALLBACK_URL` (never Expo `exp://`). */
function withingsOAuthRedirectUri(): string {
  return CONFIG.withingsCallbackUrl.trim();
}

function mapTokenBody(body: WithingsTokenResponseBody, previousUserid?: string): WithingsOAuthTokens {
  const expiresInSec = Number(body.expires_in ?? 10_800);
  const expiresAt = new Date(Date.now() + Math.max(60, expiresInSec) * 1000).toISOString();
  const userid =
    body.userid != null ? String(body.userid) : previousUserid != null ? previousUserid : undefined;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt,
    userid,
    scope: body.scope,
    tokenType: body.token_type,
  };
}

async function postRequestToken(
  form: Record<string, string>,
  previousUserid?: string
): Promise<WithingsOAuthTokens> {
  const body = new URLSearchParams({ action: 'requesttoken', ...form }).toString();
  const res = await fetch(WITHINGS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json()) as WithingsOAuthJson;
  if (json.status !== 0 || !json.body) {
    const detail = json.error ?? res.statusText;
    throw new Error(`Withings token request failed (status ${json.status}): ${detail}`);
  }
  return mapTokenBody(json.body, previousUserid);
}

/**
 * Builds the URL for `GET https://account.withings.com/oauth2_user/authorize2?...`
 * including `redirect_uri` from `WITHINGS_CALLBACK_URL` / `CONFIG.withingsCallbackUrl` (must match Withings portal; not `exp://`).
 */
export function buildAuthorizationUrl(state: string, scope: string = DEFAULT_WITHINGS_SCOPE): string {
  const { clientId } = assertWithingsConfigured();
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
export async function exchangeCodeForTokens(
  code: string,
  clientId?: string,
  clientSecret?: string
): Promise<WithingsOAuthTokens> {
  const cfg = assertWithingsConfigured();
  return postRequestToken({
    grant_type: 'authorization_code',
    client_id: clientId ?? cfg.clientId,
    client_secret: clientSecret ?? cfg.clientSecret,
    code: code.trim(),
    redirect_uri: withingsOAuthRedirectUri(),
  });
}

/**
 * Refreshes the access token using a refresh token (does not persist).
 */
export async function refreshAccessToken(refreshToken: string): Promise<WithingsOAuthTokens> {
  const { clientId, clientSecret } = assertWithingsConfigured();
  const stored = await loadWithingsTokens();
  const previousUserid =
    stored && stored.refreshToken.trim() === refreshToken.trim() ? stored.userid : undefined;
  return postRequestToken(
    {
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken.trim(),
    },
    previousUserid
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
export async function fetchWeightMetrics(): Promise<WeightMetricsForDashboard> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return getMockWeightMetricsForDashboard();
  }

  const stored = await loadWithingsTokens();
  const end = Math.floor(Date.now() / 1000);
  const start = end - 365 * 24 * 3600;

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

  const res = await fetch(WITHINGS_MEASURE_URL, {
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

function mergeActivityIntoTrendDays(
  days: MetabolicTrend7dDay[],
  activityByDay: Map<string, number>
): MetabolicTrend7dDay[] {
  return days.map((d) => {
    if (d.activityKcalDay != null && Number.isFinite(d.activityKcalDay)) return d;
    const a = activityByDay.get(d.dayKey);
    return a != null ? { ...d, activityKcalDay: a } : d;
  });
}

type WithingsGetActivityJson = {
  status: number;
  body?: { activities?: Array<Record<string, unknown>> };
  error?: string;
};

/**
 * Fetches daily active calories from Withings getactivity for the given day keys.
 * One API call covers the full date range. Requires user.activity scope.
 */
async function fetchActivityKcalByDay(
  dayKeys: string[],
  accessToken: string,
  userid?: string
): Promise<Map<string, number>> {
  if (dayKeys.length === 0) return new Map();

  const sorted = [...dayKeys].sort();
  const form = new URLSearchParams({
    action: 'getactivity',
    access_token: accessToken,
    startdateymd: sorted[0],
    enddateymd: sorted[sorted.length - 1],
    data_fields: 'active_calories,calories',
  });
  if (userid) form.set('userid', userid);

  try {
    const res = await fetch('https://wbsapi.withings.net/v2/measure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json = (await res.json()) as WithingsGetActivityJson;

    if (__DEV__) {
      console.warn('[WithingsActivity] getactivity response', JSON.stringify({
        status: json.status,
        error: json.error,
        activityCount: json.body?.activities?.length ?? 0,
        sample: json.body?.activities?.slice(0, 2),
      }, null, 2));
    }

    if (json.status !== 0) return new Map();

    const out = new Map<string, number>();
    for (const act of json.body?.activities ?? []) {
      const dateYmd = String(act.date ?? '');
      if (!dateYmd) continue;
      // Withings: 'calories' = active-only burn; 'totalcalories' includes BMR
      const active = Number(act.active_calories ?? act.calories ?? 0);
      if (Number.isFinite(active) && active > 0) {
        out.set(dateYmd, Math.round(active));
      }
    }

    if (__DEV__) {
      console.warn('[WithingsActivity] mapped days', JSON.stringify([...out.entries()], null, 2));
    }

    return out;
  } catch (err) {
    if (__DEV__) console.warn('[WithingsActivity] fetch error', err);
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

/**
 * Daily weight, fat mass, muscle mass, and visceral fat index for the last `MAX_TREND_PERIOD_DAYS`
 * local days. Callers slice this to the selected window (8/16/32/64/128 days). Period deltas skip the
 * first in-window BIA day (Withings-style) and compare 2nd day → last day.
 */
export async function fetchBodyCompositionTrend7d(): Promise<BodyCompositionTrendPayload> {
  const dayKeys = lastNLocalDayKeysOldestFirst(MAX_TREND_PERIOD_DAYS);
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return mockTrendPayload(dayKeys);
  }

  const stored = await loadWithingsTokens();
  const end = Math.floor(Date.now() / 1000);
  const start = end - TREND_LOOKBACK_DAYS * 24 * 3600;

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

  const res = await fetch(WITHINGS_MEASURE_URL, {
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
  const activityByDay = await fetchActivityKcalByDay(dayKeys, accessToken, stored?.userid);
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

/** Default lookback for intraday HR history (days). Keep small — each day = 1 API request. */
const HEART_RATE_LOOKBACK_DAYS = 7;

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

/**
 * Fetches continuous watch heart-rate + calorie history from Withings `getintradayactivity`
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

  for (let i = n - 1; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const startSec = Math.floor(dayStart.getTime() / 1000);
    const endSec = startSec + 24 * 3600 - 1;

    const form = new URLSearchParams({
      action: 'getintradayactivity',
      access_token: accessToken,
      startdate: String(startSec),
      enddate: String(endSec),
      data_fields: 'heart_rate,calories',
    });
    if (stored?.userid) {
      form.set('userid', stored.userid);
    }

    try {
      const res = await fetch(WITHINGS_MEASURE_V2_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const json = (await res.json()) as WithingsIntradayJson;
      if (json.status !== 0) continue; // skip days with no data / errors silently

      const series = json.body?.series ?? {};
      for (const [tsSec, entry] of Object.entries(series)) {
        const tsMs = Number(tsSec) * 1000;
        if (Number.isNaN(tsMs)) continue;
        const ts = new Date(tsMs).toISOString();

        const bpm = entry.heart_rate;
        if (typeof bpm === 'number' && Number.isFinite(bpm) && bpm > 0) {
          heartRate.push({ timestamp: ts, value: Math.round(bpm) });
        }
        const kcal = entry.calories;
        if (typeof kcal === 'number' && Number.isFinite(kcal) && kcal > 0) {
          calories.push({ timestamp: ts, kcal });
        }
      }
    } catch {
      // Network error on one day — skip it, don't fail the whole fetch
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
 * Re-fetches only today's intraday HR + calories from Withings (1 API call).
 * Used for periodic background refresh without re-requesting the full history.
 */
export async function fetchTodayHeartRate(): Promise<WithingsIntradayData> {
  return fetchHeartRateHistory(1);
}

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
};

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
    data?: { calories?: number; totalcalories?: number };
  }>;
};
type WithingsWorkoutsJson = { status: number; body?: WithingsWorkoutsBody; error?: string };

/** Default number of days to fetch for workout history. */
const WORKOUT_LOOKBACK_DAYS = 128;

/** Generate mock workout sessions (today: bike ride at 9 AM). */
function mockWorkouts(lookbackDays: number): WorkoutSession[] {
  const sessions: WorkoutSession[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Today: bike ride 9:03 → 9:25
  if (lookbackDays >= 1) {
    const d = new Date(today);
    sessions.push({
      category: 187,
      activityLabel: 'Indoor Biking',
      startMs: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 3, 0).getTime(),
      endMs:   new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 25, 10).getTime(),
      kcal: 189,
      totalKcal: 209,
    });
  }
  // Yesterday: walk 7:30 → 8:00
  if (lookbackDays >= 2) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    sessions.push({
      category: 1,
      activityLabel: 'Walk',
      startMs: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7, 30, 0).getTime(),
      endMs:   new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0, 0).getTime(),
      kcal: 120,
      totalKcal: 140,
    });
  }
  return sessions;
}

/**
 * Fetches workout session history from Withings `getworkouts`.
 * Workouts (e.g. bike, run) are tracked separately from passive intraday activity.
 * Both endpoints are needed for a complete calorie picture.
 */
export async function fetchWorkoutsHistory(
  lookbackDays: number = WORKOUT_LOOKBACK_DAYS
): Promise<WorkoutSession[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return mockWorkouts(lookbackDays);
  }

  const stored = await loadWithingsTokens();

  // Date range: today back N days (YYYY-MM-DD format Withings expects)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays + 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const form = new URLSearchParams({
    action: 'getworkouts',
    access_token: accessToken,
    startdateymd: fmt(startDate),
    enddateymd: fmt(endDate),
    data_fields: 'calories,totalcalories',
  });
  if (stored?.userid) {
    form.set('userid', stored.userid);
  }

  try {
    const res = await fetch(WITHINGS_MEASURE_V2_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json = (await res.json()) as WithingsWorkoutsJson;
    if (json.status !== 0 || !json.body?.series) return [];

    const sessions: WorkoutSession[] = [];
    for (const w of json.body.series) {
      const startMs = (w.startdate ?? 0) * 1000;
      const endMs   = (w.enddate   ?? 0) * 1000;
      const kcal    = w.data?.calories ?? 0;
      if (!startMs || !endMs || kcal <= 0) continue;
      sessions.push({
        category: w.category ?? 0,
        activityLabel: workoutLabel(w.category ?? 0),
        startMs,
        endMs,
        kcal,
        totalKcal: w.data?.totalcalories,
      });
    }

    sessions.sort((a, b) => a.startMs - b.startMs);

    if (__DEV__) {
      console.warn('[WithingsWorkouts]', JSON.stringify({ lookbackDays, sessions: sessions.length }, null, 2));
    }

    return sessions;
  } catch {
    return [];
  }
}

export type {
  BodyCompositionTrendDebug,
  BodyCompositionTrendPayload,
  CompositionSession,
  MetabolicTrend7dDay,
} from '../logic/metabolicTrend7d';
