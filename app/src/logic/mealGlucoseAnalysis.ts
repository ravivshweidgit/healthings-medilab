/**
 * Correlate timed meals with CGM samples (~5 min) for mentor feedback.
 */

import { foodLogDayKey, type FoodEntry } from '../services/FoodLogService';
import type { TimePoint } from '../services/HealthConnectService';
import {
  CGM_WARMUP_HOURS,
  formatCgmSessionLines,
  type CgmSessionStart,
} from './cgmWarmupFilter';
import {
  buildCgmMentorDistributionLines,
  computeCgmRangeDistribution,
  formatCgmRangeDistributionLine,
  summarizeCgmLowDays,
  formatCgmLowDaysLine,
} from './cgmRangeStats';

const PRE_MEAL_LOOKBACK_MIN = 25;
const POST_MEAL_WINDOW_MIN = 120;
const PEAK_START_AFTER_MIN = 5;
const SAMPLE_MATCH_TOLERANCE_MIN = 8;
const WARMUP_MS = CGM_WARMUP_HOURS * 60 * 60 * 1000;

export type MealGlucoseResult = {
  mealIndex: number;
  mealTimeLabel: string;
  totalKcal: number;
  totalCarb_g: number;
  foodSummary: string;
  preMealMgDl: number | null;
  peakMgDl: number | null;
  peakDeltaMgDl: number | null;
  peakMinutesAfter: number | null;
  at60MinMgDl: number | null;
  at120MinMgDl: number | null;
  postSampleCount: number;
  assessment: 'steady' | 'moderate_rise' | 'sharp_spike' | 'insufficient_data';
};

type GlucoseSample = { ms: number; value: number };

type SpikeMealRecord = {
  dayKey: string;
  mealTimeLabel: string;
  foodNames: string[];
  peakDeltaMgDl: number;
  assessment: MealGlucoseResult['assessment'];
};

function toMs(timestamp: string): number {
  return new Date(timestamp).getTime();
}

function sortGlucose(glucose: TimePoint[]): GlucoseSample[] {
  return glucose
    .map((p) => ({ ms: toMs(p.timestamp), value: p.value }))
    .filter((p) => !Number.isNaN(p.ms) && p.value > 0)
    .sort((a, b) => a.ms - b.ms);
}

function glucoseOnDay(glucose: TimePoint[], dayKey: string): TimePoint[] {
  return glucose.filter((p) => foodLogDayKey(toMs(p.timestamp)) === dayKey);
}

function avgInWindow(samples: GlucoseSample[], startMs: number, endMs: number): number | null {
  const inWin = samples.filter((s) => s.ms >= startMs && s.ms <= endMs);
  if (inWin.length === 0) return null;
  return Math.round(inWin.reduce((sum, s) => sum + s.value, 0) / inWin.length);
}

function maxInWindow(
  samples: GlucoseSample[],
  startMs: number,
  endMs: number,
): { value: number; ms: number } | null {
  const inWin = samples.filter((s) => s.ms >= startMs && s.ms <= endMs);
  if (inWin.length === 0) return null;
  return inWin.reduce((best, s) => (s.value > best.value ? s : best));
}

