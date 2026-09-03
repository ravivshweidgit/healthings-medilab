/**
 * CGM persistence — local store is the source of truth for glucose.
 * Health Connect / HealthKit / CSV import are sync adapters that merge into this store.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CgmSessionStart } from '../logic/cgmWarmupFilter';
import { calculateMetabolicEfficiency, type ActivityZone } from '../logic/MetabolicLogic';
import { generateDemoRecentMetrics } from './demoHealthMetrics';
import type { HealthDataSource } from './healthRuntime';
import { getHealthDataSource, isLiveCgmDataSource } from './healthRuntime';
import {
  HEALTH_METRICS_CACHE_KEY,
  loadCachedHealthMetrics,
  mergeCgmSessionStarts,
  mergeGlucoseTimePoints,
  prepareGlucoseSeries,
  type CachedHealthMetrics,
} from './healthMetricsCache';
import { healthConnectService, type RecentMetrics, type TimePoint } from './HealthConnectService';
import { healthKitService } from './HealthKitService';
import { appLog, flushAppLogWrites } from './AppDailyLogService';
import { isSqliteFullError } from './asyncStorageFull';
import { latestGlucosePoint, saveCgmSyncDiag } from './cgmSyncDiag';
import { syncPerfTrack } from './SyncPerf';

export type CgmSyncReason = 'boot' | 'interval' | 'foreground' | 'expand' | 'pull' | 'manual' | 'unknown';

export type CgmStore = CachedHealthMetrics;

export type CgmViewState = {
  glucoseData: TimePoint[];
  cgmSessionStarts: CgmSessionStart[];
  cgmStatSummary: string | null;
  stepsData: TimePoint[];
  heartRateData: TimePoint[];
  efficiencyScore: number;
  insight: string;
  activityZones: ActivityZone[];
};

export type CgmSyncResult = {
  store: CgmStore;
  view: CgmViewState;
};

export function hasCgmData(store: CgmStore | null | undefined): boolean {
  return (store?.glucose?.length ?? 0) > 0;
}

export function viewFromCgmStore(store: CgmStore): CgmViewState {
  return buildViewState(store, []);
}

/** Cap persisted CGM history — 26k+ points was filling AsyncStorage (SQLITE_FULL). */
const CGM_STORE_RETAIN_DAYS = 90;
const CGM_STORE_EMERGENCY_RETAIN_DAYS = 45;

function pruneGlucosePoints(glucose: TimePoint[], retainDays: number): TimePoint[] {
  if (glucose.length === 0) return glucose;
  const cutoff = Date.now() - Math.max(1, retainDays) * 24 * 60 * 60 * 1000;
  return glucose.filter((p) => {
    const ms = Date.parse(p.timestamp);
    return Number.isFinite(ms) && ms >= cutoff;
  });
}

function pruneCgmStore(store: CgmStore, retainDays: number): CgmStore {
  const cutoff = Date.now() - Math.max(1, retainDays) * 24 * 60 * 60 * 1000;
  return {
    glucose: pruneGlucosePoints(store.glucose, retainDays),
    cgmSessionStarts: (store.cgmSessionStarts ?? []).filter((s) => s.startMs >= cutoff),
  };
}

export async function loadCgmStore(): Promise<CgmStore | null> {
  return loadCachedHealthMetrics();
}

export async function saveCgmStore(store: CgmStore): Promise<void> {
  const pruned = pruneCgmStore(store, CGM_STORE_RETAIN_DAYS);
  try {
    await AsyncStorage.setItem(HEALTH_METRICS_CACHE_KEY, JSON.stringify(pruned));
  } catch (err) {
    if (!isSqliteFullError(err)) throw err;
    const emergency = pruneCgmStore(pruned, CGM_STORE_EMERGENCY_RETAIN_DAYS);
    appLog('WARN', 'cgm/save_prune', {
      from_n: store.glucose.length,
      to_n: emergency.glucose.length,
      retain_d: CGM_STORE_EMERGENCY_RETAIN_DAYS,
    });
    await AsyncStorage.setItem(HEALTH_METRICS_CACHE_KEY, JSON.stringify(emergency));
  }
}

function buildViewState(store: CgmStore, hcSteps: TimePoint[] = [], hcHr: TimePoint[] = []): CgmViewState {
  const { filtered, sessionStarts, statFilter } = prepareGlucoseSeries(
    store.glucose,
    store.cgmSessionStarts,
  );
  const efficiency = calculateMetabolicEfficiency(filtered, hcSteps);
  return {
    glucoseData: filtered,
    cgmSessionStarts: sessionStarts,
    cgmStatSummary: statFilter.summaryLine,
    stepsData: hcSteps,
    heartRateData: hcHr,
    efficiencyScore: efficiency.efficiencyScore,
    insight: efficiency.insight,
    activityZones: efficiency.activityZones,
  };
}

