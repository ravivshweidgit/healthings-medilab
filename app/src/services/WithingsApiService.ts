/**
 * Withings OAuth2 (Public API) + measure `getmeas` for body composition.
 * @see https://developer.withings.com/
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { CONFIG } from '../config/env';
import {
  last7LocalDayKeysOldestFirst,
  localDayKeyFromMs,
  type WeightVisceralTrendDay,
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
  VISCERAL_FAT_INDEX: 88,
} as const;

const DASHBOARD_TYPE_LIST = [
  WITHINGS_MEASURE_TYPES.WEIGHT_KG,
  WITHINGS_MEASURE_TYPES.FAT_MASS_KG,
  WITHINGS_MEASURE_TYPES.MUSCLE_MASS_KG,
  WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX,
] as const;

const TREND_MEASURE_TYPES = [WITHINGS_MEASURE_TYPES.WEIGHT_KG, WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX] as const;

/** Latest body-composition snapshot for HealthDashboard-style UIs. */
export type WeightMetricsForDashboard = {
  measuredAt: string | null;
  weightKg: number | null;
  fatMassKg: number | null;
  muscleMassKg: number | null;
  visceralFatIndex: number | null;
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
  };
}

/**
 * Picks the newest measurement per `type` by scanning `measuregrps` newest-first.
 */
function pickLatestMeasuresByType(groups: WithingsMeasureGrp[]): Map<number, { value: number; unit: number; date: number }> {
  const sorted = [...groups].filter((g) => g && typeof g.date === 'number').sort((a, b) => b.date - a.date);
  const out = new Map<number, { value: number; unit: number; date: number }>();
  for (const typeId of DASHBOARD_TYPE_LIST) {
    for (const grp of sorted) {
      const hit = grp.measures?.find((m) => m.type === typeId);
      if (hit && typeof hit.value === 'number' && typeof hit.unit === 'number') {
        out.set(typeId, { value: hit.value, unit: hit.unit, date: grp.date });
        break;
      }
    }
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
  };
}

/** Dev/offline sample aligned with `WeightMetricsForDashboard` (types 1, 8, 76, 88). */
export function getMockWeightMetricsForDashboard(): WeightMetricsForDashboard {
  return {
    measuredAt: new Date().toISOString(),
    weightKg: 78.4,
    fatMassKg: 17.9,
    muscleMassKg: 56.2,
    visceralFatIndex: 8.0,
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

function aggregateWeightVisceralForDayGrps(
  dayGrps: WithingsMeasureGrp[]
): Pick<WeightVisceralTrendDay, 'weightKg' | 'visceralFatIndex'> {
  const sorted = [...dayGrps].filter((g) => g && typeof g.date === 'number').sort((a, b) => b.date - a.date);
  let weightKg: number | null = null;
  let visceralFatIndex: number | null = null;
  for (const g of sorted) {
    for (const m of g.measures ?? []) {
      if (
        m.type === WITHINGS_MEASURE_TYPES.WEIGHT_KG &&
        weightKg === null &&
        typeof m.value === 'number' &&
        typeof m.unit === 'number'
      ) {
        weightKg = decodeWithingsMeasureValue(m.value, m.unit);
      }
      if (
        m.type === WITHINGS_MEASURE_TYPES.VISCERAL_FAT_INDEX &&
        visceralFatIndex === null &&
        typeof m.value === 'number' &&
        typeof m.unit === 'number'
      ) {
        visceralFatIndex = decodeWithingsMeasureValue(m.value, m.unit);
      }
    }
    if (weightKg !== null && visceralFatIndex !== null) break;
  }
  return { weightKg, visceralFatIndex };
}

/** Synthetic 7-day series for dev UI (slight drift so paths are visible). */
export function getMockWeightVisceralTrend7d(dayKeys: string[]): WeightVisceralTrendDay[] {
  return dayKeys.map((dayKey, i) => {
    const phase = i / 6;
    return {
      dayKey,
      weightKg: 78.1 + Math.sin(phase * Math.PI) * 0.55 + i * 0.04,
      visceralFatIndex: Math.max(6.8, 8.4 - i * 0.09 + Math.sin(phase * 2) * 0.12),
    };
  });
}

/**
 * Daily weight & visceral fat (latest reading that local calendar day) for the last 7 days.
 * Returns mock points only when there is no valid session; otherwise live `getmeas` data.
 */
export async function fetchWeightVisceralTrend7d(): Promise<WeightVisceralTrendDay[]> {
  const dayKeys = last7LocalDayKeysOldestFirst();
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return getMockWeightVisceralTrend7d(dayKeys);
  }

  const stored = await loadWithingsTokens();
  const end = Math.floor(Date.now() / 1000);
  const start = end - 9 * 24 * 3600;

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
  return dayKeys.map((dayKey) => {
    const dayGrps = groups.filter((g) => localDayKeyFromMs(g.date * 1000) === dayKey);
    return { dayKey, ...aggregateWeightVisceralForDayGrps(dayGrps) };
  });
}

export type { WeightVisceralTrendDay } from '../logic/metabolicTrend7d';
