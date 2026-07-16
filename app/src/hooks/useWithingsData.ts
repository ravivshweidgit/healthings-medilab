import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { CompositionSession, MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import { fetchTodayHeartRate, getValidAccessToken, loadWithingsTokens } from '../services/WithingsApiService';
import type { WeightMetricsForDashboard, WithingsCaloriePoint, WithingsHeartRatePoint, WorkoutSession } from '../services/WithingsApiService';
import {
  hasMetricsData,
  loadMetricsStore,
  mergeTodayWithingsIntraday,
  syncMetricsStore,
  type MetricsPersistedStore,
  type SyncMetricsOptions,
} from '../services/MetricsPersistenceService';
import {
  formatHrSyncDiagLine,
  loadWithingsHrSyncDiag,
  type WithingsHrSyncDiag,
} from '../services/withingsHrSyncDiag';

export type WithingsDataState = {
  bodyScan: WeightMetricsForDashboard | null;
  bodyTrendDays: MetabolicTrend7dDay[];
  bodyTrendSessions: CompositionSession[];
  heartRate: WithingsHeartRatePoint[];
  calories: WithingsCaloriePoint[];
  workouts: WorkoutSession[];
};

function storeToState(store: MetricsPersistedStore): WithingsDataState {
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
  const [hrSyncDiag, setHrSyncDiag] = useState<WithingsHrSyncDiag | null>(null);
  const syncInFlight = useRef<Promise<MetricsPersistedStore> | null>(null);

  const refreshHrDiag = useCallback(async () => {
    setHrSyncDiag(await loadWithingsHrSyncDiag());
  }, []);

  const applyStore = useCallback((store: MetricsPersistedStore) => {
    setState(storeToState(store));
  }, []);

  const sync = useCallback(async (opts?: SyncMetricsOptions): Promise<MetricsPersistedStore> => {
    // Coalesce concurrent shallow syncs; deep always runs after any in-flight sync.
    if (syncInFlight.current) {
      if (!opts?.deep) return syncInFlight.current;
      await syncInFlight.current;
    }

    const run = (async (): Promise<MetricsPersistedStore> => {
      setBodyScanLoading(true);
      setTrendLoading(true);
      setBodyScanError(null);
      setTrendError(null);
      try {
        const store = await syncMetricsStore(opts);
        applyStore(store);
        await refreshHrDiag();
        return store;
      } catch (err) {
        const cached = await loadMetricsStore();
        applyStore(cached);
        const message = err instanceof Error ? err.message : 'Could not sync device metrics.';
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
  }, [applyStore, refreshHrDiag]);

  /** Explicit full Withings history pull (HR 60d / workouts 128d). */
  const reloadWithingsHistory = useCallback(async () => {
    return sync({ deep: true });
  }, [sync]);

  const refreshTodayIntraday = useCallback(async () => {
    const tokens = await loadWithingsTokens();
    if (!tokens?.refreshToken) return;
    const accessToken = await getValidAccessToken();
    if (!accessToken) return;
    try {
      const todayFetch = await fetchTodayHeartRate();
      const { heartRate: todayHr, calories: todayCal } = todayFetch;
      if (todayHr.length === 0 && todayCal.length === 0) {
        await refreshHrDiag();
        return;
      }
      const store = await mergeTodayWithingsIntraday(todayHr, todayCal, {
        apiStatus: todayFetch.apiStatus,
        apiError: todayFetch.apiError,
      });
      applyStore(store);
      await refreshHrDiag();
    } catch {
      // Non-fatal: periodic refresh failure is silent.
    }
  }, [applyStore, refreshHrDiag]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const cached = await loadMetricsStore();
        if (hasMetricsData(cached)) {
          applyStore(cached);
          setBodyScanLoading(false);
          setTrendLoading(false);
        }
        await refreshHrDiag();
      } catch {
        // Non-fatal: cache read failure should not block sync.
      }
      await sync();
    };
    void bootstrap();
  }, [applyStore, refreshHrDiag, sync]);

  useEffect(() => {
    const id = setInterval(() => {
      void refreshTodayIntraday();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshTodayIntraday]);

  useEffect(() => {
    const onState = (next: AppStateStatus) => {
      if (next === 'active') void refreshTodayIntraday();
    };
    const sub = AppState.addEventListener('change', onState);
    return () => sub.remove();
  }, [refreshTodayIntraday]);

  return {
    ...state,
    bodyScanLoading,
    bodyScanError,
    trendLoading,
    trendError,
    sync,
    reloadWithingsHistory,
    refreshTodayIntraday,
    hrSyncDiag,
    hrSyncDiagLine: formatHrSyncDiagLine(hrSyncDiag),
  };
}
