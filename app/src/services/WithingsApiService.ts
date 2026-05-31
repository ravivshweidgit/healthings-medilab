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

/** Default scope for body metrics (weight, composition, etc.). */
export const DEFAULT_WITHINGS_SCOPE = 'user.metrics';

/** Withings measure `type` ids we surface on the dashboard. */
export const WITHINGS_MEASURE_TYPES = {
  WEIGHT_KG: 1,
  FAT_MASS_KG: 8,
  MUSCLE_MASS_KG: 76,
  /** Visceral fat index (Body Scan). Type 88 is bone mass (kg) — not visceral. */
  VISCERAL_FAT_INDEX: 170,
  /** Basal metabolic rate (kcal/day). */
  BMR_KCAL_DAY: 226,
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
    return {
      dayKey,
      weightKg: w,
      fatMassKg: Math.max(14.2, 16.1 - frac * 2.4 + Math.sin(phase * 2) * 0.15),
      muscleMassKg: Math.max(58.5, 60.2 + frac * 1.2 + Math.cos(phase * Math.PI) * 0.2),
      visceralFatIndex: Math.max(3.9, 4.2 - frac * 2 + Math.sin(phase * 2) * 0.08),
      bmrKcalDay: Math.round(1835 + frac * 80 + Math.sin(phase * Math.PI) * 18),
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
  const days = mergeBmrIntoTrendDays(
    mergeVisceralIntoTrendDays(
      mergeWeightOnlyIntoTrendDays(buildDaysFromSessions(dayKeys, sessions), weightByDay),
      visceralByDay
    ),
    bmrByDay
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

export type {
  BodyCompositionTrendDebug,
  BodyCompositionTrendPayload,
  CompositionSession,
  MetabolicTrend7dDay,
} from '../logic/metabolicTrend7d';
