import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { calculateMetabolicEfficiency, type ActivityZone } from '../logic/MetabolicLogic';
import { generateDemoRecentMetrics } from '../services/demoHealthMetrics';
import type { HealthDataSource } from '../services/healthRuntime';
import { getHealthDataSource } from '../services/healthRuntime';
import { samsungHealthService, type RecentMetrics, type TimePoint } from '../services/SamsungHealthService';

export type HealthSyncResult = {
  metrics: RecentMetrics;
  efficiencyScore: number;
  insight: string;
  activityZones: ActivityZone[];
};

type HealthDataState = {
  glucoseData: TimePoint[];
  stepsData: TimePoint[];
  heartRateData: TimePoint[];
  efficiencyScore: number;
  insight: string;
  activityZones: ActivityZone[];
};

const CACHE_KEY = 'healthings:lastMetrics';

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

  const applyMetrics = useCallback((metrics: RecentMetrics) => {
    const efficiency = calculateMetabolicEfficiency(metrics.glucose, metrics.steps);
    setState({
      glucoseData: metrics.glucose,
      stepsData: metrics.steps,
      heartRateData: metrics.heartRate ?? [],
      efficiencyScore: efficiency.efficiencyScore,
      insight: efficiency.insight,
      activityZones: efficiency.activityZones,
    });
  }, []);

  const applyImportedGlucose = useCallback((imported: TimePoint[]) => {
    setState((prev) => {
      const mergedG = mergeGlucoseCsvWins(prev.glucoseData, imported);
      const metrics: RecentMetrics = {
        glucose: mergedG,
        steps: prev.stepsData,
        heartRate: prev.heartRateData,
      };
      void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(metrics));
      const eff = calculateMetabolicEfficiency(mergedG, prev.stepsData);
      return {
        ...prev,
        glucoseData: mergedG,
        efficiencyScore: eff.efficiencyScore,
        insight: eff.insight,
        activityZones: eff.activityZones,
      };
    });
  }, []);

  const refetch = useCallback(async (): Promise<HealthSyncResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      if (dataSource !== 'health-connect') {
        const metrics = generateDemoRecentMetrics();
        applyMetrics(metrics);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(metrics));
        const efficiency = calculateMetabolicEfficiency(metrics.glucose, metrics.steps);
        return {
          metrics,
          efficiencyScore: efficiency.efficiencyScore,
          insight: efficiency.insight,
          activityZones: efficiency.activityZones,
        };
      }

      await samsungHealthService.initializeAndRequestPermissions();
      const metrics = await samsungHealthService.fetchRecentMetrics();
      applyMetrics(metrics);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(metrics));
      const efficiency = calculateMetabolicEfficiency(metrics.glucose, metrics.steps);
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
          const parsed = JSON.parse(cached) as RecentMetrics;
          applyMetrics(parsed);
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
