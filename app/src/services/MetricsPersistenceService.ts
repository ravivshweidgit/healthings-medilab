/**
 * Local persistence for device metrics — single source of truth for the UI.
 * Sync adapters (Withings cloud, Health Connect) merge into this store; screens read here only.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { dayKeyStartMs, localDayKeyFromMs, type CompositionSession, type MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import { fetchHealthConnectActivity, PHONE_HEALTH_DEEP_LOOKBACK_DAYS, PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS } from './HealthConnectActivityService';
import { getManualBody } from './ManualBodyService';
import { getCachedHeightCm, getGender } from './TargetService';
import { healthKitService } from './HealthKitService';
import { dailyActiveKcalFromStepsMaps } from './SamsungStepsAdapter';
import {
  isHealthConnectActivity,
  isHealthKitActivity,
  isHealthKitHeartRate,
  isPhoneHealthActivity,
  isPhoneHealthHeartRate,
  loadSourceConfig,
} from './SourceConfigService';
import {
  fetchBodyCompositionTrend7d,
  fetchHeartRateHistory,
  fetchIntradayToday,
  fetchWeightMetrics,
  fetchWorkoutsHistory,
  getValidAccessToken,
  isKeepableWorkout,
  loadWithingsTokens,
  WITHINGS_HR_DEEP_LOOKBACK_DAYS,
  WITHINGS_SHALLOW_LOOKBACK_DAYS,
  WITHINGS_WORKOUT_DEEP_LOOKBACK_DAYS,
  type WeightMetricsForDashboard,
  type WithingsCaloriePoint,
  type WithingsHeartRatePoint,
  type WithingsWorkoutsFetch,
  type WorkoutSession,
} from './WithingsApiService';
import {
  buildHrSyncDiag,
  filterTodayHr,
  saveWithingsHrSyncDiag,
} from './withingsHrSyncDiag';

/** Canonical AsyncStorage key for body + activity metrics (Withings + Health Connect). */
export const METRICS_STORE_KEY = 'healthings:metricsStore';

/** @deprecated Migrated to METRICS_STORE_KEY on first load. */
export const LEGACY_WITHINGS_STORE_KEY = 'healthings:withingsStore';

/** @deprecated Migrated into METRICS_STORE_KEY on first load. */
export const LEGACY_HC_ACTIVITY_STORE_KEY = 'healthings:hcActivityStore';

/** @deprecated Use METRICS_STORE_KEY */
export const WITHINGS_STORE_KEY = METRICS_STORE_KEY;

/** Keep this many days of intraday HR/calories in AsyncStorage (chart pan is ≤16D). */
const MAX_INTRADAY_STORE_DAYS = 60;

export type MetricsPersistedStore = {
  version: 1;
  lastSyncedAt: string | null;
  bodyScan: WeightMetricsForDashboard | null;
  bodyTrendDays: MetabolicTrend7dDay[];
  bodyTrendSessions: CompositionSession[];
  heartRate: WithingsHeartRatePoint[];
  calories: WithingsCaloriePoint[];
  workouts: WorkoutSession[];
};

/** @deprecated Use MetricsPersistedStore */
export type WithingsPersistedStore = MetricsPersistedStore;

const EMPTY_STORE: MetricsPersistedStore = {
  version: 1,
  lastSyncedAt: null,
  bodyScan: null,
  bodyTrendDays: [],
  bodyTrendSessions: [],
  heartRate: [],
  calories: [],
  workouts: [],
};

export function hasMetricsData(store: MetricsPersistedStore): boolean {
  return (
    store.bodyScan != null ||
    store.bodyTrendDays.length > 0 ||
    store.heartRate.length > 0 ||
    store.calories.length > 0 ||
    store.workouts.length > 0
  );
}

/** @deprecated Use hasMetricsData */
export const hasWithingsData = hasMetricsData;

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