function storeFromGlucose(
  glucose: TimePoint[],
  sessionStarts?: CgmSessionStart[],
): CgmStore {
  const { raw, sessionStarts: mergedStarts } = prepareGlucoseSeries(glucose, sessionStarts);
  return {
    glucose: raw,
    cgmSessionStarts: mergedStarts,
  };
}

/** Routine CGM pull — recent days only; full history stays in local store from prior syncs/imports. */
const CGM_SHALLOW_LOOKBACK_DAYS = 3;
/** First fill / empty store. */
const CGM_DEEP_LOOKBACK_DAYS = 120;

async function fetchLiveGlucose(
  dataSource: HealthDataSource,
  lookbackDays: number = CGM_SHALLOW_LOOKBACK_DAYS,
): Promise<RecentMetrics> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (Math.max(1, lookbackDays) - 1));

  if (dataSource === 'healthkit') {
    await healthKitService.initializeAndRequestPermissions();
    return healthKitService.fetchRecentMetrics(start);
  }
  await healthConnectService.ensureGlucoseReadable();
  return healthConnectService.fetchRecentMetrics(start);
}

/**
 * Merge imported CSV glucose into the local store (CSV wins on duplicate instants).
 */
export async function mergeImportedGlucoseIntoStore(
  importedRaw: TimePoint[],
  importedSessionStarts: CgmSessionStart[] | undefined,
  dataSource: HealthDataSource,
): Promise<
  CgmSyncResult & {
    csvCount: number;
    hcCount: number;
    mergedRawCount: number;
    chartCount: number;
    sessionCount: number;
    /** How many CSV timestamps were not already in the local store. */
    newPointsAdded: number;
  }
> {
  const prev = await loadCgmStore();
  const prevMs = new Set(
    (prev?.glucose ?? [])
      .map((p) => new Date(p.timestamp).getTime())
      .filter((ms) => !Number.isNaN(ms)),
  );
  let liveGlucose: TimePoint[] = [];
  if (isLiveCgmDataSource(dataSource)) {
    try {
      liveGlucose = (await fetchLiveGlucose(dataSource)).glucose;
    } catch {
      // Non-fatal: CSV import still applies from file + cache.
    }
  }

  let newPointsAdded = 0;
  for (const p of importedRaw) {
    const ms = new Date(p.timestamp).getTime();
    if (!Number.isNaN(ms) && p.value > 0 && !prevMs.has(ms)) newPointsAdded += 1;
  }

  const mergedRaw = mergeGlucoseTimePoints([
    prev?.glucose ?? [],
    liveGlucose,
    importedRaw,
  ]);
  const sessionStarts = mergeCgmSessionStarts(prev?.cgmSessionStarts, importedSessionStarts);
  const store = storeFromGlucose(mergedRaw, sessionStarts);
  await saveCgmStore(store);
  const view = buildViewState(store, []);
  return {
    store,
    view,
    csvCount: importedRaw.length,
    hcCount: liveGlucose.length,
    mergedRawCount: mergedRaw.length,
    chartCount: view.glucoseData.length,
    sessionCount: view.cgmSessionStarts.length,
    newPointsAdded,
  };
}

/**
 * Pull from Health Connect / HealthKit (or demo source) and merge into the local CGM store.
 * Returns cached store when sync is unavailable — never wipes existing data.
 */
