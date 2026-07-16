/**
 * @deprecated Import from MetricsPersistenceService — re-exported for backward compatibility.
 */
export {
  LEGACY_HC_ACTIVITY_STORE_KEY,
  LEGACY_WITHINGS_STORE_KEY,
  METRICS_STORE_KEY,
  WITHINGS_STORE_KEY,
  coalesceMetricsStores,
  hasMetricsData,
  hasWithingsData,
  loadMetricsStore,
  loadWithingsStore,
  mergeIntoMetricsStore,
  mergeIntoWithingsStore,
  mergeTodayWithingsIntraday,
  replaceTodayIntraday,
  saveMetricsStore,
  saveWithingsStore,
  syncHealthConnectIntoStore,
  syncMetricsStore,
  syncWithingsApiIntoStore,
  syncWithingsStore,
  type MetricsPersistedStore,
  type SyncMetricsOptions,
  type SyncWithingsOptions,
  type WithingsPersistedStore,
} from './MetricsPersistenceService';
