import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { calculateMetabolicEfficiency, type ActivityZone } from '../logic/MetabolicLogic';
import type { CgmSessionStart } from '../logic/cgmWarmupFilter';
import { generateDemoRecentMetrics } from '../services/demoHealthMetrics';
import type { HealthDataSource } from '../services/healthRuntime';
import { getHealthDataSource } from '../services/healthRuntime';
import {
  HEALTH_METRICS_CACHE_KEY,
  mergeCgmSessionStarts,
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
      ...metrics,
      glucose: raw,
      cgmSessionStarts: sessionStarts,
    },
    filtered,
    sessionStarts,
    cgmStatSummary: statFilter.summaryLine,
  };
}

/** Same ISO instant: CSV import overwrites Health Connect. */
function mergeGlucoseCsvWins(existing: TimePoint[], imported: TimePoint[]): TimePoint[] {
  const map = new Map<string, number>();
  for (const p of existing) map.set(p.timestamp, p.value);
  for (const p of imported) map.set(p.timestamp, p.value);
  return [...map.entries()]
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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

  const applyMetrics = useCallback((metrics: RecentMetrics, knownSessionStarts?: CgmSessionStart[]) => {
    const { metrics: cached, filtered, sessionStarts, cgmStatSummary } = applyGlucoseToMetrics(
      metrics,
      knownSessionStarts,
    );
    const efficiency = calculateMetabolicEfficiency(filtered, metrics.steps);
    setState({
      glucoseData: filtered,
      cgmSessionStarts: sessionStarts,
      cgmStatSummary,
      stepsData: metrics.steps,
      heartRateData: metrics.heartRate ?? [],
      efficiencyScore: efficiency.efficiencyScore,
      insight: efficiency.insight,
      activityZones: efficiency.activityZones,
    });
    persistMetrics(cached);
  }, []);

  const applyImportedGlucose = useCallback(
    async (importedRaw: TimePoint[], importedSessionStarts?: CgmSessionStart[]) => {
      let cached: CachedHealthMetrics | null = null;
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        cached = raw ? (JSON.parse(raw) as CachedHealthMetrics) : null;
      } catch {
        cached = null;
      }

      setState((prev) => {
        const existingRaw = cached?.glucose ?? [];
        const mergedRaw = mergeGlucoseCsvWins(existingRaw, importedRaw);
        const sessionStarts = mergeCgmSessionStarts(
          cached?.cgmSessionStarts ?? prev.cgmSessionStarts,
          importedSessionStarts,
        );
        const { metrics: toStore, filtered, sessionStarts: allStarts, cgmStatSummary } =
          applyGlucoseToMetrics(
          {
            glucose: mergedRaw,
            steps: prev.stepsData,
            heartRate: prev.heartRateData,
          },
          sessionStarts,
        );
        persistMetrics(toStore);
        const eff = calculateMetabolicEfficiency(filtered, prev.stepsData);
        return {
          ...prev,
          glucoseData: filtered,
          cgmSessionStarts: allStarts,
          cgmStatSummary,
          efficiencyScore: eff.efficiencyScore,
          insight: eff.insight,
          activityZones: eff.activityZones,
        };
      });
    },
    [],
  );

  const refetch = useCallback(async (): Promise<HealthSyncResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      if (dataSource !== 'health-connect') {
        const metrics = generateDemoRecentMetrics();
        applyMetrics(metrics);
        const { filtered } = prepareGlucoseSeries(metrics.glucose);
        const efficiency = calculateMetabolicEfficiency(filtered, metrics.steps);
        return {
          metrics,
          efficiencyScore: efficiency.efficiencyScore,
          insight: efficiency.insight,
          activityZones: efficiency.activityZones,
        };
      }

      await samsungHealthService.initializeAndRequestPermissions();
      const metrics = await samsungHealthService.fetchRecentMetrics();
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      const knownStarts = cached
        ? ((JSON.parse(cached) as CachedHealthMetrics).cgmSessionStarts ?? undefined)
        : undefined;
      applyMetrics(metrics, knownStarts);
      const { filtered } = prepareGlucoseSeries(metrics.glucose, knownStarts);
      const efficiency = calculateMetabolicEfficiency(filtered, metrics.steps);
      return {
        metrics,
        efficiencyScore: efficiency.efficiencyScore,
        insight: efficiency.insight,
        activityZones: efficiency.activityZones,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync health data.';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [applyMetrics, dataSource]);

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