/** Drop aborted / sub-2-minute sessions. Do not invent end times (old 30m pad caused merge wins). */
function filterKeepableWorkouts(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions.filter(isKeepableWorkout);
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
  for (const w of filterKeepableWorkouts(prev)) map.set(w.startMs, w);
  for (const w of filterKeepableWorkouts(next)) {
    const existing = map.get(w.startMs);
    map.set(w.startMs, existing ? prefer(existing, w) : w);
  }
  return [...map.values()].sort((a, b) => a.startMs - b.startMs);
}

/** HC replace: keep Withings (and other non-HC) rows, swap in fresh HC sessions. */
function replaceHealthConnectWorkouts(prev: WorkoutSession[], hcWorkouts: WorkoutSession[]): WorkoutSession[] {
  const kept = prev.filter((w) => w.source !== 'health-connect');
  return mergeWorkouts(kept, hcWorkouts);
}

/**
 * Apply getworkouts to the store.
 * - Short aborts tombstone by startMs.
 * - Incomplete API rows (seen, not keepable): retain prior keepable cache.
 * - Inside lookback and not seen at all: drop (paginated fetch is authoritative).
 * - Outside lookback: retain prior keepable.
 */
function applyWithingsWorkoutsFetch(
  prev: WorkoutSession[],
  fetch: WithingsWorkoutsFetch,
): WorkoutSession[] {
  const abort = new Set(fetch.abortStartMs);
  const apiStarts = new Set(fetch.keepable.map((w) => w.startMs));
  const seen = new Set(fetch.seenStartMs);
  const hc = prev.filter((w) => w.source === 'health-connect');
  const retained = prev.filter((w) => {
    if (w.source === 'health-connect') return false;
    if (abort.has(w.startMs)) return false;
    if (apiStarts.has(w.startMs)) return false;
    if (!isKeepableWorkout(w)) return false;
    // API still lists this start but without a usable span — keep our prior copy.
    if (seen.has(w.startMs)) return true;
    // Older than this fetch window — keep.
    if (w.startMs < fetch.lookbackStartMs) return true;
    // Inside lookback and absent from full paginated result — gone.
    return false;
  });
  return mergeWorkouts([...hc, ...retained], fetch.keepable);
}

function applyDailyActiveKcalToTrendDays(
  days: MetabolicTrend7dDay[],
  dailyByDay: Record<string, number>,
  workouts: WorkoutSession[],
): MetabolicTrend7dDay[] {
  const workoutByDay = new Map<string, number>();
  for (const w of workouts) {
    const dk = localDayKeyFromMs(w.startMs);
    workoutByDay.set(dk, (workoutByDay.get(dk) ?? 0) + w.kcal);
  }

  const dayMap = new Map(days.map((d) => [d.dayKey, d]));
  const allKeys = new Set([...days.map((d) => d.dayKey), ...Object.keys(dailyByDay)]);

  const patched: MetabolicTrend7dDay[] = [];
  for (const dk of [...allKeys].sort()) {
    const base = dayMap.get(dk) ?? {
      dayKey: dk,
      weightKg: null,
      fatMassKg: null,
      muscleMassKg: null,
      visceralFatIndex: null,
      bmrKcalDay: null,
      activityKcalDay: null,
    };
    const hcDaily = dailyByDay[dk];
    let activityKcalDay = base.activityKcalDay;
    if (hcDaily != null && hcDaily > 0) {
      activityKcalDay = hcDaily;
    } else if (activityKcalDay == null) {
      const wkt = workoutByDay.get(dk);
      if (wkt != null) activityKcalDay = wkt;
    }
    patched.push({ ...base, activityKcalDay });
  }
  return patched;
}

function normalizeStore(raw: unknown): MetricsPersistedStore {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_STORE };
  const o = raw as Partial<MetricsPersistedStore>;
  return {
    version: 1,
    lastSyncedAt: typeof o.lastSyncedAt === 'string' ? o.lastSyncedAt : null,
    bodyScan: o.bodyScan && typeof o.bodyScan === 'object' ? o.bodyScan : null,
    bodyTrendDays: Array.isArray(o.bodyTrendDays) ? o.bodyTrendDays : [],
    bodyTrendSessions: Array.isArray(o.bodyTrendSessions) ? o.bodyTrendSessions : [],
    heartRate: Array.isArray(o.heartRate) ? o.heartRate : [],
    calories: Array.isArray(o.calories) ? o.calories : [],
    workouts: Array.isArray(o.workouts)
      ? filterKeepableWorkouts(o.workouts as WorkoutSession[])
      : [],
  };
}

