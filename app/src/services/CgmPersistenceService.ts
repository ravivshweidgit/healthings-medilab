/**
 * CGM persistence — local store is the source of truth for glucose.
 * Health Connect / CSV import are sync adapters that merge into this store.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CgmSessionStart } from '../logic/cgmWarmupFilter';
import { calculateMetabolicEfficiency, type ActivityZone } from '../logic/MetabolicLogic';
import { generateDemoRecentMetrics } from './demoHealthMetrics';
import type { HealthDataSource } from './healthRuntime';
import { getHealthDataSource } from './healthRuntime';
import {
  HEALTH_METRICS_CACHE_KEY,
  loadCachedHealthMetrics,
  mergeCgmSessionStarts,
  mergeGlucoseTimePoints,
  prepareGlucoseSeries,
  type CachedHealthMetrics,
} from './healthMetricsCache';
import { healthConnectService, type RecentMetrics, type TimePoint } from './HealthConnectService';

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

/**
 * Merge imported CSV glucose into the local store (CSV wins on duplicate instants).
 */
export async function mergeImportedGlucoseIntoStore(
  importedRaw: TimePoint[],
  importedSessionStarts: CgmSessionStart[] | undefined,
  dataSource: HealthDataSource,
): Promise<CgmSyncResult & { csvCount: number; hcCount: number; mergedRawCount: number; chartCount: number; sessionCount: number }> {
  const prev = await loadCgmStore();
  let hcGlucose: TimePoint[] = [];
  if (dataSource === 'health-connect') {
    try {
      await healthConnectService.initializeAndRequestPermissions();
      hcGlucose = (await healthConnectService.fetchRecentMetrics()).glucose;
    } catch {
      // Non-fatal: CSV import still applies from file + cache.
    }
  }

  const mergedRaw = mergeGlucoseTimePoints([
    prev?.glucose ?? [],
    hcGlucose,
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
    hcCount: hcGlucose.length,
    mergedRawCount: mergedRaw.length,
    chartCount: view.glucoseData.length,
    sessionCount: view.cgmSessionStarts.length,
  };
}

/**
 * Pull from Health Connect (or demo source) and merge into the local CGM store.
 * Returns cached store when sync is unavailable — never wipes existing data.
 */
export async function syncCgmStore(dataSource?: HealthDataSource): Promise<CgmSyncResult | null> {
  const source = dataSource ?? getHealthDataSource();
  const prev = await loadCgmStore();

  if (source !== 'health-connect') {
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
    await healthConnectService.initializeAndRequestPermissions();
    const hc = await healthConnectService.fetchRecentMetrics();
    const mergedRaw = mergeGlucoseTimePoints([prev?.glucose ?? [], hc.glucose]);
    const store = storeFromGlucose(mergedRaw, prev?.cgmSessionStarts);
    await saveCgmStore(store);
    const view = buildViewState(store, hc.steps ?? [], hc.heartRate ?? []);
    return { store, view };
  } catch {
    if (hasCgmData(prev)) {
      return { store: prev!, view: buildViewState(prev!) };
    }
    return null;
  }
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

/** @deprecated use loadCgmStore — kept for existing imports */
export { HEALTH_METRICS_CACHE_KEY };
