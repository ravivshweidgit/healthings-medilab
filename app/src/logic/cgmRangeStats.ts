/**
 * CGM range distribution + low-day counts for mentor context.
 */

import { foodLogDayKey } from '../services/FoodLogService';
import { CGM_STAT_MIN_SAMPLES_PER_DAY } from './cgmStatisticalFilter';
import type { TimePoint } from '../services/SamsungHealthService';

/** Daily min below this → counted as a "low day" for mentor stats. */
export const CGM_CLINICAL_LOW_DAY_THRESHOLD_MG_DL = 70;

export type CgmRangeDistribution = {
  sampleCount: number;
  pctBelow70: number;
  pctBetween70And100: number;
  pctAbove100: number;
};

export type CgmLowDaySummary = {
  daysWithCgm: number;
  lowDayCount: number;
  lowDayKeys: string[];
};

export const CGM_COMPRESSION_LOW_GUIDANCE =
  'Sleeping with pressure on the sensor can cause false low CGM readings (compression lows). Isolated low days may be artifact — confirm with fingerstick if symptomatic.';

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

/** % of readings below 70, between 70–100, and above 100 mg/dL. */
export function computeCgmRangeDistribution(values: number[]): CgmRangeDistribution | null {
  const vals = values.filter((v) => v > 0);
  if (vals.length === 0) return null;

  let below70 = 0;
  let between70And100 = 0;
  let above100 = 0;

  for (const v of vals) {
    if (v < 70) below70++;
    else if (v <= 100) between70And100++;
    else above100++;
  }

  const n = vals.length;
  return {
    sampleCount: n,
    pctBelow70: Math.round((below70 / n) * 100),
    pctBetween70And100: Math.round((between70And100 / n) * 100),
    pctAbove100: Math.round((above100 / n) * 100),
  };
}

export function formatCgmRangeDistributionLine(dist: CgmRangeDistribution): string {
  return (
    `Time in range (by readings): ${dist.pctBelow70}% below 70 | ${dist.pctBetween70And100}% 70–100 | ${dist.pctAbove100}% above 100 mg/dL (${dist.sampleCount} samples)`
  );
}

/** Count calendar days (with enough samples) whose daily min is below threshold. */
export function summarizeCgmLowDays(
  glucose: TimePoint[],
  dayKeys?: string[],
  thresholdMgDl = CGM_CLINICAL_LOW_DAY_THRESHOLD_MG_DL,
): CgmLowDaySummary {
  const keySet = dayKeys != null ? new Set(dayKeys) : null;
  const byDay = new Map<string, number[]>();

  for (const p of glucose) {
    const ms = toMs(p.timestamp);
    if (Number.isNaN(ms) || p.value <= 0) continue;
    const dk = foodLogDayKey(ms);
    if (keySet != null && !keySet.has(dk)) continue;
    const list = byDay.get(dk);
    if (list) list.push(p.value);
    else byDay.set(dk, [p.value]);
  }

  const lowDayKeys: string[] = [];
  let daysWithCgm = 0;

  for (const [dayKey, vals] of byDay) {
    if (vals.length < CGM_STAT_MIN_SAMPLES_PER_DAY) continue;
    daysWithCgm++;
    if (Math.min(...vals) < thresholdMgDl) {
      lowDayKeys.push(dayKey);
    }
  }

  lowDayKeys.sort();
  return {
    daysWithCgm,
    lowDayCount: lowDayKeys.length,
    lowDayKeys,
  };
}

export function formatCgmLowDaysLine(summary: CgmLowDaySummary, scopeLabel: string): string | null {
  if (summary.daysWithCgm === 0) return null;
  const pct = Math.round((summary.lowDayCount / summary.daysWithCgm) * 100);
  const base = `Low days (daily min <${CGM_CLINICAL_LOW_DAY_THRESHOLD_MG_DL} mg/dL): ${summary.lowDayCount}/${summary.daysWithCgm} ${scopeLabel} days (${pct}%)`;
  if (summary.lowDayCount === 0) {
    return `${base} — no clinical low days in this window.`;
  }
  const keys =
    summary.lowDayKeys.length <= 4
      ? summary.lowDayKeys.join(', ')
      : `${summary.lowDayKeys.slice(0, 3).join(', ')} +${summary.lowDayKeys.length - 3} more`;
  return `${base} — dates: ${keys}. Mentor: mention low-day count; consider compression lows if isolated.`;
}

/** Range % + low-day count + compression note for mentor blocks. */
export function buildCgmMentorDistributionLines(
  glucose: TimePoint[],
  dayKeys?: string[],
  scopeLabel = 'CGM',
): string[] {
  const keySet = dayKeys != null ? new Set(dayKeys) : null;
  const vals: number[] = [];
  for (const p of glucose) {
    if (p.value <= 0) continue;
    if (keySet != null) {
      const ms = toMs(p.timestamp);
      if (Number.isNaN(ms)) continue;
      if (!keySet.has(foodLogDayKey(ms))) continue;
    }
    vals.push(p.value);
  }

  const lines: string[] = [];
  const dist = computeCgmRangeDistribution(vals);
  if (dist) {
    lines.push(formatCgmRangeDistributionLine(dist));
    lines.push('Mentor MUST cite these range percentages when discussing glucose control.');
  }

  const lowDays = summarizeCgmLowDays(glucose, dayKeys);
  const lowLine = formatCgmLowDaysLine(lowDays, scopeLabel);
  if (lowLine) lines.push(lowLine);

  if (lowDays.lowDayCount > 0 || (dist != null && dist.pctBelow70 > 0)) {
    lines.push(CGM_COMPRESSION_LOW_GUIDANCE);
  }

  return lines;
}