export async function syncCgmStore(
  dataSource?: HealthDataSource,
  opts?: { reason?: CgmSyncReason },
): Promise<CgmSyncResult | null> {
  return syncPerfTrack('syncCgmStore', async () => {
  const source = dataSource ?? getHealthDataSource();
  const reason: CgmSyncReason = opts?.reason ?? 'unknown';
  const prev = await loadCgmStore();
  const prevLatest = latestGlucosePoint(prev?.glucose ?? []);

  if (!isLiveCgmDataSource(source)) {
    if (hasCgmData(prev)) {
      return { store: prev!, view: buildViewState(prev!) };
    }
    const metrics = generateDemoRecentMetrics();
    const store = storeFromGlucose(metrics.glucose);
    await saveCgmStore(store);
    const view = buildViewState(store, metrics.steps ?? [], metrics.heartRate ?? []);
    return { store, view };
  }

  try {
    const lookback = hasCgmData(prev) ? CGM_SHALLOW_LOOKBACK_DAYS : CGM_DEEP_LOOKBACK_DAYS;
    const live = await syncPerfTrack(`cgm/fetchLiveGlucose(${lookback}d)`, () =>
      fetchLiveGlucose(source, lookback),
    );
    const mergedRaw = pruneGlucosePoints(
      mergeGlucoseTimePoints([prev?.glucose ?? [], live.glucose]),
      CGM_STORE_RETAIN_DAYS,
    );
    const store = storeFromGlucose(mergedRaw, prev?.cgmSessionStarts);
    let saveOk = 1;
    try {
      await syncPerfTrack('cgm/saveStore', () => saveCgmStore(store));
    } catch (saveErr) {
      // HC merge succeeded — still paint the live edge even if disk is full.
      saveOk = 0;
      appLog('WARN', 'cgm/save_fail', {
        reason,
        message: (saveErr instanceof Error ? saveErr.message : 'save_failed').slice(0, 160),
        store_n: store.glucose.length,
      });
    }
    const view = buildViewState(store, live.steps ?? [], live.heartRate ?? []);
    const liveLatest = latestGlucosePoint(live.glucose);
    const viewLatest = latestGlucosePoint(view.glucoseData);
    const nowMs = Date.now();
    const lagSec =
      viewLatest != null ? Math.max(0, Math.round((nowMs - viewLatest.ms) / 1000)) : null;
    const filterDropN = Math.max(0, store.glucose.length - view.glucoseData.length);
    const fields = {
      reason,
      source,
      lookback_d: lookback,
      live_n: live.glucose.length,
      store_n: store.glucose.length,
      view_n: view.glucoseData.length,
      filter_drop_n: filterDropN,
      save_ok: saveOk,
      prev_last: prevLatest?.ts ?? null,
      live_last: liveLatest?.ts ?? null,
      view_last: viewLatest?.ts ?? null,
      live_last_mgdl: liveLatest?.mgdl ?? null,
      view_last_mgdl: viewLatest?.mgdl ?? null,
      lag_sec: lagSec,
    };
    appLog('INFO', 'cgm/sync', fields);
    void saveCgmSyncDiag({
      at: new Date().toISOString(),
      reason,
      source,
      lookbackDays: lookback,
      liveN: live.glucose.length,
      storeN: store.glucose.length,
      viewN: view.glucoseData.length,
      filterDropN,
      prevLast: prevLatest?.ts ?? null,
      liveLast: liveLatest?.ts ?? null,
      viewLast: viewLatest?.ts ?? null,
      liveLastMgdl: liveLatest?.mgdl ?? null,
      viewLastMgdl: viewLatest?.mgdl ?? null,
      lagSec,
      error: saveOk ? null : 'save_failed',
    });
    void flushAppLogWrites();
    return { store, view };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cgm_sync_failed';
    appLog('WARN', 'cgm/sync_fail', {
      reason,
      source,
      message: message.slice(0, 160),
      prev_last: prevLatest?.ts ?? null,
      store_n: prev?.glucose.length ?? 0,
    });
    void saveCgmSyncDiag({
      at: new Date().toISOString(),
      reason,
      source,
      lookbackDays: hasCgmData(prev) ? CGM_SHALLOW_LOOKBACK_DAYS : CGM_DEEP_LOOKBACK_DAYS,
      liveN: 0,
      storeN: prev?.glucose.length ?? 0,
      viewN: 0,
      filterDropN: 0,
      prevLast: prevLatest?.ts ?? null,
      liveLast: null,
      viewLast: null,
      liveLastMgdl: null,
      viewLastMgdl: null,
      lagSec: null,
      error: message.slice(0, 200),
    });
    void flushAppLogWrites();
    if (hasCgmData(prev)) {
      return { store: prev!, view: buildViewState(prev!) };
    }
    return null;
  }
  });
}

/** Read persisted CGM for mentor/review blocks (no API). */
export async function loadCgmViewFromStore(appGlucose?: TimePoint[] | null): Promise<{
  store: CgmStore;
  glucose: TimePoint[];
  glucoseRaw: TimePoint[];
  cgmSessionStarts: CgmSessionStart[];
  cgmStatSummary: string | null;
}> {
  const cached = await loadCgmStore();
  const mergedRaw = mergeGlucoseTimePoints([cached?.glucose ?? [], appGlucose ?? []]);
  const { filtered, sessionStarts, statFilter } = prepareGlucoseSeries(
    mergedRaw,
    cached?.cgmSessionStarts,
  );
  return {
    store: { glucose: mergedRaw, cgmSessionStarts: sessionStarts },
    glucose: filtered,
    glucoseRaw: mergedRaw,
    cgmSessionStarts: sessionStarts,
    cgmStatSummary: statFilter.summaryLine,
  };
}
