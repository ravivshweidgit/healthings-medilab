import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompositionSession, MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import { fetchTodayHeartRate, getValidAccessToken, loadWithingsTokens } from '../services/WithingsApiService';
import type { WeightMetricsForDashboard, WithingsCaloriePoint, WithingsHeartRatePoint, WorkoutSession } from '../services/WithingsApiService';
import {
  hasWithingsData,
  loadWithingsStore,
  mergeTodayWithingsIntraday,
  syncWithingsStore,
  type WithingsPersistedStore,
} from '../services/WithingsPersistenceService';

export type WithingsDataState = {
  bodyScan: WeightMetricsForDashboard | null;
  bodyTrendDays: MetabolicTrend7dDay[];
  bodyTrendSessions: CompositionSession[];
  heartRate: WithingsHeartRatePoint[];
  calories: WithingsCaloriePoint[];
  workouts: WorkoutSession[];
};

function storeToState(store: WithingsPersistedStore): WithingsDataState {
  return {
    bodyScan: store.bodyScan,
    bodyTrendDays: store.bodyTrendDays,
    bodyTrendSessions: store.bodyTrendSessions,
    heartRate: store.heartRate,
    calories: store.calories,
    workouts: store.workouts,
  };
}

const emptyState: WithingsDataState = {
  bodyScan: null,
  bodyTrendDays: [],
  bodyTrendSessions: [],
  heartRate: [],
  calories: [],
  workouts: [],
};

export function useWithingsData() {
  const [state, setState] = useState<WithingsDataState>(emptyState);
  const [bodyScanLoading, setBodyScanLoading] = useState(true);
  const [bodyScanError, setBodyScanError] = useState<string | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);
  const syncInFlight = useRef<Promise<WithingsPersistedStore> | null>(null);

  const applyStore = useCallback((store: WithingsPersistedStore) => {
    setState(storeToState(store));
  }, []);

  const sync = useCallback(async (): Promise<WithingsPersistedStore> => {
    if (syncInFlight.current) {
      return syncInFlight.current;
    }

    const run = (async (): Promise<WithingsPersistedStore> => {
      setBodyScanLoading(true);
      setTrendLoading(true);
      setBodyScanError(null);
      setTrendError(null);
      try {
        const store = await syncWithingsStore();
        applyStore(store);
        return store;
      } catch (err) {
        const cached = await loadWithingsStore();
        applyStore(cached);
        const message = err instanceof Error ? err.message : 'Could not sync Withings data.';
        setBodyScanError(cached.bodyScan ? null : message);
        setTrendError(cached.bodyTrendDays.length > 0 ? null : message);
        return cached;
      } finally {
        setBodyScanLoading(false);
        setTrendLoading(false);
      }
    })();

    syncInFlight.current = run;
    try {
      return await run;
    } finally {
      syncInFlight.current = null;
    }
  }, [applyStore]);

  const refreshTodayIntraday = useCallback(async () => {
    const tokens = await loadWithingsTokens();
    if (!tokens?.refreshToken) return;
    const accessToken = await getValidAccessToken();
    if (!accessToken) return;
    try {
      const { heartRate: todayHr, calories: todayCal } = await fetchTodayHeartRate();
      if (todayHr.length === 0 && todayCal.length === 0) return;
      const store = await mergeTodayWithingsIntraday(todayHr, todayCal);
      applyStore(store);
    } catch {
      // Non-fatal: periodic refresh failure is silent.
    }
  }, [applyStore]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const cached = await loadWithingsStore();
        if (hasWithingsData(cached)) {
          applyStore(cached);
          setBodyScanLoading(false);
          setTrendLoading(false);
        }
      } catch {
        // Non-fatal: cache read failure should not block sync.
      }
      await sync();
    };
    void bootstrap();
  }, [applyStore, sync]);

  useEffect(() => {
    const id = setInterval(() => {
      void refreshTodayIntraday();
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshTodayIntraday]);

  return {
    ...state,
    bodyScanLoading,
    bodyScanError,
    trendLoading,
    trendError,
    sync,
    refreshTodayIntraday,
  };
}