type LegacyHcActivityStore = {
  workouts?: WorkoutSession[];
  heartRate?: WithingsHeartRatePoint[];
  dailyActiveKcalByDay?: Record<string, number>;
};

function mergeHealthConnectFetchIntoStore(
  prev: MetricsPersistedStore,
  fetch: {
    workouts: WorkoutSession[];
    heartRate: WithingsHeartRatePoint[];
    dailyActiveKcalByDay: Record<string, number>;
  },
  config: Awaited<ReturnType<typeof loadSourceConfig>>,
): MetricsPersistedStore {
  const workouts = replaceHealthConnectWorkouts(prev.workouts, fetch.workouts);
  const bodyTrendDays = applyDailyActiveKcalToTrendDays(
    prev.bodyTrendDays,
    fetch.dailyActiveKcalByDay,
    fetch.workouts,
  );
  const heartRate = isPhoneHealthHeartRate(config.heartRate)
    ? trimIntradayHistory(fetch.heartRate)
    : prev.heartRate;

  return {
    ...prev,
    lastSyncedAt: new Date().toISOString(),
    workouts,
    bodyTrendDays,
    heartRate,
  };
}

let migrationPromise: Promise<void> | null = null;

/** Merge legacy withings JSON + new metrics JSON (export + one-time migration). */
export function coalesceMetricsStores(
  metricsRaw: string | null,
  legacyWithingsRaw: string | null,
): MetricsPersistedStore {
  let store: MetricsPersistedStore = { ...EMPTY_STORE };
  if (legacyWithingsRaw) {
    try {
      store = normalizeStore(JSON.parse(legacyWithingsRaw));
    } catch {
      /* ignore corrupt legacy */
    }
  }
  if (metricsRaw) {
    try {
      const metrics = normalizeStore(JSON.parse(metricsRaw));
      store = mergeIntoMetricsStore(store, metrics);
    } catch {
      /* ignore corrupt metrics */
    }
  }
  return store;
}

async function runMigrationOnce(): Promise<void> {
  const metricsRaw = await AsyncStorage.getItem(METRICS_STORE_KEY);
  const legacyWithingsRaw = await AsyncStorage.getItem(LEGACY_WITHINGS_STORE_KEY);
  const legacyHcRaw = await AsyncStorage.getItem(LEGACY_HC_ACTIVITY_STORE_KEY);

  if (!metricsRaw && !legacyWithingsRaw && !legacyHcRaw) return;

  let store = coalesceMetricsStores(metricsRaw, legacyWithingsRaw);
  let dirty = legacyWithingsRaw != null;

  if (legacyHcRaw) {
    try {
      const hc = JSON.parse(legacyHcRaw) as LegacyHcActivityStore;
      const config = await loadSourceConfig();
      store = mergeHealthConnectFetchIntoStore(
        store,
        {
          workouts: Array.isArray(hc.workouts) ? hc.workouts : [],
          heartRate: Array.isArray(hc.heartRate) ? hc.heartRate : [],
          dailyActiveKcalByDay:
            hc.dailyActiveKcalByDay && typeof hc.dailyActiveKcalByDay === 'object'
              ? hc.dailyActiveKcalByDay
              : {},
        },
        config,
      );
      dirty = true;
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(LEGACY_HC_ACTIVITY_STORE_KEY);
  }

  if (legacyWithingsRaw) {
    await AsyncStorage.removeItem(LEGACY_WITHINGS_STORE_KEY);
  }

  if (dirty || (!metricsRaw && hasMetricsData(store))) {
    await saveMetricsStore(store);
  }
}

async function migrateLegacyStoresIfNeeded(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = runMigrationOnce();
  }
  await migrationPromise;
}

