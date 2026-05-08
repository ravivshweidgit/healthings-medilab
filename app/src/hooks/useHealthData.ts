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
  efficiencyScore: number;
  insight: string;
  activityZones: ActivityZone[];
};

const CACHE_KEY = 'healthings:lastMetrics';

const emptyState: HealthDataState = {
  glucoseData: [],
  stepsData: [],
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
      efficiencyScore: efficiency.efficiencyScore,
      insight: efficiency.insight,
      activityZones: efficiency.activityZones,
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

  return {
    ...state,
    isLoading,
    error,
    refetch,
    dataSource,
  };
};
