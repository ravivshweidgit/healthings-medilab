import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { CgmSessionStart } from '../logic/cgmWarmupFilter';
import type { ActivityZone } from '../logic/MetabolicLogic';
import {
  hasCgmData,
  loadCgmStore,
  mergeImportedGlucoseIntoStore,
  syncCgmStore,
  viewFromCgmStore,
  type CgmSyncReason,
  type CgmViewState,
} from '../services/CgmPersistenceService';
import type { HealthDataSource } from '../services/healthRuntime';
import { getHealthDataSource } from '../services/healthRuntime';
import type { RecentMetrics, TimePoint } from '../services/HealthConnectService';

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
  newPointsAdded: number;
};

type HealthDataState = CgmViewState;

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

  const applyView = useCallback((view: CgmViewState) => {
    setState(view);
  }, []);

  const applyImportedGlucose = useCallback(
    async (importedRaw: TimePoint[], importedSessionStarts?: CgmSessionStart[]): Promise<GlucoseImportResult> => {
      return withGlucoseSyncLock(async () => {
        const result = await mergeImportedGlucoseIntoStore(
          importedRaw,
          importedSessionStarts,
          dataSource,
        );
        applyView(result.view);
        return {
          csvCount: result.csvCount,
          hcCount: result.hcCount,
          mergedRawCount: result.mergedRawCount,
          chartCount: result.chartCount,
          sessionCount: result.sessionCount,
          newPointsAdded: result.newPointsAdded,
        };
      });
    },
    [applyView, dataSource, withGlucoseSyncLock],
  );

  const refetch = useCallback(
    async (opts?: { quiet?: boolean; reason?: CgmSyncReason }): Promise<HealthSyncResult | null> => {
      if (refetchInFlight.current) {
        return refetchInFlight.current;
      }

      const quiet = opts?.quiet === true;
      const reason = opts?.reason ?? 'manual';
      const run = withGlucoseSyncLock(async (): Promise<HealthSyncResult | null> => {
        if (!quiet) setIsLoading(true);
        setError(null);
        try {
          const result = await syncCgmStore(dataSource, { reason });
          if (!result) {
            setError('Failed to sync health data.');
            return null;
          }
          applyView(result.view);
          return {
            metrics: { glucose: result.store.glucose },
            efficiencyScore: result.view.efficiencyScore,
            insight: result.view.insight,
            activityZones: result.view.activityZones,
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to sync health data.';
          const cached = await loadCgmStore();
          if (hasCgmData(cached)) {
            setError(null);
            return null;
          }
          setError(message);
          return null;
        } finally {
          if (!quiet) setIsLoading(false);
        }
      });

      refetchInFlight.current = run;
      try {
        return await run;
      } finally {
        refetchInFlight.current = null;
      }
    },
    [applyView, dataSource, withGlucoseSyncLock],
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const cached = await loadCgmStore();
        if (hasCgmData(cached)) {
          applyView(viewFromCgmStore(cached!));
          setIsLoading(false);
        }
      } catch {
        // Non-fatal: cache read failure should not block sync.
      }
      await refetch({ reason: 'boot' });
    };

    void bootstrap();
  }, [applyView, dataSource, refetch]);

  useEffect(() => {
    const id = setInterval(() => {
      void refetch({ quiet: true, reason: 'interval' });
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refetch]);

  // Match Withings HR: pull CGM on foreground so the chart right edge does not go stale.
  useEffect(() => {
    const onState = (next: AppStateStatus) => {
      if (next === 'active') void refetch({ quiet: true, reason: 'foreground' });
    };
    const sub = AppState.addEventListener('change', onState);
    return () => sub.remove();
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