function nearestValue(samples: GlucoseSample[], targetMs: number, toleranceMin: number): number | null {
  const tol = toleranceMin * 60 * 1000;
  let best: GlucoseSample | null = null;
  let bestDist = Infinity;
  for (const s of samples) {
    const dist = Math.abs(s.ms - targetMs);
    if (dist <= tol && dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best ? Math.round(best.value) : null;
}

function dayValues(day: TimePoint[]): number[] {
  return day.map((p) => p.value);
}

function formatSessionNotes(sessionStarts?: CgmSessionStart[]): string | null {
  if (!sessionStarts?.length) return null;
  return formatCgmSessionLines(sessionStarts).join(' | ');
}

function formatGlucoseFilterNotes(
  sessionStarts?: CgmSessionStart[],
  cgmStatSummary?: string | null,
): string | null {
  const parts = [formatSessionNotes(sessionStarts), cgmStatSummary].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(' | ') : null;
}

function isInActiveWarmup(sessionStarts: CgmSessionStart[], nowMs = Date.now()): boolean {
  return sessionStarts.some((s) => nowMs >= s.startMs && nowMs < s.startMs + WARMUP_MS);
}

function mealFoodSummary(entry: FoodEntry): string {
  if (entry.items.length === 0) return `${entry.totalKcal} kcal, ${Math.round(entry.totalCarb_g)}g carbs`;
  const names = entry.items.slice(0, 3).map((i) => i.name_local || i.name);
  const suffix = entry.items.length > 3 ? ` +${entry.items.length - 3} more` : '';
  return `${names.join(', ')}${suffix} (${entry.totalKcal} kcal, ${Math.round(entry.totalCarb_g)}g C)`;
}

function mealFoodNames(entry: FoodEntry): string[] {
  return entry.items.map((i) => i.name_local || i.name).filter(Boolean);
}

function classifyResponse(
  peakDelta: number | null,
  peakMgDl: number | null,
  preMealMgDl: number | null,
  postSampleCount: number,
): MealGlucoseResult['assessment'] {
  if (preMealMgDl == null || postSampleCount < 2) return 'insufficient_data';
  if (peakDelta == null) return 'insufficient_data';
  if (peakDelta >= 50 || (peakMgDl != null && peakMgDl >= 180)) return 'sharp_spike';
  if (peakDelta >= 30 || (peakMgDl != null && peakMgDl >= 140)) return 'moderate_rise';
  return 'steady';
}

function assessmentLabel(a: MealGlucoseResult['assessment']): string {
  switch (a) {
    case 'steady':
      return 'steady response';
    case 'moderate_rise':
      return 'moderate post-meal rise';
    case 'sharp_spike':
      return 'sharp spike — review carbs/portions';
    default:
      return 'insufficient CGM data in window';
  }
}

export function analyzeMealGlucoseResponse(
  meals: FoodEntry[],
  glucose: TimePoint[],
): MealGlucoseResult[] {
  if (meals.length === 0 || glucose.length === 0) return [];

  const samples = sortGlucose(glucose);
  const sortedMeals = [...meals].sort((a, b) => a.timestamp - b.timestamp);

  return sortedMeals.map((meal, index) => {
    const t = meal.timestamp;
    const preStart = t - PRE_MEAL_LOOKBACK_MIN * 60 * 1000;
    const preEnd = t;
    const peakStart = t + PEAK_START_AFTER_MIN * 60 * 1000;
    const postEnd = t + POST_MEAL_WINDOW_MIN * 60 * 1000;

    const preMealMgDl = avgInWindow(samples, preStart, preEnd);
    const peak = maxInWindow(samples, peakStart, postEnd);
    const peakMgDl = peak ? Math.round(peak.value) : null;
    const peakDeltaMgDl =
      preMealMgDl != null && peakMgDl != null ? peakMgDl - preMealMgDl : null;
    const peakMinutesAfter =
      peak != null ? Math.round((peak.ms - t) / (60 * 1000)) : null;
    const at60MinMgDl = nearestValue(samples, t + 60 * 60 * 1000, SAMPLE_MATCH_TOLERANCE_MIN);
    const at120MinMgDl = nearestValue(samples, t + POST_MEAL_WINDOW_MIN * 60 * 1000, SAMPLE_MATCH_TOLERANCE_MIN);
    const postSampleCount = samples.filter((s) => s.ms >= peakStart && s.ms <= postEnd).length;

    const assessment = classifyResponse(peakDeltaMgDl, peakMgDl, preMealMgDl, postSampleCount);

    return {
      mealIndex: index + 1,
      mealTimeLabel: new Date(t).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      totalKcal: meal.totalKcal,
      totalCarb_g: meal.totalCarb_g,
      foodSummary: mealFoodSummary(meal),
      preMealMgDl,
      peakMgDl,
      peakDeltaMgDl,
      peakMinutesAfter,
      at60MinMgDl,
      at120MinMgDl,
      postSampleCount,
      assessment,
    };
  });
}

function collectSpikeMeals(dayKey: string, meals: FoodEntry[], glucose: TimePoint[]): SpikeMealRecord[] {
  if (meals.length === 0) return [];
  const dayGlucose = glucoseOnDay(glucose, dayKey);
  if (dayGlucose.length === 0) return [];

  const sortedMeals = [...meals].sort((a, b) => a.timestamp - b.timestamp);
  const results = analyzeMealGlucoseResponse(meals, dayGlucose);

  return results
    .filter((r) => r.assessment === 'sharp_spike' || r.assessment === 'moderate_rise')
    .map((r) => {
      const meal = sortedMeals[r.mealIndex - 1];
      return {
        dayKey,
        mealTimeLabel: r.mealTimeLabel,
        foodNames: meal ? mealFoodNames(meal) : [],
        peakDeltaMgDl: r.peakDeltaMgDl ?? 0,
        assessment: r.assessment,
      };
    });
}

function buildProblemFoodsLines(spikeMeals: SpikeMealRecord[], hasAnyMeals: boolean): string[] {
  if (!hasAnyMeals) {
    return [
      'FOODS LINKED TO HIGHER GLUCOSE: no meals logged in period — log meals with times to identify food triggers.',
    ];
  }
  if (spikeMeals.length === 0) {
    return ['FOODS LINKED TO HIGHER GLUCOSE: no moderate/sharp post-meal rises detected in logged meals'];
  }

  const byFood = new Map<string, { count: number; totalDelta: number }>();
  for (const sm of spikeMeals) {
    for (const name of sm.foodNames) {
      const key = name.trim();
      if (!key) continue;
      const prev = byFood.get(key) ?? { count: 0, totalDelta: 0 };
      byFood.set(key, {
        count: prev.count + 1,
        totalDelta: prev.totalDelta + sm.peakDeltaMgDl,
      });
    }
  }

  const ranked = [...byFood.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].totalDelta - a[1].totalDelta)
    .slice(0, 8);

  const lines = ['FOODS LINKED TO HIGHER GLUCOSE (appeared before moderate/sharp rises — review portions/swaps):'];
  for (const [name, stat] of ranked) {
    const avgDelta = Math.round(stat.totalDelta / stat.count);
    lines.push(`  • ${name} — ${stat.count} meal(s), avg peak rise +${avgDelta} mg/dL`);
  }

  lines.push('', 'MEALS WITH ELEVATED GLUCOSE RESPONSE:');
  for (const sm of spikeMeals) {
    const foods = sm.foodNames.length > 0 ? sm.foodNames.join(', ') : '(items not stored)';
    const tag = sm.assessment === 'sharp_spike' ? 'sharp spike' : 'moderate rise';
    lines.push(
      `  ${sm.dayKey} ${sm.mealTimeLabel}: ${foods} (+${Math.round(sm.peakDeltaMgDl)} mg/dL, ${tag})`,
    );
  }

  return lines;
}

function formatResultLine(r: MealGlucoseResult): string {
  const lines = [`Meal ${r.mealIndex} at ${r.mealTimeLabel}: ${r.foodSummary}`];
  if (r.assessment === 'insufficient_data') {
    lines.push('  CGM: insufficient readings in 25 min before / 2 h after meal');
    return lines.join('\n');
  }
  lines.push(`  Pre-meal (25 min avg): ${r.preMealMgDl} mg/dL`);
  if (r.peakMgDl != null && r.peakDeltaMgDl != null && r.peakMinutesAfter != null) {
    const sign = r.peakDeltaMgDl >= 0 ? '+' : '';
    lines.push(
      `  Peak: ${r.peakMgDl} mg/dL at +${r.peakMinutesAfter} min (${sign}${r.peakDeltaMgDl} mg/dL vs pre-meal)`,
    );
  }
  if (r.at60MinMgDl != null) lines.push(`  At +60 min: ${r.at60MinMgDl} mg/dL`);
  if (r.at120MinMgDl != null) lines.push(`  At +120 min: ${r.at120MinMgDl} mg/dL`);
  lines.push(`  Assessment: ${assessmentLabel(r.assessment)} (${r.postSampleCount} post-meal samples)`);
  return lines.join('\n');
}

function formatDayGlucoseStats(
  glucose: TimePoint[],
  dayKey: string,
  _sessionStarts?: CgmSessionStart[],
): string | null {
  const day = glucoseOnDay(glucose, dayKey);
  if (day.length === 0) return null;

  const vals = dayValues(day);
  if (vals.length === 0) return null;

  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const above140 = vals.filter((v) => v > 140).length;
  const pctAbove140 = Math.round((above140 / vals.length) * 100);
  const assessment = assessGlucoseValues(vals);
  const dist = computeCgmRangeDistribution(vals);
  const rangeLine = dist ? formatCgmRangeDistributionLine(dist) : null;
  const lowDayLine = formatCgmLowDaysLine(summarizeCgmLowDays(glucose, [dayKey]), 'this');
  return [
    `CGM day: avg ${avg} | min ${min} | max ${max} mg/dL | ${pctAbove140}% readings >140 | ${assessment.label} (${vals.length} samples, warm-up excluded)`,
    rangeLine,
    lowDayLine,
  ]
    .filter(Boolean)
    .join(' | ');
}

export type GlucoseAssessment = 'good' | 'watch' | 'concern';

function assessGlucoseValues(vals: number[]): { level: GlucoseAssessment; label: string } {
  if (vals.length === 0) return { level: 'watch', label: 'insufficient data' };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const pctAbove140 = vals.filter((v) => v > 140).length / vals.length;
  const pctBelow70 = vals.filter((v) => v < 70).length / vals.length;

  if (max > 180 || avg > 140 || pctAbove140 > 0.25) {
    return { level: 'concern', label: 'needs attention — elevated readings' };
  }
  if (min < 70 && pctBelow70 > 0.05) {
    return { level: 'concern', label: 'needs attention — low readings' };
  }
  if (max > 140 || avg > 120 || pctAbove140 > 0.1) {
    return { level: 'watch', label: 'mostly OK — some rises to improve' };
  }
  return { level: 'good', label: 'glucose looks good' };
}

function assessGlucosePeriod(
  dayKeys: string[],
  glucose: TimePoint[],
): { level: GlucoseAssessment; label: string; trustedDayCount: number } {
  const levels: GlucoseAssessment[] = [];
  for (const dk of dayKeys) {
    const day = glucoseOnDay(glucose, dk);
    if (day.length === 0) continue;
    const vals = dayValues(day);
    if (vals.length === 0) continue;
    levels.push(assessGlucoseValues(vals).level);
  }
  if (levels.length === 0) {
    return { level: 'watch', label: 'no trusted CGM data in period (warm-up only or no readings)', trustedDayCount: 0 };
  }
  if (levels.some((l) => l === 'concern')) {
    return {
      level: 'concern',
      label: 'trusted days include elevated readings — cite period avg/min/max below',
      trustedDayCount: levels.length,
    };
  }
  if (levels.filter((l) => l === 'watch').length >= Math.ceil(levels.length / 2)) {
    return {
      level: 'watch',
      label: 'mixed trusted days — cite period avg/min/max below',
      trustedDayCount: levels.length,
    };
  }
  return {
    level: 'good',
    label: 'trusted glucose trend looks good — cite period avg/min/max below',
    trustedDayCount: levels.length,
  };
}

function buildPeriodGlucoseStatsLines(
  dayKeys: string[],
  glucose: TimePoint[],
): string[] {
  const trustedVals: number[] = [];
  const dayRows: Array<{ dk: string; avg: number; min: number; max: number }> = [];

  for (const dk of dayKeys) {
    const day = glucoseOnDay(glucose, dk);
    const vals = dayValues(day);
    if (vals.length === 0) continue;
    trustedVals.push(...vals);
    dayRows.push({
      dk,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      min: Math.min(...vals),
      max: Math.max(...vals),
    });
  }

  if (trustedVals.length === 0) {
    return ['Period CGM stats: no trusted readings (sensor warm-up or no data in window)'];
  }

  const periodAvg = Math.round(trustedVals.reduce((a, b) => a + b, 0) / trustedVals.length);
  const periodMin = Math.min(...trustedVals);
  const periodMax = Math.max(...trustedVals);
  const pctAbove140 = Math.round(
    (trustedVals.filter((v) => v > 140).length / trustedVals.length) * 100,
  );

  const highestDays = [...dayRows].sort((a, b) => b.max - a.max).slice(0, 3);
  const highestAvgDays = [...dayRows].sort((a, b) => b.avg - a.avg).slice(0, 3);

  const lines = [
    `Period CGM (trusted, excl. warm-up + rare sensor-error days): avg ${periodAvg} | min ${periodMin} | max ${periodMax} mg/dL | ${pctAbove140}% readings >140 | ${trustedVals.length} samples / ${dayRows.length} days`,
    'Mentor MUST quote period avg, min, and max (mg/dL) in the reply — not vague summaries.',
    ...buildCgmMentorDistributionLines(glucose, dayKeys, 'period'),
  ];

  if (highestDays.length > 0) {
    lines.push(
      `Highest max days: ${highestDays.map((d) => `${d.dk} max ${d.max}`).join(', ')}`,
    );
  }
  if (highestAvgDays.length > 0) {
    lines.push(
      `Highest avg days: ${highestAvgDays.map((d) => `${d.dk} avg ${d.avg}`).join(', ')}`,
    );
  }

  return lines;
}

/** Today CGM summary for mentors when no meals are logged (or appended context). */
export function buildTodayGlucoseAiContext(
  glucose: TimePoint[],
  sessionStarts: CgmSessionStart[] = [],
  cgmStatSummary: string | null = null,
): string | null {
  const todayKey = foodLogDayKey(Date.now());
  const day = glucoseOnDay(glucose, todayKey);
  const filterLine = formatGlucoseFilterNotes(sessionStarts, cgmStatSummary);

  if (day.length === 0) {
    if (isInActiveWarmup(sessionStarts)) {
      return [
        '=== TODAY CGM (CareSens / Health Connect) ===',
        filterLine ?? '',
        'Today is SENSOR WARM-UP (first 24h after install) — readings often falsely low; do NOT alarm on lows.',
        '=== END TODAY CGM ===',
        'Nutritionist/Doctor: explain warm-up if relevant; do not treat warm-up lows as hypoglycemia.',
      ]
        .filter(Boolean)
        .join('\n');
    }
    return null;
  }

  const vals = dayValues(day);
  if (vals.length === 0) return null;

  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const above140 = vals.filter((v) => v > 140).length;
  const pctAbove140 = Math.round((above140 / vals.length) * 100);
  const assessment = assessGlucoseValues(vals);
  const todayDist = computeCgmRangeDistribution(vals);
  const todayLowDays = summarizeCgmLowDays(glucose, [todayKey]);
  const todayLowLine = formatCgmLowDaysLine(todayLowDays, 'today');

  return [
    '=== TODAY CGM (CareSens / Health Connect) ===',
    filterLine ?? '',
    `Samples today (warm-up excluded): ${vals.length} | avg ${avg} | min ${min} | max ${max} mg/dL`,
    `Readings above 140 mg/dL: ${pctAbove140}%`,
    ...(todayDist ? [formatCgmRangeDistributionLine(todayDist)] : []),
    ...(todayLowLine ? [todayLowLine] : []),
    `Assessment: ${assessment.label}`,
    'Mentor MUST cite today avg, min, max (mg/dL) and range percentages in the reply.',
    'No meals logged today — cannot link spikes to specific foods. Log meals with times for food-level feedback.',
    ...(min < 70 || (todayDist?.pctBelow70 ?? 0) > 0
      ? ['If lows appear overnight, consider compression from sleeping on the sensor — confirm with fingerstick if symptomatic.']
      : []),
    '=== END TODAY CGM ===',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Last N calendar days including today — for compact mentor CGM rollup. */
function recentDayKeys(lookbackDays: number): string[] {
  const keys: string[] = [];
  for (let daysAgo = 0; daysAgo < lookbackDays; daysAgo++) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    keys.push(foodLogDayKey(d.getTime()));
  }
  return keys.reverse();
}

/** Compact 7-day CGM block for everyday coach/chat (not full period review). */
export function buildRecentGlucoseSummary(
  glucose: TimePoint[],
  lookbackDays = 7,
  sessionStarts: CgmSessionStart[] = [],
  cgmStatSummary: string | null = null,
): string | null {
  const dayKeys = recentDayKeys(lookbackDays);
  const hasAny = dayKeys.some((dk) => glucoseOnDay(glucose, dk).length > 0);
  if (!hasAny) return null;

  const filterLine = formatGlucoseFilterNotes(sessionStarts, cgmStatSummary);
  const assessment = assessGlucosePeriod(dayKeys, glucose);
  const statsLines = buildPeriodGlucoseStatsLines(dayKeys, glucose);

  const dailyLines = dayKeys
    .map((dk) => formatDayGlucoseStats(glucose, dk))
    .filter(Boolean) as string[];

  return [
    `=== RECENT CGM (last ${lookbackDays} days) ===`,
    filterLine ?? '',
    ...statsLines,
    `Recent assessment: ${assessment.label}`,
    dailyLines.length > 0 ? `Daily trusted stats:\n${dailyLines.map((l) => `  ${l}`).join('\n')}` : '',
    '=== END RECENT CGM ===',
    'Nutritionist 🥗 and Doctor 🩺: CGM is a primary input — MUST interpret avg/min/max in every reply when this block is present.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Meal + glucose or glucose-only mentor block for coach/chat. */
export function buildGlucoseMentorContext(
  meals: FoodEntry[],
  glucose: TimePoint[],
  sessionStarts: CgmSessionStart[] = [],
  cgmStatSummary: string | null = null,
): string | null {
  if (glucose.length === 0) return null;

  const parts: string[] = [];

  if (meals.length > 0) {
    const mealBlock = buildMealGlucoseAiContext(meals, glucose);
    if (mealBlock) parts.push(mealBlock);
  } else {
    const today = buildTodayGlucoseAiContext(glucose, sessionStarts, cgmStatSummary);
    if (today) parts.push(today);
  }

  const recent = buildRecentGlucoseSummary(glucose, 7, sessionStarts, cgmStatSummary);
  if (recent) parts.push(recent);

  return parts.length > 0 ? parts.join('\n\n') : null;
}

/** Compact per-day block for period review daily sections. */
export function buildDayMealGlucoseBlock(meals: FoodEntry[], glucose: TimePoint[], dayKey: string): string | null {
  const dayGlucose = glucoseOnDay(glucose, dayKey);
  if (dayGlucose.length === 0) return null;
  if (meals.length === 0) return formatDayGlucoseStats(glucose, dayKey);

  const results = analyzeMealGlucoseResponse(meals, dayGlucose);
  if (results.length === 0) return formatDayGlucoseStats(glucose, dayKey);

  return ['MEAL GLUCOSE:', ...results.map((r) => `  ${formatResultLine(r).replace(/\n/g, '\n  ')}`)].join('\n');
}

/** Period rollup for /7, /30 reviews — problem foods + per-meal spikes. */
export function buildPeriodMealGlucoseSection(
  dayKeys: string[],
  macrosByDay: Map<string, { entries: FoodEntry[] }>,
  glucose: TimePoint[],
  sessionStarts: CgmSessionStart[] = [],
  cgmStatSummary: string | null = null,
): string | null {
  if (glucose.length === 0) return null;

  const filterLine = formatGlucoseFilterNotes(sessionStarts, cgmStatSummary);
  const spikeMeals: SpikeMealRecord[] = [];
  let daysWithCgm = 0;
  let daysWithMealCorrelation = 0;
  let totalMeals = 0;

  for (const dk of dayKeys) {
    const dayG = glucoseOnDay(glucose, dk);
    if (dayG.length > 0) daysWithCgm++;
    const meals = macrosByDay.get(dk)?.entries ?? [];
    totalMeals += meals.length;
    if (meals.length === 0) continue;
    const results = analyzeMealGlucoseResponse(meals, dayG);
    if (results.some((r) => r.assessment !== 'insufficient_data')) daysWithMealCorrelation++;
    spikeMeals.push(...collectSpikeMeals(dk, meals, glucose));
  }

  const periodAssessment = assessGlucosePeriod(dayKeys, glucose);
  const statsLines = buildPeriodGlucoseStatsLines(dayKeys, glucose);

  const lines = [
    'GLUCOSE & FOOD IMPACT (period):',
    ...(filterLine ? [filterLine] : []),
    `CGM samples in window: ${sortGlucose(glucose).length} | Days with CGM: ${daysWithCgm}/${dayKeys.length} | Trusted days: ${periodAssessment.trustedDayCount}`,
    ...statsLines,
    `Period CGM assessment: ${periodAssessment.label}`,
  ];

  if (totalMeals === 0) {
    lines.push(
      'No meals logged in this period — mentors should still review daily CGM stats below and say if glucose looks good or needs improvement.',
      'Suggest logging meals to connect spikes to specific foods.',
    );
  } else {
    lines.push('Match each meal to pre-meal baseline and 2 h peak (~5 min CGM). Flag foods before moderate/sharp rises.');
  }

  lines.push('', ...buildProblemFoodsLines(spikeMeals, totalMeals > 0));

  return lines.join('\n');
}

function buildTodayProblemFoodsHint(meals: FoodEntry[], results: MealGlucoseResult[]): string | null {
  const sortedMeals = [...meals].sort((a, b) => a.timestamp - b.timestamp);
  const spikeMeals: SpikeMealRecord[] = results
    .filter((r) => r.assessment === 'sharp_spike' || r.assessment === 'moderate_rise')
    .map((r) => ({
      dayKey: foodLogDayKey(sortedMeals[r.mealIndex - 1]?.timestamp ?? Date.now()),
      mealTimeLabel: r.mealTimeLabel,
      foodNames: sortedMeals[r.mealIndex - 1] ? mealFoodNames(sortedMeals[r.mealIndex - 1]) : [],
      peakDeltaMgDl: r.peakDeltaMgDl ?? 0,
      assessment: r.assessment,
    }));

  if (spikeMeals.length === 0) return null;
  return buildProblemFoodsLines(spikeMeals, true).slice(1).join('\n');
}

/** Text block for Gemini — null when no glucose or no meals. */
export function buildMealGlucoseAiContext(meals: FoodEntry[], glucose: TimePoint[]): string | null {
  if (meals.length === 0 || glucose.length === 0) return null;

  const results = analyzeMealGlucoseResponse(meals, glucose);
  if (results.length === 0) return null;

  const sampleCount = sortGlucose(glucose).length;
  const analyzed = results.filter((r) => r.assessment !== 'insufficient_data').length;
  const problemHint = buildTodayProblemFoodsHint(meals, results);

  return [
    '=== MEAL GLUCOSE RESPONSE (CGM ~5 min samples) ===',
    `CGM samples in sync: ${sampleCount} | Meals with usable window: ${analyzed}/${results.length}`,
    ...(analyzed === 0
      ? [
          'Meals logged but post-meal CGM window not yet usable — CGM IS synced; cite today avg/min/max from RECENT CGM; do NOT say CGM unavailable.',
        ]
      : []),
    'Reference: pre-meal avg (25 min before), peak 5–120 min after, +60/+120 min marks.',
    'Ideal post-meal: peak rise often <30–50 mg/dL; 2 h often back toward pre-meal (individual targets vary).',
    '',
    ...(problemHint ? [problemHint, ''] : []),
    ...results.map(formatResultLine),
    '=== END MEAL GLUCOSE RESPONSE ===',
    'Nutritionist/Doctor: name specific foods from spike meals; suggest swaps or smaller portions for repeat offenders.',
  ].join('\n');
}
