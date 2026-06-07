import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { calculateMetabolicEfficiency, type ActivityZone } from '../logic/MetabolicLogic';
import type { CgmSessionStart } from '../logic/cgmWarmupFilter';
import { generateDemoRecentMetrics } from '../services/demoHealthMetrics';
import type { HealthDataSource } from '../services/healthRuntime';
import { getHealthDataSource } from '../services/healthRuntime';
import {
  HEALTH_METRICS_CACHE_KEY,
  loadCachedHealthMetrics,
  mergeCgmSessionStarts,
  mergeGlucoseTimePoints,
  prepareGlucoseSeries,
  type CachedHealthMetrics,
} from '../services/healthMetricsCache';
import { samsungHealthService, type RecentMetrics, type TimePoint } from '../services/SamsungHealthService';

export type HealthSyncResult = {
  metrics: RecentMetrics;
  efficiencyScore: number;
  insight: string;
  activityZones: ActivityZone[];
};

export type GlucoseImportResult = {
  csvCount: number;
  hcCount: number;
  mergedRawCount: number;
  chartCount: number;
  sessionCount: number;
};

type HealthDataState = {
  glucoseData: TimePoint[];
  cgmSessionStarts: CgmSessionStart[];
  cgmStatSummary: string | null;
  stepsData: TimePoint[];
  heartRateData: TimePoint[];
  efficiencyScore: number;
  insight: string;
  activityZones: ActivityZone[];
};

const CACHE_KEY = HEALTH_METRICS_CACHE_KEY;

function persistMetrics(metrics: CachedHealthMetrics): void {
  void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(metrics));
}

function applyGlucoseToMetrics(
  metrics: RecentMetrics,
  knownSessionStarts?: CgmSessionStart[],
): {
  metrics: CachedHealthMetrics;
  filtered: TimePoint[];
  sessionStarts: CgmSessionStart[];
  cgmStatSummary: string | null;
} {
  const { filtered, sessionStarts, raw, statFilter } = prepareGlucoseSeries(
    metrics.glucose,
    knownSessionStarts,
  );
  return {
    metrics: {
      glucose: raw,
      cgmSessionStarts: sessionStarts,
    },
    filtered,
    sessionStarts,
    cgmStatSummary: statFilter.summaryLine,
  };
}

const emptyState: HealthDataState = {
  glucoseData: [],
  cgmSessionStarts: [],
  cgmStatSummary: null,
  stepsData: [],
  heartRateData: [],
  efficiencyScore: 0,
  insight: 'Waiting for first sync...',
  activityZones: [],
};

