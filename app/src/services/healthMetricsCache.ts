/**
 * Cached CGM (Health Connect glucose + CareSens CSV merge) — same source as the dashboard chart.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  detectCgmSessionStarts,
  excludeCgmWarmupReadings,
  sanitizePersistedSessionStarts,
  warmupSessionStarts,
  type CgmSessionStart,
} from '../logic/cgmWarmupFilter';
import {
  applyCgmStatisticalFilter,
  type CgmStatisticalFilterMeta,
} from '../logic/cgmStatisticalFilter';
import type { RecentMetrics, TimePoint } from './SamsungHealthService';

export const HEALTH_METRICS_CACHE_KEY = 'healthings:lastMetrics';

export type CachedHealthMetrics = RecentMetrics & {
  /** CareSens serial-based + gap-based session starts (first 24h excluded from stats/chart). */
  cgmSessionStarts?: CgmSessionStart[];
};

export async function loadCachedHealthMetrics(): Promise<CachedHealthMetrics | null> {
  try {
    const raw = await AsyncStorage.getItem(HEALTH_METRICS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedHealthMetrics) : null;
  } catch {
    return null;
  }
}

export function mergeCgmSessionStarts(...lists: (CgmSessionStart[] | undefined)[]): CgmSessionStart[] {
  const map = new Map<number, CgmSessionStart>();
  for (const list of lists) {
    if (!list) continue;
    for (const s of list) {
      map.set(s.startMs, s);
    }
  }
  return [...map.values()].sort((a, b) => a.startMs - b.startMs);
}

export type { CgmStatisticalFilterMeta } from '../logic/cgmStatisticalFilter';

/** Raw glucose from cache/HC + known CareSens session starts → chart/mentor series. */
export function prepareGlucoseSeries(
  raw: TimePoint[],
  knownSessionStarts?: CgmSessionStart[],
): {
  filtered: TimePoint[];
  sessionStarts: CgmSessionStart[];
  raw: TimePoint[];
  statFilter: CgmStatisticalFilterMeta;
} {
  const gapStarts = detectCgmSessionStarts(raw);
  const sessionStarts = mergeCgmSessionStarts(knownSessionStarts, gapStarts);
  const warmupStarts = warmupSessionStarts(knownSessionStarts, gapStarts);
  const afterWarmup = excludeCgmWarmupReadings(raw, warmupStarts);
  const { filtered, meta: statFilter } = applyCgmStatisticalFilter(afterWarmup);
  return {
    filtered,
    sessionStarts: sanitizePersistedSessionStarts(knownSessionStarts, gapStarts),
    raw,
    statFilter,
  };
}

/** Merge glucose arrays; later entries win on duplicate timestamps (CSV import behaviour). */
export function mergeGlucoseTimePoints(sources: TimePoint[][]): TimePoint[] {
  const map = new Map<string, number>();
  for (const src of sources) {
    for (const p of src) {
      if (p.value > 0) map.set(p.timestamp, p.value);
    }
  }
  return [...map.entries()]
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function filterGlucoseToDayKeys(glucose: TimePoint[], dayKeys: string[]): TimePoint[] {
  const set = new Set(dayKeys);
  return glucose.filter((p) => {
    const dk = localDayKeyFromTimestamp(p.timestamp);
    return dk != null && set.has(dk);
  });
}

function localDayKeyFromTimestamp(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
