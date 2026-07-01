/**
 * Local persistence for Withings metrics — single source of truth for the UI.
 * Sync adapters fetch from the API and merge into this store; screens read from here only.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKeyStartMs, localDayKeyFromMs, type CompositionSession, type MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import {
  fetchBodyCompositionTrend7d,
  fetchHeartRateHistory,
  fetchIntradayToday,
  fetchWeightMetrics,
  fetchWorkoutsHistory,
  getValidAccessToken,
  loadWithingsTokens,
  type WeightMetricsForDashboard,
  type WithingsCaloriePoint,
  type WithingsHeartRatePoint,
  type WorkoutSession,
} from './WithingsApiService';
import {
  buildHrSyncDiag,
  filterTodayHr,
  saveWithingsHrSyncDiag,
} from './withingsHrSyncDiag';

export const WITHINGS_STORE_KEY = 'healthings:withingsStore';

/** Keep this many days of intraday HR/calories in AsyncStorage (chart pan is ≤16D). */
const MAX_INTRADAY_STORE_DAYS = 60;

export type WithingsPersistedStore = {
  version: 1;
  lastSyncedAt: string | null;
  bodyScan: WeightMetricsForDashboard | null;
  bodyTrendDays: MetabolicTrend7dDay[];
  bodyTrendSessions: CompositionSession[];
  heartRate: WithingsHeartRatePoint[];
  calories: WithingsCaloriePoint[];
  workouts: WorkoutSession[];
};

const EMPTY_STORE: WithingsPersistedStore = {
  version: 1,
  lastSyncedAt: null,
  bodyScan: null,
  bodyTrendDays: [],
  bodyTrendSessions: [],
  heartRate: [],
  calories: [],
  workouts: [],
};

export function hasWithingsData(store: WithingsPersistedStore): boolean {
  return (
    store.bodyScan != null ||
    store.bodyTrendDays.length > 0 ||
    store.heartRate.length > 0 ||
    store.calories.length > 0 ||
    store.workouts.length > 0
  );
}

function trimIntradayHistory<T extends { timestamp: string }>(points: T[]): T[] {
  const cutoffMs = Date.now() - MAX_INTRADAY_STORE_DAYS * 24 * 60 * 60 * 1000;
  return points.filter((p) => {
    const ms = Date.parse(p.timestamp);
    return !Number.isNaN(ms) && ms >= cutoffMs;
  });
}

function localDayStartMs(): number {
  return dayKeyStartMs(localDayKeyFromMs(Date.now()));
}

function isTodayTimestamp(timestamp: string): boolean {
  const ms = Date.parse(timestamp);
  return !Number.isNaN(ms) && ms >= localDayStartMs();
}

function stripToday<T extends { timestamp: string }>(points: T[]): T[] {
  return points.filter((p) => !isTodayTimestamp(p.timestamp));
}