export function mergeIntoMetricsStore(
  prev: MetricsPersistedStore,
  patch: Partial<MetricsPersistedStore>,
): MetricsPersistedStore {
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

/** @deprecated Use mergeIntoMetricsStore */
export const mergeIntoWithingsStore = mergeIntoMetricsStore;

export async function loadMetricsStore(): Promise<MetricsPersistedStore> {
  await migrateLegacyStoresIfNeeded();
  try {
    const raw = await AsyncStorage.getItem(METRICS_STORE_KEY);
    if (!raw) return { ...EMPTY_STORE };
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STORE };
  }
}

/** @deprecated Use loadMetricsStore */
export const loadWithingsStore = loadMetricsStore;

export async function saveMetricsStore(store: MetricsPersistedStore): Promise<void> {
  const trimmed: MetricsPersistedStore = {
    ...store,
    heartRate: trimIntradayHistory(store.heartRate),
    calories: trimIntradayHistory(store.calories),
  };
  await AsyncStorage.setItem(METRICS_STORE_KEY, JSON.stringify(trimmed));
}

/** @deprecated Use saveMetricsStore */
export const saveWithingsStore = saveMetricsStore;

/** Pull from Health Connect and merge activity + HR into the metrics store. */
export async function syncHealthConnectIntoStore(
  prev?: MetricsPersistedStore,
  opts?: { deep?: boolean },
): Promise<MetricsPersistedStore> {
  if (Platform.OS !== 'android') {
    return prev ?? (await loadMetricsStore());
  }
  const base = prev ?? (await loadMetricsStore());
  const config = await loadSourceConfig();
  if (!isHealthConnectActivity(config.activity)) {
    return base;
  }

  const deep = wantsDeepPhoneHealthPull(base, opts, config.activity);
  const lookback = deep ? PHONE_HEALTH_DEEP_LOOKBACK_DAYS : PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS;
  const manual = await getManualBody();
  const [heightCm, gender] = await Promise.all([getCachedHeightCm(), getGender()]);
  const fetch = await fetchHealthConnectActivity(lookback, {
    weightKg: base.bodyScan?.weightKg ?? manual?.weight_kg ?? 70,
    heightCm: heightCm && heightCm > 0 ? heightCm : 170,
    gender,
  });
  const merged = mergeHealthConnectFetchIntoStore(base, fetch, config);
  await saveMetricsStore(merged);
  return merged;
}

/** Pull from Apple Health (steps energy + HR) when Withings watch is off. */
export async function syncHealthKitIntoStore(
  prev?: MetricsPersistedStore,
  opts?: { deep?: boolean },
): Promise<MetricsPersistedStore> {
  if (Platform.OS !== 'ios') {
    return prev ?? (await loadMetricsStore());
  }
  const base = prev ?? (await loadMetricsStore());
  const config = await loadSourceConfig();
  if (!isHealthKitActivity(config.activity) && !isHealthKitHeartRate(config.heartRate)) {
    return base;
  }

  const deep = wantsDeepPhoneHealthPull(base, opts, config.activity);
  const lookback = deep ? PHONE_HEALTH_DEEP_LOOKBACK_DAYS : PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS;
  const window = await healthKitService.fetchActivityWindow(lookback);
  let dailyActiveKcalByDay: Record<string, number> = {};
  if (isHealthKitActivity(config.activity)) {
    const start = new Date();
    start.setDate(start.getDate() - Math.max(1, lookback));
    const [stepsByDay, manual, heightCm, gender] = await Promise.all([
      healthKitService.fetchDailyStepTotals(start),
      getManualBody(),
      getCachedHeightCm(),
      getGender(),
    ]);
    dailyActiveKcalByDay = dailyActiveKcalFromStepsMaps(stepsByDay, {
      weightKg: base.bodyScan?.weightKg ?? manual?.weight_kg ?? 70,
      heightCm: heightCm && heightCm > 0 ? heightCm : 170,
      gender,
    });
  }
  const merged = mergeHealthConnectFetchIntoStore(
    base,
    {
      workouts: [],
      heartRate: isHealthKitHeartRate(config.heartRate) ? window.heartRate : [],
      dailyActiveKcalByDay,
    },
    config,
  );
  await saveMetricsStore(merged);
  return merged;
}

