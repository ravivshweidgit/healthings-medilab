import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { CompositionSession, MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import { fetchIntradayToday, getValidAccessToken, loadWithingsTokens } from '../services/WithingsApiService';
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
      const quiet = !!opts?.quiet;
      if (!quiet) {
        setBodyScanLoading(true);
        setTrendLoading(true);
      }
      setBodyScanError(null);
      setTrendError(null);
      try {
        const store = await syncMetricsStore(opts);
        applyStore(store);
        // Never await diag on the sync path — yielding lets RN flush a heavy dashboard re-render (~1–2s).
        void refreshHrDiag();
        return store;
      } catch (err) {
        const cached = await loadMetricsStore();
        applyStore(cached);
        const message = err instanceof Error ? err.message : 'Could not sync device metrics.';
        setBodyScanError(cached.bodyScan ? null : message);
        setTrendError(cached.bodyTrendDays.length > 0 ? null : message);
        return cached;
      } finally {
        if (!quiet) {
          setBodyScanLoading(false);
          setTrendLoading(false);
        }
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
      const todayFetch = await fetchIntradayToday();
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
        }
        await refreshHrDiag();
      } catch {
        // Non-fatal: cache read failure should not block sync.
      } finally {
        // Show cached UI immediately even if network sync hangs (iOS airplane mode).
        setBodyScanLoading(false);
        setTrendLoading(false);
      }
      void sync({ quiet: true });
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

  /** Push an already-loaded metrics store into React state (e.g. after a workout override). */
  const adoptStore = useCallback(
    (store: MetricsPersistedStore) => {
      applyStore(store);
    },
    [applyStore],
  );

  return {
    ...state,
    bodyScanLoading,
    bodyScanError,
    trendLoading,
    trendError,
    sync,
    reloadWithingsHistory,
    refreshTodayIntraday,
    adoptStore,
    hrSyncDiag,
    hrSyncDiagLine: formatHrSyncDiagLine(hrSyncDiag),
  };
}
