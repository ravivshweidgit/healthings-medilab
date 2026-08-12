/**
 * Build + upload encrypted-clinic snapshot (alpha: gzip + HTTPS + share ACL).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deflate } from 'pako';
import type { CachedHealthMetrics } from './healthMetricsCache';
import { HEALTH_METRICS_CACHE_KEY } from './healthMetricsCache';
import { uploadSyncPayload, type SyncLookbackMode, type SyncSummary } from './SyncApiService';
import { NUTRITION_DIRECTIVES_KEY } from './NutritionDirectiveService';
import {
  METRICS_STORE_KEY,
  coalesceMetricsStores,
  hasMetricsData,
  loadMetricsStore,
  syncMetricsStore,
  type MetricsPersistedStore,
} from './MetricsPersistenceService';
const LEGACY_WITHINGS_STORE_KEY = 'healthings:withingsStore';

/** Standard clinic snapshot window — ~1y; gzip typically well under 1 MB. */
export const CLINIC_DEFAULT_LOOKBACK_DAYS = 365;

function lookbackDaysForMode(mode: SyncLookbackMode): number {
  if (mode === 'full') return 3650;
  // Legacy wire values ('90d' / '128d') still mean the current standard window.
  return CLINIC_DEFAULT_LOOKBACK_DAYS;
}

const EXPORT_APP = 'healthings-medilab';
const EXPORT_VERSION = 1;

const EXCLUDED_ASYNC_KEYS = new Set<string>([
  'healthings:unhandledErrorLog',
  'healthings:debugDownloadsDirUri',
  'healthings:persistedHealth',
  'last_day_close_date',
  'coach_last_weigh_in_at',
  'coach_last_workout_start_ms',
  // Billing telemetry (be-33) — not health data; server is source of truth.
  'usage_queue_v1',
  'usage_credits_left_v1',
  'usage_sponsored_v1',
  'usage_last_flush_at_v1',
  // prompt105 — daily app logs are files; reserve pointer key if ever used.
  'healthings:app_daily_log_pointer',
]);

export type ClinicExportPayload = {
  version: 1;
  app: 'healthings-medilab';
  exportedAt: string;
  lookbackMode: SyncLookbackMode;
  asyncStorage: Record<string, string>;
};