function wantsDeepPhoneHealthPull(
  store: MetricsPersistedStore,
  opts: { deep?: boolean } | undefined,
  activity: Awaited<ReturnType<typeof loadSourceConfig>>['activity'],
): boolean {
  if (opts?.deep) return true;
  if (!isPhoneHealthActivity(activity)) return false;
  // First fill: no HC workouts and no activity kcal on trend → deep once.
  const hasHcWorkout = store.workouts.some((w) => w.source === 'health-connect');
  const hasActivityKcal = store.bodyTrendDays.some(
    (d) => d.activityKcalDay != null && d.activityKcalDay > 0,
  );
  return !hasHcWorkout && !hasActivityKcal;
}

/**
 * Pull from Withings API and merge into the local store.
 * Skips API when not linked — returns cache unchanged.
 *
 * Default is **shallow** (yesterday + today) when persistence already has history.
 * **Deep** (HR 60d / workouts 128d) runs when `options.deep` is set, or automatically
 * on first link when the relevant store slices are empty.
 */
export type SyncWithingsOptions = {
  /** Force full history pull from Withings. */
  deep?: boolean;
};

export type SyncMetricsOptions = SyncWithingsOptions;

function wantsDeepWithingsPull(
  store: MetricsPersistedStore,
  opts: SyncWithingsOptions | undefined,
  useWithingsHr: boolean,
  useWithingsActivity: boolean,
): boolean {
  if (opts?.deep) return true;
  // First link / wiped HR slice — pull full history once; later syncs stay shallow.
  if (useWithingsHr && store.heartRate.length === 0) return true;
  // Activity without HR (rare): deep only when the store has no Withings footprint yet.
  if (
    !useWithingsHr &&
    useWithingsActivity &&
    !store.bodyScan &&
    !store.workouts.some((w) => w.source !== 'health-connect' && isKeepableWorkout(w))
  ) {
    return true;
  }
  return false;
}