export const useHealthData = () => {
  const [state, setState] = useState<HealthDataState>(emptyState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource] = useState<HealthDataSource>(() => getHealthDataSource());
  const refetchInFlight = useRef<Promise<HealthSyncResult | null> | null>(null);
  const glucoseSyncLock = useRef<Promise<void>>(Promise.resolve());

  const withGlucoseSyncLock = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    const prev = glucoseSyncLock.current;
    let release!: () => void;
    glucoseSyncLock.current = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }, []);

  const applyMetrics = useCallback((metrics: RecentMetrics, knownSessionStarts?: CgmSessionStart[]) => {
    const { metrics: cached, filtered, sessionStarts, cgmStatSummary } = applyGlucoseToMetrics(
      metrics,
      knownSessionStarts,
    );
    const efficiency = calculateMetabolicEfficiency(filtered, metrics.steps ?? []);
    setState({
      glucoseData: filtered,
      cgmSessionStarts: sessionStarts,
      cgmStatSummary,
      stepsData: metrics.steps ?? [],
      heartRateData: metrics.heartRate ?? [],
      efficiencyScore: efficiency.efficiencyScore,
      insight: efficiency.insight,
      activityZones: efficiency.activityZones,
    });
    persistMetrics(cached);
  }, []);

  const applyImportedGlucose = useCallback(
    async (importedRaw: TimePoint[], importedSessionStarts?: CgmSessionStart[]): Promise<GlucoseImportResult> => {
      return withGlucoseSyncLock(async () => {
        const cached = await loadCachedHealthMetrics();
        let hcGlucose: TimePoint[] = [];
        if (dataSource === 'health-connect') {
          try {
            await samsungHealthService.initializeAndRequestPermissions();
            hcGlucose = (await samsungHealthService.fetchRecentMetrics()).glucose;
          } catch {
            // Non-fatal: CSV import still applies from file + cache.
          }
        }

        // Later sources win on duplicate instants: CSV > HC > cache.
        const mergedRaw = mergeGlucoseTimePoints([
          cached?.glucose ?? [],
          hcGlucose,
          importedRaw,
        ]);
        const sessionStarts = mergeCgmSessionStarts(
          cached?.cgmSessionStarts,
          importedSessionStarts,
        );
        const { metrics: toStore, filtered, sessionStarts: allStarts, cgmStatSummary } =
          applyGlucoseToMetrics({ glucose: mergedRaw }, sessionStarts);
        persistMetrics(toStore);
        const eff = calculateMetabolicEfficiency(filtered, []);
        setState((prev) => ({
          ...prev,
          glucoseData: filtered,
          cgmSessionStarts: allStarts,
          cgmStatSummary,
          efficiencyScore: eff.efficiencyScore,
          insight: eff.insight,
          activityZones: eff.activityZones,
        }));
        return {
          csvCount: importedRaw.length,
          hcCount: hcGlucose.length,
          mergedRawCount: mergedRaw.length,
          chartCount: filtered.length,
          sessionCount: allStarts.length,
        };
      });
    },
    [dataSource, withGlucoseSyncLock],
  );

  const refetch = useCallback(async (): Promise<HealthSyncResult | null> => {
    if (refetchInFlight.current) {
      return refetchInFlight.current;
    }

    const run = withGlucoseSyncLock(async (): Promise<HealthSyncResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        if (dataSource !== 'health-connect') {
          const metrics = generateDemoRecentMetrics();
          applyMetrics(metrics);
          const { filtered } = prepareGlucoseSeries(metrics.glucose);
          const efficiency = calculateMetabolicEfficiency(filtered, metrics.steps ?? []);
          return {
            metrics,
            efficiencyScore: efficiency.efficiencyScore,
            insight: efficiency.insight,
            activityZones: efficiency.activityZones,
          };
        }

        await samsungHealthService.initializeAndRequestPermissions();
        const metrics = await samsungHealthService.fetchRecentMetrics();
        const cached = await loadCachedHealthMetrics();
        // HC wins on duplicate instant; keep CSV history from cache (prompt21 PART A).
        const mergedRaw = mergeGlucoseTimePoints([cached?.glucose ?? [], metrics.glucose]);
        const knownStarts = cached?.cgmSessionStarts;
        const mergedMetrics: RecentMetrics = { glucose: mergedRaw };
        applyMetrics(mergedMetrics, knownStarts);
        const { filtered } = prepareGlucoseSeries(mergedRaw, knownStarts);
        const efficiency = calculateMetabolicEfficiency(filtered, metrics.steps ?? []);
        return {
          metrics: mergedMetrics,
          efficiencyScore: efficiency.efficiencyScore,
          insight: efficiency.insight,
          activityZones: efficiency.activityZones,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to sync health data.';
        const cached = await loadCachedHealthMetrics();
        const hasCachedGlucose = (cached?.glucose?.length ?? 0) > 0;
        // Background refetch can fail transiently while cache + chart are still valid — avoid error flash.
        setError(hasCachedGlucose ? null : message);
        return null;
      } finally {
        setIsLoading(false);
      }
    });

    refetchInFlight.current = run;
    try {
      return await run;
    } finally {
      refetchInFlight.current = null;
    }
  }, [applyMetrics, dataSource, withGlucoseSyncLock]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as CachedHealthMetrics;
          applyMetrics(parsed, parsed.cgmSessionStarts);
          setIsLoading(false);
        }
      } catch {
        // Non-fatal: cache parse/read failure should not block live fetch.
      }

      await refetch();
    };

    void bootstrap();
  }, [applyMetrics, refetch]);

  /** Auto-refresh health data every 5 minutes so live HR/glucose stays current. */
  useEffect(() => {
    const id = setInterval(() => {
      void refetch();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refetch]);

  return {
    ...state,
    isLoading,
    error,
    refetch,
    applyImportedGlucose,
    dataSource,
  };
};
