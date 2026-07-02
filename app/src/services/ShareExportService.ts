/**
 * Build + upload encrypted-clinic snapshot (alpha: gzip + HTTPS + share ACL).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deflate } from 'pako';
import type { CachedHealthMetrics } from './healthMetricsCache';
import { HEALTH_METRICS_CACHE_KEY } from './healthMetricsCache';
import { uploadSyncPayload, type SyncLookbackMode, type SyncSummary } from './SyncApiService';
import { WITHINGS_STORE_KEY, type WithingsPersistedStore } from './WithingsPersistenceService';

const EXPORT_APP = 'healthings-medilab';
const EXPORT_VERSION = 1;

const EXCLUDED_ASYNC_KEYS = new Set<string>([
  'healthings:unhandledErrorLog',
  'healthings:debugDownloadsDirUri',
  'healthings:persistedHealth',
  'last_day_close_date',
  'coach_last_weigh_in_at',
  'coach_last_workout_start_ms',
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

function isChatHistoryKey(key: string): boolean {
  return /^chat_history_\d{4}-\d{2}-\d{2}(?:_(doctor|nutritionist|coach))?$/.test(key);
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

function trimWithingsStore(raw: string, cutoffDay: string): string {
  const store = JSON.parse(raw) as WithingsPersistedStore;
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
  if (asyncStorage[WITHINGS_STORE_KEY]) includes.push('withings');
  if (asyncStorage.body_target || asyncStorage.macro_target) includes.push('targets');
  if (asyncStorage.user_rules) includes.push('rules');
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

export async function buildClinicExport(lookbackMode: SyncLookbackMode = '90d'): Promise<ClinicExportPayload> {
  const lookbackDays = lookbackMode === 'full' ? 3650 : 90;
  const cutoffDay = lookbackMode === 'full' ? '1970-01-01' : cutoffDayKey(lookbackDays);

  const allKeys = await AsyncStorage.getAllKeys();
  const exportKeys = allKeys.filter((k) => !EXCLUDED_ASYNC_KEYS.has(k));
  const pairs = await AsyncStorage.multiGet(exportKeys);

  const asyncStorage: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (value == null) continue;
    // Labs: always full history — small payload, clinic lipid trends need all draw dates.
    if (key.startsWith('lab_report_') || key === 'lab_log_reports') {
      asyncStorage[key] = value;
      continue;
    }
    if (lookbackMode !== 'full') {
      const fd = foodDayFromKey(key);
      if (fd && fd < cutoffDay) continue;
      const cd = chatDayFromKey(key);
      if (cd && cd < cutoffDay) continue;
      if (key === HEALTH_METRICS_CACHE_KEY) {
        asyncStorage[key] = trimCgm(value, cutoffDay);
        continue;
      }
      if (key === WITHINGS_STORE_KEY) {
        asyncStorage[key] = trimWithingsStore(value, cutoffDay);
        continue;
      }
    }
    asyncStorage[key] = value;
  }

  return {
    version: EXPORT_VERSION,
    app: EXPORT_APP,
    exportedAt: new Date().toISOString(),
    lookbackMode,
    asyncStorage,
  };
}

export async function shareClinicExport(lookbackMode: SyncLookbackMode = '90d'): Promise<ShareExportResult> {
  const payload = await buildClinicExport(lookbackMode);
  const json = JSON.stringify(payload);
  const compressed = deflate(json);
  const payloadGzipBase64 = bytesToBase64(compressed);

  const lookbackDays = lookbackMode === 'full' ? 3650 : 90;
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
