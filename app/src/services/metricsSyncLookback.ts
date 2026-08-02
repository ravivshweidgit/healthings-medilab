/**
 * Shared sync lookback — one source of truth for Withings + phone health (HC / HealthKit).
 * Shallow = routine / pull-refresh; deep = first fill / explicit Deep sync.
 */
export const METRICS_SHALLOW_LOOKBACK_DAYS = 2;
export const METRICS_DEEP_LOOKBACK_DAYS = 128;
