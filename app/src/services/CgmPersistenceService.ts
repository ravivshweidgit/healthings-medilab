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
import { syncPerfTrack } from './SyncPerf';

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

export async function loadCgmStore(): Promise<CgmStore | null> {
  return loadCachedHealthMetrics();
}

export async function saveCgmStore(store: CgmStore): Promise<void> {
  await AsyncStorage.setItem(HEALTH_METRICS_CACHE_KEY, JSON.stringify(store));
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
  }
> {
  const prev = await loadCgmStore();
  let liveGlucose: TimePoint[] = [];
  if (isLiveCgmDataSource(dataSource)) {
    try {
      liveGlucose = (await fetchLiveGlucose(dataSource)).glucose;
    } catch {
      // Non-fatal: CSV import still applies from file + cache.
    }
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
  };
}

/**
 * Pull from Health Connect / HealthKit (or demo source) and merge into the local CGM store.
 * Returns cached store when sync is unavailable — never wipes existing data.
 */
export async function syncCgmStore(dataSource?: HealthDataSource): Promise<CgmSyncResult | null> {
  return syncPerfTrack('syncCgmStore', async () => {
  const source = dataSource ?? getHealthDataSource();
  const prev = await loadCgmStore();

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
    const mergedRaw = mergeGlucoseTimePoints([prev?.glucose ?? [], live.glucose]);
    const store = storeFromGlucose(mergedRaw, prev?.cgmSessionStarts);
    await syncPerfTrack('cgm/saveStore', () => saveCgmStore(store));
    const view = buildViewState(store, live.steps ?? [], live.heartRate ?? []);
    return { store, view };
  } catch {
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