export async function syncWithingsApiIntoStore(
  prev?: MetricsPersistedStore,
  opts?: SyncWithingsOptions,
): Promise<MetricsPersistedStore> {
  const base = prev ?? (await loadMetricsStore());
  const config = await loadSourceConfig();
  const useWithingsActivity = config.activity === 'withings';
  const useWithingsHr = config.heartRate === 'withings';

  const tokens = await loadWithingsTokens();
  if (!tokens?.refreshToken) {
    return base;
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return base;
  }

  const deep = wantsDeepWithingsPull(base, opts, useWithingsHr, useWithingsActivity);
  const hrLookback = deep ? WITHINGS_HR_DEEP_LOOKBACK_DAYS : WITHINGS_SHALLOW_LOOKBACK_DAYS;
  const workoutLookback = deep
    ? WITHINGS_WORKOUT_DEEP_LOOKBACK_DAYS
    : WITHINGS_SHALLOW_LOOKBACK_DAYS;

  try {
    const todayIntraday = await fetchIntradayToday();
    let working: MetricsPersistedStore = base;
    const todayHr = useWithingsHr ? todayIntraday.heartRate : [];
    const todayCal = todayIntraday.calories;
    if (todayHr.length > 0 || todayCal.length > 0) {
      working = {
        ...base,
        lastSyncedAt: new Date().toISOString(),
        ...(useWithingsHr
          ? { heartRate: mergeHeartRateWithFreshToday(base.heartRate, [], todayHr) }
          : {}),
        calories: mergeCaloriesWithFreshToday(base.calories, [], todayCal),
      };
      await saveMetricsStore(working);
    }

    const [bodyScanRes, trendRes, intradayRes, workoutsRes] = await Promise.allSettled([
      fetchWeightMetrics(),
      fetchBodyCompositionTrend7d(),
      useWithingsHr
        ? fetchHeartRateHistory(hrLookback)
        : Promise.resolve({ heartRate: [], calories: [] }),
      useWithingsActivity
        ? fetchWorkoutsHistory(workoutLookback)
        : Promise.resolve({
            keepable: [],
            abortStartMs: [],
            seenStartMs: [],
            lookbackStartMs: 0,
          } satisfies WithingsWorkoutsFetch),
    ]);

    const bodyScan =
      bodyScanRes.status === 'fulfilled' ? bodyScanRes.value : working.bodyScan;
    const trend =
      trendRes.status === 'fulfilled'
        ? trendRes.value
        : { days: working.bodyTrendDays, debug: { sessions: working.bodyTrendSessions } };
    const intraday =
      intradayRes.status === 'fulfilled'
        ? intradayRes.value
        : { heartRate: [] as WithingsHeartRatePoint[], calories: [] as WithingsCaloriePoint[] };
    const workoutsFetch =
      workoutsRes.status === 'fulfilled' ? workoutsRes.value : null;

    const heartRate = useWithingsHr
      ? mergeHeartRateWithFreshToday(working.heartRate, intraday.heartRate, todayHr)
      : working.heartRate;
    const calories = mergeCaloriesWithFreshToday(
      working.calories,
      intraday.calories,
      todayCal,
    );

    const mergedBase = mergeIntoMetricsStore(working, {
      lastSyncedAt: new Date().toISOString(),
      bodyScan: bodyScan ?? undefined,
      bodyTrendDays: trend.days,
      bodyTrendSessions: trend.debug.sessions,
    });
    const merged: MetricsPersistedStore = {
      ...mergedBase,
      ...(useWithingsActivity && workoutsFetch != null
        ? { workouts: applyWithingsWorkoutsFetch(working.workouts, workoutsFetch) }
        : {}),
      heartRate,
      calories,
    };

    let saveError: string | null = null;
    try {
      await saveMetricsStore(merged);
    } catch (err) {
      saveError = err instanceof Error ? err.message : String(err);
    }

    const diag = buildHrSyncDiag({
      apiToday: todayHr,
      api7dToday: useWithingsHr ? filterTodayHr(intraday.heartRate) : [],
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
      storeBefore: base.heartRate,
      storeAfter: base.heartRate,
      apiStatus: null,
      apiError: err instanceof Error ? err.message : 'sync failed',
      saveError: null,
      tokenScope: tokens.scope ?? null,
    });
    await saveWithingsHrSyncDiag(diag);
    return base;
  }
}

/**
 * Sync all configured adapters into the metrics store (Withings + phone health).
 * UI and mentors should call this — not vendor-specific sync helpers.
 * Pass `{ deep: true }` for full Withings history and phone-health deep lookback (31d).
 * Default phone-health sync is shallow (2d), same as Withings normal sync.
 */
export async function syncMetricsStore(
  opts?: SyncMetricsOptions,
): Promise<MetricsPersistedStore> {
  let store = await loadMetricsStore();
  store = await syncWithingsApiIntoStore(store, opts);
  store = await syncHealthConnectIntoStore(store, opts);
  store = await syncHealthKitIntoStore(store, opts);
  return store;
}

/** @deprecated Use syncMetricsStore */
export const syncWithingsStore = syncMetricsStore;

/** Merge today's intraday HR + calories into the store (periodic Withings refresh). */
export async function mergeTodayWithingsIntraday(
  todayHr: WithingsHeartRatePoint[],
  todayCal: WithingsCaloriePoint[],
  meta?: { apiStatus: number | null; apiError: string | null },
): Promise<MetricsPersistedStore> {
  const prev = await loadMetricsStore();
  const config = await loadSourceConfig();
  const tokens = await loadWithingsTokens();
  const merged: MetricsPersistedStore = {
    ...prev,
    lastSyncedAt: new Date().toISOString(),
    heartRate:
      config.heartRate === 'withings'
        ? replaceTodayIntraday(prev.heartRate, todayHr)
        : prev.heartRate,
    calories: replaceTodayIntraday(prev.calories, todayCal),
  };
  let saveError: string | null = null;
  try {
    await saveMetricsStore(merged);
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