/** Replace today's intraday slice with a fresh API fetch (Withings is source of truth for today). */
export function replaceTodayIntraday<T extends { timestamp: string }>(
  prev: T[],
  freshToday: T[],
): T[] {
  if (freshToday.length === 0) return prev;
  const todayStartMs = localDayStartMs();
  const older = prev.filter((p) => {
    const ms = Date.parse(p.timestamp);
    return !Number.isNaN(ms) && ms < todayStartMs;
  });
  const today = freshToday
    .filter((p) => {
      const ms = Date.parse(p.timestamp);
      return !Number.isNaN(ms) && ms >= todayStartMs;
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return [...older, ...today];
}

function mergeHeartRateWithFreshToday(
  prev: WithingsHeartRatePoint[],
  history: WithingsHeartRatePoint[],
  todayFresh: WithingsHeartRatePoint[],
): WithingsHeartRatePoint[] {
  if (todayFresh.length === 0 && history.length === 0) return prev;
  const olderMerged = mergeByTimestamp(stripToday(prev), stripToday(history));
  return replaceTodayIntraday(olderMerged, todayFresh);
}

function mergeCaloriesWithFreshToday(
  prev: WithingsCaloriePoint[],
  history: WithingsCaloriePoint[],
  todayFresh: WithingsCaloriePoint[],
): WithingsCaloriePoint[] {
  // HR-only refresh must not strip today's calories when the API returned no calorie points.
  if (todayFresh.length === 0 && history.length === 0) return prev;
  const olderMerged = mergeByTimestamp(stripToday(prev), stripToday(history));
  return replaceTodayIntraday(olderMerged, todayFresh);
}

function mergeBodyScan(
  prev: WeightMetricsForDashboard | null,
  next: WeightMetricsForDashboard,
): WeightMetricsForDashboard {
  if (!next.measuredAt) return prev ?? next;
  if (!prev?.measuredAt) return next;
  return new Date(next.measuredAt).getTime() >= new Date(prev.measuredAt).getTime() ? next : prev;
}

function mergeByTimestamp<T extends { timestamp: string }>(prev: T[], next: T[]): T[] {
  const map = new Map<number, T>();
  for (const p of prev) {
    const ms = Date.parse(p.timestamp);
    if (!Number.isNaN(ms)) map.set(ms, p);
  }
  for (const p of next) {
    const ms = Date.parse(p.timestamp);
    if (!Number.isNaN(ms)) map.set(ms, p);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

function mergeTrendDays(prev: MetabolicTrend7dDay[], next: MetabolicTrend7dDay[]): MetabolicTrend7dDay[] {
  const map = new Map<string, MetabolicTrend7dDay>();
  for (const d of prev) map.set(d.dayKey, d);
  for (const d of next) map.set(d.dayKey, d);
  return [...map.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

function mergeSessions(prev: CompositionSession[], next: CompositionSession[]): CompositionSession[] {
  const map = new Map<string, CompositionSession>();
  for (const s of prev) map.set(`${s.dayKey}:${s.dateMs}`, s);
  for (const s of next) map.set(`${s.dayKey}:${s.dateMs}`, s);
  return [...map.values()].sort((a, b) => a.dateMs - b.dateMs);
}

/** Ensure chart calorie bars can render (re-link API sometimes returns enddate === startdate). */
function normalizeWorkoutSession(w: WorkoutSession): WorkoutSession {
  if (w.endMs > w.startMs) return w;
  return { ...w, endMs: w.startMs + 30 * 60 * 1000 };
}

function mergeWorkouts(prev: WorkoutSession[], next: WorkoutSession[]): WorkoutSession[] {
  const map = new Map<number, WorkoutSession>();
  const durationMs = (w: WorkoutSession) => Math.max(0, w.endMs - w.startMs);
  const prefer = (a: WorkoutSession, b: WorkoutSession): WorkoutSession => {
    const aDur = durationMs(a);
    const bDur = durationMs(b);
    if (aDur <= 0 && bDur > 0) return b;
    if (bDur <= 0 && aDur > 0) return a;
    if (bDur !== aDur) return bDur > aDur ? b : a;
    return b.kcal >= a.kcal ? b : a;
  };
  for (const w of prev) map.set(w.startMs, normalizeWorkoutSession(w));
  for (const w of next) {
    const existing = map.get(w.startMs);
    const normalized = normalizeWorkoutSession(w);
    map.set(w.startMs, existing ? prefer(existing, normalized) : normalized);
  }
  return [...map.values()].sort((a, b) => a.startMs - b.startMs);
}

function normalizeStore(raw: unknown): WithingsPersistedStore {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_STORE };
  const o = raw as Partial<WithingsPersistedStore>;
  return {
    version: 1,
    lastSyncedAt: typeof o.lastSyncedAt === 'string' ? o.lastSyncedAt : null,
    bodyScan: o.bodyScan && typeof o.bodyScan === 'object' ? o.bodyScan : null,
    bodyTrendDays: Array.isArray(o.bodyTrendDays) ? o.bodyTrendDays : [],
    bodyTrendSessions: Array.isArray(o.bodyTrendSessions) ? o.bodyTrendSessions : [],
    heartRate: Array.isArray(o.heartRate) ? o.heartRate : [],
    calories: Array.isArray(o.calories) ? o.calories : [],
    workouts: Array.isArray(o.workouts)
      ? o.workouts.map((w) => normalizeWorkoutSession(w as WorkoutSession))
      : [],
  };
}

export function mergeIntoWithingsStore(
  prev: WithingsPersistedStore,
  patch: Partial<WithingsPersistedStore>,
): WithingsPersistedStore {
  return {
    version: 1,
    lastSyncedAt: patch.lastSyncedAt ?? prev.lastSyncedAt,
    bodyScan: patch.bodyScan != null ? mergeBodyScan(prev.bodyScan, patch.bodyScan) : prev.bodyScan,
    bodyTrendDays:
      patch.bodyTrendDays != null
        ? mergeTrendDays(prev.bodyTrendDays, patch.bodyTrendDays)
        : prev.bodyTrendDays,
    bodyTrendSessions:
      patch.bodyTrendSessions != null
        ? mergeSessions(prev.bodyTrendSessions, patch.bodyTrendSessions)
        : prev.bodyTrendSessions,
    heartRate:
      patch.heartRate != null ? mergeByTimestamp(prev.heartRate, patch.heartRate) : prev.heartRate,
    calories:
      patch.calories != null ? mergeByTimestamp(prev.calories, patch.calories) : prev.calories,
    workouts: patch.workouts != null ? mergeWorkouts(prev.workouts, patch.workouts) : prev.workouts,
  };
}

export async function loadWithingsStore(): Promise<WithingsPersistedStore> {
  try {
    const raw = await AsyncStorage.getItem(WITHINGS_STORE_KEY);
    if (!raw) return { ...EMPTY_STORE };
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STORE };
  }
}

export async function saveWithingsStore(store: WithingsPersistedStore): Promise<void> {
  const trimmed: WithingsPersistedStore = {
    ...store,
    heartRate: trimIntradayHistory(store.heartRate),
    calories: trimIntradayHistory(store.calories),
  };
  await AsyncStorage.setItem(WITHINGS_STORE_KEY, JSON.stringify(trimmed));
}

/**
 * Pull from Withings API and merge into the local store.
 * Skips API when not linked or access token is not ready — returns cache (no mock injection).
 */
export async function syncWithingsStore(): Promise<WithingsPersistedStore> {
  const prev = await loadWithingsStore();
  const tokens = await loadWithingsTokens();
  if (!tokens?.refreshToken) {
    return prev;
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return prev;
  }

  try {
    // Fast path: today's intraday (1 API call) so the chart updates before 60-day backfill.
    const todayIntraday = await fetchIntradayToday();
    let working: WithingsPersistedStore = prev;
    if (todayIntraday.heartRate.length > 0 || todayIntraday.calories.length > 0) {
      working = {
        ...prev,
        lastSyncedAt: new Date().toISOString(),
        heartRate: mergeHeartRateWithFreshToday(prev.heartRate, [], todayIntraday.heartRate),
        calories: mergeCaloriesWithFreshToday(prev.calories, [], todayIntraday.calories),
      };
      await saveWithingsStore(working);
    }

    const [bodyScan, trend, intraday, workouts] = await Promise.all([
      fetchWeightMetrics(),
      fetchBodyCompositionTrend7d(),
      fetchHeartRateHistory(),
      fetchWorkoutsHistory(),
    ]);

    const heartRate = mergeHeartRateWithFreshToday(
      working.heartRate,
      intraday.heartRate,
      todayIntraday.heartRate,
    );
    const calories = mergeCaloriesWithFreshToday(
      working.calories,
      intraday.calories,
      todayIntraday.calories,
    );

    const merged: WithingsPersistedStore = {
      ...mergeIntoWithingsStore(working, {
        lastSyncedAt: new Date().toISOString(),
        bodyScan,
        bodyTrendDays: trend.days,
        bodyTrendSessions: trend.debug.sessions,
        ...(workouts.length > 0 ? { workouts } : {}),
      }),
      heartRate,
      calories,
    };

    let saveError: string | null = null;
    try {
      await saveWithingsStore(merged);
    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    }

    const diag = buildHrSyncDiag({
      apiToday: todayIntraday.heartRate,
      api7dToday: filterTodayHr(intraday.heartRate),
      storeBefore: working.heartRate,
      storeAfter: merged.heartRate,
      apiStatus: todayIntraday.apiStatus,
      apiError: todayIntraday.apiError,
      saveError,
      tokenScope: tokens.scope ?? null,
    });
    await saveWithingsHrSyncDiag(diag);

    return merged;
  } catch (err) {
    const diag = buildHrSyncDiag({
      apiToday: [],
      api7dToday: [],
      storeBefore: prev.heartRate,
      storeAfter: prev.heartRate,
      apiStatus: null,
      apiError: err instanceof Error ? err.message : 'sync failed',
      saveError: null,
      tokenScope: tokens.scope ?? null,
    });
    await saveWithingsHrSyncDiag(diag);
    return prev;
  }
}

/** Merge today's intraday HR + calories into the store (periodic refresh). */
export async function mergeTodayWithingsIntraday(
  todayHr: WithingsHeartRatePoint[],
  todayCal: WithingsCaloriePoint[],
  meta?: { apiStatus: number | null; apiError: string | null },
): Promise<WithingsPersistedStore> {
  const prev = await loadWithingsStore();
  const tokens = await loadWithingsTokens();
  const merged: WithingsPersistedStore = {
    ...prev,
    lastSyncedAt: new Date().toISOString(),
    heartRate: replaceTodayIntraday(prev.heartRate, todayHr),
    calories: replaceTodayIntraday(prev.calories, todayCal),
  };
  let saveError: string | null = null;
  try {
    await saveWithingsStore(merged);
  } catch (err) {
    saveError = err instanceof Error ? err.message : String(err);
  }
  const diag = buildHrSyncDiag({
    apiToday: todayHr,
    api7dToday: [],
    storeBefore: prev.heartRate,
    storeAfter: merged.heartRate,
    apiStatus: meta?.apiStatus ?? null,
    apiError: meta?.apiError ?? null,
    saveError,
    tokenScope: tokens?.scope ?? null,
  });
  await saveWithingsHrSyncDiag(diag);
  return merged;
}
