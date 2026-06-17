/**
 * Unified local persistence facade — render from store, sync updates store.
 *
 *   UI / mentors → read persistence
 *   adapters (Health Connect, Withings, CSV) → sync* → merge → persistence
 */
import { syncCgmStore, loadCgmStore, type CgmSyncResult } from './CgmPersistenceService';
import { loadWithingsStore, syncWithingsStore, type WithingsPersistedStore } from './WithingsPersistenceService';

export type HealthPersistenceSnapshot = {
  cgm: Awaited<ReturnType<typeof loadCgmStore>>;
  withings: WithingsPersistedStore;
};

/** Load all persisted health metrics (no network). */
export async function loadHealthPersistence(): Promise<HealthPersistenceSnapshot> {
  const [cgm, withings] = await Promise.all([loadCgmStore(), loadWithingsStore()]);
  return { cgm, withings };
}

/** Sync all adapters into persistence, then return the updated snapshot. */
export async function syncHealthPersistence(): Promise<{
  cgm: CgmSyncResult | null;
  withings: WithingsPersistedStore;
}> {
  const [cgm, withings] = await Promise.all([syncCgmStore(), syncWithingsStore()]);
  return { cgm, withings };
}
