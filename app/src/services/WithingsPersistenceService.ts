/**
 * Local persistence for Withings metrics — single source of truth for the UI.
 * Sync adapters fetch from the API and merge into this store; screens read from here only.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CompositionSession, MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import {
  fetchBodyCompositionTrend7d,
  fetchHeartRateHistory,
  fetchWeightMetrics,
  fetchWorkoutsHistory,
  getValidAccessToken,
  loadWithingsTokens,
  type WeightMetricsForDashboard,
  type WithingsCaloriePoint,
  type WithingsHeartRatePoint,
  type WorkoutSession,
} from './WithingsApiService';

export const WITHINGS_STORE_KEY = 'healthings:withingsStore';

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

function mergeWorkouts(prev: WorkoutSession[], next: WorkoutSession[]): WorkoutSession[] {
  const map = new Map<number, WorkoutSession>();
  for (const w of prev) map.set(w.startMs, w);
  for (const w of next) map.set(w.startMs, w);
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
    workouts: Array.isArray(o.workouts) ? o.workouts : [],
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
  await AsyncStorage.setItem(WITHINGS_STORE_KEY, JSON.stringify(store));
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
    const [bodyScan, trend, intraday, workouts] = await Promise.all([
      fetchWeightMetrics(),
      fetchBodyCompositionTrend7d(),
      fetchHeartRateHistory(),
      fetchWorkoutsHistory(),
    ]);

    const merged = mergeIntoWithingsStore(prev, {
      lastSyncedAt: new Date().toISOString(),
      bodyScan,
      bodyTrendDays: trend.days,
      bodyTrendSessions: trend.debug.sessions,
      heartRate: intraday.heartRate,
      calories: intraday.calories,
      workouts,
    });
    await saveWithingsStore(merged);
    return merged;
  } catch {
    return prev;
  }
}

/** Merge today's intraday HR + calories into the store (periodic refresh). */
export async function mergeTodayWithingsIntraday(
  todayHr: WithingsHeartRatePoint[],
  todayCal: WithingsCaloriePoint[],
): Promise<WithingsPersistedStore> {
  const prev = await loadWithingsStore();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();

  const olderHr = prev.heartRate.filter((p) => Date.parse(p.timestamp) < todayStartMs);
  const olderCal = prev.calories.filter((p) => Date.parse(p.timestamp) < todayStartMs);

  const merged = mergeIntoWithingsStore(prev, {
    heartRate: [...olderHr, ...todayHr],
    calories: [...olderCal, ...todayCal],
    lastSyncedAt: new Date().toISOString(),
  });
  await saveWithingsStore(merged);
  return merged;
}
