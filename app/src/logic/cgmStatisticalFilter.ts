/**
 * Statistical CGM filter: count days with extreme lows; if rare (e.g. 1/100 days),
 * treat those days as likely sensor error and exclude from chart/stats.
 */

import { foodLogDayKey } from '../services/FoodLogService';
import type { TimePoint } from '../services/SamsungHealthService';

/** Daily min below this → "low day" (isolated extreme lows, e.g. 40 mg/dL artifact). */
export const CGM_STAT_LOW_DAY_THRESHOLD_MG_DL = 54;

/** Need enough CGM history before auto-excluding rare low days. */
export const CGM_STAT_MIN_DAYS_WITH_DATA = 14;

/** Low days must be at most this fraction of all CGM days (1/100 = 1%). */
export const CGM_STAT_MAX_LOW_DAY_FRACTION = 0.05;

/** Never auto-exclude more than this many calendar days. */
export const CGM_STAT_MAX_EXCLUDED_DAYS = 3;

/** Ignore partial days with very few samples. */
export const CGM_STAT_MIN_SAMPLES_PER_DAY = 6;

export type CgmLowDayRecord = {
  dayKey: string;
  minMgDl: number;
  sampleCount: number;
};

export type CgmStatisticalFilterMeta = {
  daysWithCgm: number;
  lowDays: CgmLowDayRecord[];
  excludedDayKeys: string[];
  /** Human-readable line for mentors when exclusions apply. */
  summaryLine: string | null;
};

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function groupGlucoseByDay(glucose: TimePoint[]): Map<string, TimePoint[]> {
  const byDay = new Map<string, TimePoint[]>();
  for (const p of glucose) {
    const ms = toMs(p.timestamp);
    if (Number.isNaN(ms) || p.value <= 0) continue;
    const dayKey = foodLogDayKey(ms);
    const list = byDay.get(dayKey);
    if (list) list.push(p);
    else byDay.set(dayKey, [p]);
  }
  return byDay;
}

/** Per-day mins for days with enough samples. */
export function analyzeCgmLowDays(
  glucose: TimePoint[],
  thresholdMgDl = CGM_STAT_LOW_DAY_THRESHOLD_MG_DL,
): { daysWithCgm: number; lowDays: CgmLowDayRecord[]; allDays: CgmLowDayRecord[] } {
  const byDay = groupGlucoseByDay(glucose);
  const allDays: CgmLowDayRecord[] = [];

  for (const [dayKey, points] of byDay) {
    if (points.length < CGM_STAT_MIN_SAMPLES_PER_DAY) continue;
    const vals = points.map((p) => p.value);
    allDays.push({
      dayKey,
      minMgDl: Math.min(...vals),
      sampleCount: points.length,
    });
  }

  allDays.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
  const lowDays = allDays.filter((d) => d.minMgDl < thresholdMgDl);
  return { daysWithCgm: allDays.length, lowDays, allDays };
}

function shouldExcludeAsSensorError(daysWithCgm: number, lowDays: CgmLowDayRecord[]): boolean {
  if (daysWithCgm < CGM_STAT_MIN_DAYS_WITH_DATA) return false;
  if (lowDays.length === 0) return false;
  if (lowDays.length > CGM_STAT_MAX_EXCLUDED_DAYS) return false;
  return lowDays.length / daysWithCgm <= CGM_STAT_MAX_LOW_DAY_FRACTION;
}

export function formatCgmStatFilterLine(meta: CgmStatisticalFilterMeta): string | null {
  if (!meta.summaryLine) return null;
  return meta.summaryLine;
}

/**
 * Drop readings on rare extreme-low days (after warm-up filter).
 * Uses full series history so 1 bad day in 100 does not distort period min/max.
 */
export function applyCgmStatisticalFilter(
  glucose: TimePoint[],
  thresholdMgDl = CGM_STAT_LOW_DAY_THRESHOLD_MG_DL,
): { filtered: TimePoint[]; meta: CgmStatisticalFilterMeta } {
  if (glucose.length === 0) {
    return {
      filtered: [],
      meta: { daysWithCgm: 0, lowDays: [], excludedDayKeys: [], summaryLine: null },
    };
  }

  const { daysWithCgm, lowDays } = analyzeCgmLowDays(glucose, thresholdMgDl);
  const exclude = shouldExcludeAsSensorError(daysWithCgm, lowDays);
  const excludedDayKeys = exclude ? lowDays.map((d) => d.dayKey) : [];
  const excludedSet = new Set(excludedDayKeys);

  const filtered =
    excludedSet.size === 0
      ? glucose
      : glucose.filter((p) => {
          const ms = toMs(p.timestamp);
          if (Number.isNaN(ms)) return true;
          return !excludedSet.has(foodLogDayKey(ms));
        });

  let summaryLine: string | null = null;
  if (exclude && excludedDayKeys.length > 0) {
    const pct = Math.round((lowDays.length / daysWithCgm) * 100);
    const dayDetail = lowDays
      .map((d) => `${d.dayKey} min ${d.minMgDl}`)
      .join(', ');
    summaryLine =
      `Statistical filter: ${lowDays.length}/${daysWithCgm} CGM days (${pct}%) had min <${thresholdMgDl} mg/dL — excluded as likely sensor error: ${dayDetail}. Mentor: do NOT treat these as hypoglycemia.`;
  }

  return {
    filtered,
    meta: {
      daysWithCgm,
      lowDays,
      excludedDayKeys,
      summaryLine,
    },
  };
}
