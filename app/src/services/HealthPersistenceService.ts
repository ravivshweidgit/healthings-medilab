/**
 * Unified local persistence facade — render from store, sync updates store.
 *
 *   UI / mentors → read persistence
 *   adapters (Health Connect, Withings, CSV) → sync* → merge → persistence
 */
import { syncCgmStore, loadCgmStore, type CgmSyncResult } from './CgmPersistenceService';
import { loadMetricsStore, syncMetricsStore, type MetricsPersistedStore } from './MetricsPersistenceService';

export type HealthPersistenceSnapshot = {
  cgm: Awaited<ReturnType<typeof loadCgmStore>>;
  metrics: MetricsPersistedStore;
};

/** Load all persisted health metrics (no network). */
export async function loadHealthPersistence(): Promise<HealthPersistenceSnapshot> {
  const [cgm, metrics] = await Promise.all([loadCgmStore(), loadMetricsStore()]);
  return { cgm, metrics };
}

/** Sync all adapters into persistence, then return the updated snapshot. */
export async function syncHealthPersistence(): Promise<{
  cgm: CgmSyncResult | null;
  metrics: MetricsPersistedStore;
}> {
  const [cgm, metrics] = await Promise.all([syncCgmStore(), syncMetricsStore()]);
  return { cgm, metrics };
}