export type ShareExportResult = {
  blobVersion: number;
  byteSize: number;
  summary: SyncSummary;
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayKeyFromOffset(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isFoodDayKey(key: string): boolean {
  return /^food_log_\d{4}-\d{2}-\d{2}$/.test(key);
}

function foodDayFromKey(key: string): string | null {
  const m = key.match(/^food_log_(\d{4}-\d{2}-\d{2})$/);
  return m?.[1] ?? null;
}

function chatDayFromKey(key: string): string | null {
  const m = key.match(/^chat_history_(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function cutoffDayKey(lookbackDays: number): string {
  return dayKeyFromOffset(lookbackDays - 1);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function trimCgm(raw: string, cutoffDay: string): string {
  const data = JSON.parse(raw) as CachedHealthMetrics;
  const glucose = (data.glucose ?? []).filter((p) => {
    const dk = p.timestamp.slice(0, 10);
    return dk >= cutoffDay;
  });
  const sessionStarts = (data.cgmSessionStarts ?? []).filter((s) => {
    const d = new Date(s.startMs);
    const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return dk >= cutoffDay;
  });
  return JSON.stringify({ ...data, glucose, cgmSessionStarts: sessionStarts });
}

function trimMetricsStore(raw: string, cutoffDay: string): string {
  const store = JSON.parse(raw) as MetricsPersistedStore;
  const cutoffMs = Date.parse(`${cutoffDay}T00:00:00`);
  const after = (ts: string) => {
    const ms = Date.parse(ts);
    return !Number.isNaN(ms) && ms >= cutoffMs;
  };
  return JSON.stringify({
    ...store,
    bodyTrendDays: store.bodyTrendDays.filter((d) => d.dayKey >= cutoffDay),
    bodyTrendSessions: store.bodyTrendSessions.filter((s) => s.dayKey >= cutoffDay),
    heartRate: store.heartRate.filter((p) => after(p.timestamp)),
    calories: store.calories.filter((p) => after(p.timestamp)),
    workouts: store.workouts.filter((w) => w.startMs >= cutoffMs),
  });
}

function detectIncludes(asyncStorage: Record<string, string>): string[] {
  const includes: string[] = [];
  if (Object.keys(asyncStorage).some(isFoodDayKey)) includes.push('meals');
  if (asyncStorage[HEALTH_METRICS_CACHE_KEY]) includes.push('cgm');
  if (Object.keys(asyncStorage).some((k) => k.startsWith('lab_report_'))) includes.push('labs');
  if (asyncStorage[METRICS_STORE_KEY] || asyncStorage[LEGACY_WITHINGS_STORE_KEY]) includes.push('metrics');
  if (asyncStorage.body_target || asyncStorage.macro_target) includes.push('targets');
  if (asyncStorage.user_rules) includes.push('rules');
  if (asyncStorage[NUTRITION_DIRECTIVES_KEY]) includes.push('directives');
  if (asyncStorage.water_log_v1 || asyncStorage.water_goal_ml_v1) includes.push('water');
  return includes;
}

function dayRangeFromKeys(asyncStorage: Record<string, string>): { from: string; to: string } {
  const days: string[] = [];
  for (const key of Object.keys(asyncStorage)) {
    const fd = foodDayFromKey(key);
    if (fd) days.push(fd);
    const cd = chatDayFromKey(key);
    if (cd) days.push(cd);
  }
  days.sort();
  if (days.length === 0) {
    const t = todayKey();
    return { from: t, to: t };
  }
  return { from: days[0]!, to: days[days.length - 1]! };
}

export async function buildClinicExport(
  lookbackMode: SyncLookbackMode = '365d',
  metricsOverride?: MetricsPersistedStore,
): Promise<ClinicExportPayload> {
  const lookbackDays = lookbackDaysForMode(lookbackMode);
  const cutoffDay = lookbackMode === 'full' ? '1970-01-01' : cutoffDayKey(lookbackDays);

  const allKeys = await AsyncStorage.getAllKeys();
  // Chat: today only for /account/ (no long history). Clinic mentor downloads
  // strip all chat_history_* (be-24).
  const today = todayKey();
  const exportKeys = allKeys.filter((k) => {
    if (EXCLUDED_ASYNC_KEYS.has(k)) return false;
    const cd = chatDayFromKey(k);
    if (cd != null && cd !== today) return false;
    return true;
  });
  const pairs = await AsyncStorage.multiGet(exportKeys);

  const asyncStorage: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (value == null) continue;
    // Labs: always full history — small payload, clinic lipid trends need all draw dates.
    if (key.startsWith('lab_report_') || key === 'lab_log_reports') {
      asyncStorage[key] = value;
      continue;
    }
    if (key === METRICS_STORE_KEY || key === LEGACY_WITHINGS_STORE_KEY) {
      continue;
    }
    if (lookbackMode !== 'full') {
      const fd = foodDayFromKey(key);
      if (fd && fd < cutoffDay) continue;
      if (key === HEALTH_METRICS_CACHE_KEY) {
        asyncStorage[key] = trimCgm(value, cutoffDay);
        continue;
      }
    }
    asyncStorage[key] = value;
  }

  let canonicalMetrics = metricsOverride ?? (await loadMetricsStore());
  if (!hasMetricsData(canonicalMetrics)) {
    const pairs = await AsyncStorage.multiGet([METRICS_STORE_KEY, LEGACY_WITHINGS_STORE_KEY]);
    const coalesced = coalesceMetricsStores(pairs[0]?.[1] ?? null, pairs[1]?.[1] ?? null);
    if (hasMetricsData(coalesced)) canonicalMetrics = coalesced;
  }
  if (hasMetricsData(canonicalMetrics)) {
    const json = JSON.stringify(canonicalMetrics);
    asyncStorage[METRICS_STORE_KEY] =
      lookbackMode !== 'full' ? trimMetricsStore(json, cutoffDay) : json;
  }

  return {
    version: EXPORT_VERSION,
    app: EXPORT_APP,
    exportedAt: new Date().toISOString(),
    lookbackMode,
    asyncStorage,
  };
}

export async function shareClinicExport(lookbackMode: SyncLookbackMode = '365d'): Promise<ShareExportResult> {
  const synced = await syncMetricsStore();
  if (!hasMetricsData(synced)) {
    console.warn('[ClinicExport] metrics store empty after sync — snapshot may lack body/HR/workouts');
  }
  const payload = await buildClinicExport(lookbackMode, synced);
  const json = JSON.stringify(payload);
  const compressed = deflate(json);
  const payloadGzipBase64 = bytesToBase64(compressed);

  const lookbackDays = lookbackDaysForMode(lookbackMode);
  const summary: SyncSummary = {
    generatedAt: payload.exportedAt,
    lookbackDays,
    lookbackMode,
    dayRange: dayRangeFromKeys(payload.asyncStorage),
    includes: detectIncludes(payload.asyncStorage),
  };

  const blob = await uploadSyncPayload(payloadGzipBase64, summary);
  return {
    blobVersion: blob.version,
    byteSize: blob.byteSize,
    summary,
  };
}
