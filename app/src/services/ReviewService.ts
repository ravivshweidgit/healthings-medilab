/**
 * Period reviews for mentor chat — on-demand full app snapshot.
 * Everyday chat gets a compact yesterday-workout rollup only.
 *
 * Triggers: natural language ("Weekly summary", "סיכום שבועי") or slash commands
 * (/1 or /yesterday, /7, /30, /100 … up to MAX_REVIEW_DAYS).
 */

import {
  localDayKeyFromMs,
  resolveCompositionPeriodAnchor,
  periodDeltaKg,
  periodEndpointsKg,
  type MetabolicTrend7dDay,
  type CompositionSession,
} from '../logic/metabolicTrend7d';
import { getDailyMacros, buildMealsAiContext } from './FoodLogService';
import {
  buildDayMealGlucoseBlock,
  buildPeriodMealGlucoseSection,
} from '../logic/mealGlucoseAnalysis';
import {
  fetchWorkoutsHistory,
  fetchBodyCompositionTrend7d,
  fetchHeartRateHistory,
  type WorkoutSession,
  type WithingsHeartRatePoint,
  type WithingsCaloriePoint,
  type WithingsIntradayData,
} from './WithingsApiService';
import {
  loadCachedHealthMetrics,
  mergeGlucoseTimePoints,
  filterGlucoseToDayKeys,
  prepareGlucoseSeries,
} from './healthMetricsCache';
import type { CgmSessionStart } from '../logic/cgmWarmupFilter';
import { samsungHealthService, type TimePoint } from './SamsungHealthService';
import type { DailyMacroTarget } from './TargetService';

export const MAX_REVIEW_DAYS = 128;

export type PeriodReviewRequest =
  | { mode: 'yesterday' }
  | { mode: 'days'; days: number };

/** @deprecated use PeriodReviewRequest */
export type PeriodReviewType = 'yesterday' | 'week' | 'month';

export function detectPeriodReviewQuery(text: string): PeriodReviewRequest | null {
  const t = text.trim();

  const slashExact = t.match(/^\/(\d+)\s*$/);
  if (slashExact) {
    const n = parseInt(slashExact[1], 10);
    if (n >= 1 && n <= MAX_REVIEW_DAYS) {
      return n === 1 ? { mode: 'yesterday' } : { mode: 'days', days: n };
    }
  }

  if (/^\/yesterday\s*$/i.test(t)) {
    return { mode: 'yesterday' };
  }

  const slashLead = t.match(/^\/(\d+)\b/);
  if (slashLead) {
    const n = parseInt(slashLead[1], 10);
    if (n >= 1 && n <= MAX_REVIEW_DAYS) {
      return n === 1 ? { mode: 'yesterday' } : { mode: 'days', days: n };
    }
  }

  if (/סיכום אתמול|summary yesterday|yesterday summary|review yesterday|recap yesterday/i.test(t)) {
    return { mode: 'yesterday' };
  }
  if (/סיכום שבועי|weekly summary|week summary|review my week|recap week|how was my week/i.test(t)) {
    return { mode: 'days', days: 7 };
  }
  if (/סיכום חודשי|monthly summary|month summary|review my month|recap month/i.test(t)) {
    return { mode: 'days', days: 30 };
  }
  return null;
}

function dayKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return localDayKeyFromMs(d.getTime());
}

function windowDayKeys(dayCount: number): string[] {
  const keys: string[] = [];
  for (let daysAgo = dayCount; daysAgo >= 1; daysAgo--) {
    keys.push(dayKeyDaysAgo(daysAgo));
  }
  return keys;
}

function reviewDayCount(req: PeriodReviewRequest): number {
  return req.mode === 'yesterday' ? 1 : Math.min(req.days, MAX_REVIEW_DAYS);
}

function periodTitle(req: PeriodReviewRequest, dayKeys: string[]): string {
  if (req.mode === 'yesterday') {
    return `YESTERDAY (${dayKeys[0]})`;
  }
  const from = dayKeys[0];
  const to = dayKeys[dayKeys.length - 1];
  return `LAST ${dayKeys.length} DAYS (${from} → ${to})`;
}

function workoutsOnDay(sessions: WorkoutSession[], dayKey: string): WorkoutSession[] {
  return sessions
    .filter((w) => localDayKeyFromMs(w.startMs) === dayKey)
    .sort((a, b) => a.startMs - b.startMs);
}

function formatWorkout(w: WorkoutSession): string {
  const start = new Date(w.startMs).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const end = new Date(w.endMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const durMin = Math.max(1, Math.round((w.endMs - w.startMs) / 60_000));
  return `${w.activityLabel} ${start}–${end} (${durMin} min, ${Math.round(w.kcal)} kcal active)`;
}

function hrInWindow(
  points: WithingsHeartRatePoint[],
  startMs: number,
  endMs: number,
): WithingsHeartRatePoint[] {
  return points.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return t >= startMs && t <= endMs;
  });
}

/** Daytime HR excluding all workout windows — baseline for intensity comparison. */
function restingHrBaseline(
  dayKey: string,
  hrPoints: WithingsHeartRatePoint[],
  dayWorkouts: WorkoutSession[],
): number | null {
  const dayPts = hrOnDay(hrPoints, dayKey);
  if (dayPts.length === 0) return null;
  const outside = dayPts.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return !dayWorkouts.some((w) => t >= w.startMs && t <= w.endMs);
  });
  if (outside.length < 3) return null;
  const vals = outside.map((p) => p.value);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function formatWorkoutHrLine(
  w: WorkoutSession,
  dayKey: string,
  hrPoints: WithingsHeartRatePoint[],
  dayWorkouts: WorkoutSession[],
): string {
  const dayHr = hrOnDay(hrPoints, dayKey);
  const pts = dayHr.length > 0 ? dayHr : hrPoints;
  const during = hrInWindow(pts, w.startMs, w.endMs);
  if (during.length === 0) return '    HR during session: no watch readings in this window';

  const vals = during.map((p) => p.value);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const max = Math.max(...vals);

  const recovery = hrInWindow(pts, w.endMs + 5 * 60_000, w.endMs + 15 * 60_000);
  const recoveryPart =
    recovery.length > 0
      ? ` | +10 min recovery avg ${Math.round(recovery.reduce((s, p) => s + p.value, 0) / recovery.length)} bpm`
      : '';

  const resting = restingHrBaseline(dayKey, pts, dayWorkouts);
  const baselinePart = resting != null ? ` | resting baseline ~${resting} bpm` : '';

  return `    HR during session: avg ${avg} max ${max} bpm (${during.length} readings)${baselinePart}${recoveryPart}`;
}

function formatWorkoutWithHr(
  w: WorkoutSession,
  dayKey: string,
  hrPoints: WithingsHeartRatePoint[],
  dayWorkouts: WorkoutSession[],
): string {
  return `${formatWorkout(w)}\n${formatWorkoutHrLine(w, dayKey, hrPoints, dayWorkouts)}`;
}

function formatDayWorkouts(
  sessions: WorkoutSession[],
  dayKey: string,
  hrPoints?: WithingsHeartRatePoint[],
): string {
  const list = workoutsOnDay(sessions, dayKey);
  if (list.length === 0) return 'No workouts logged.';
  if (!hrPoints?.length) return list.map(formatWorkout).join('\n  ');
  return list.map((w) => formatWorkoutWithHr(w, dayKey, hrPoints, list)).join('\n  ');
}

function fmtKg(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(decimals);
}

function bodyDayMap(days: MetabolicTrend7dDay[]): Map<string, MetabolicTrend7dDay> {
  return new Map(days.map((d) => [d.dayKey, d]));
}

function computeBurnKcalByDay(
  bodyDays: MetabolicTrend7dDay[],
  caloriePoints: WithingsCaloriePoint[],
  sessions: WorkoutSession[],
): Map<string, number> {
  const BUCKET_MS = 30 * 60 * 1000;
  const bmrByDay = new Map<string, number>();
  for (const d of bodyDays) {
    if (d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay)) {
      bmrByDay.set(d.dayKey, d.bmrKcalDay);
    }
  }

  const passiveByDay = new Map<string, Map<number, number>>();
  for (const pt of caloriePoints) {
    const t = new Date(pt.timestamp).getTime();
    const dk = localDayKeyFromMs(t);
    if (!passiveByDay.has(dk)) passiveByDay.set(dk, new Map());
    const bk = Math.floor(t / BUCKET_MS) * BUCKET_MS;
    const m = passiveByDay.get(dk)!;
    m.set(bk, (m.get(bk) ?? 0) + pt.kcal);
  }

  const workoutKcalByDay = new Map<string, number>();
  const workoutBucketsByDay = new Map<string, Set<number>>();
  for (const w of sessions) {
    const dk = localDayKeyFromMs(w.startMs);
    workoutKcalByDay.set(dk, (workoutKcalByDay.get(dk) ?? 0) + w.kcal);
    if (!workoutBucketsByDay.has(dk)) workoutBucketsByDay.set(dk, new Set());
    const bkSet = workoutBucketsByDay.get(dk)!;
    const firstBk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS;
    for (let bk = firstBk; bk < w.endMs; bk += BUCKET_MS) bkSet.add(bk);
  }

  const allDayKeys = new Set<string>([
    ...bmrByDay.keys(),
    ...passiveByDay.keys(),
    ...workoutKcalByDay.keys(),
  ]);

  const result = new Map<string, number>();
  for (const dk of allDayKeys) {
    const bmr = bmrByDay.get(dk);
    if (bmr == null || !Number.isFinite(bmr)) continue;
    const wktBuckets = workoutBucketsByDay.get(dk) ?? new Set<number>();
    const wktKcal = workoutKcalByDay.get(dk) ?? 0;
    let passiveKcal = 0;
    for (const [bk, kcal] of passiveByDay.get(dk) ?? new Map()) {
      if (!wktBuckets.has(bk)) passiveKcal += kcal;
    }
    result.set(dk, Math.round(bmr + passiveKcal + wktKcal));
  }
  return result;
}

function hrOnDay(points: WithingsHeartRatePoint[], dayKey: string): WithingsHeartRatePoint[] {
  return points.filter((p) => localDayKeyFromMs(new Date(p.timestamp).getTime()) === dayKey);
}

function formatHrSummary(points: WithingsHeartRatePoint[], dayKey: string): string {
  const dayPts = hrOnDay(points, dayKey);
  if (dayPts.length === 0) return 'HEART RATE (24/7): no readings';
  const vals = dayPts.map((p) => p.value);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return `HEART RATE (24/7): avg ${avg} bpm | min ${Math.min(...vals)} | max ${Math.max(...vals)} | ${dayPts.length} readings`;
}

/** Withings intraday + Health Connect watch HR + CGM (HC + app cache + live dashboard). */
async function fetchPeriodIntraday(
  dayCount: number,
  appGlucose?: TimePoint[] | null,
): Promise<WithingsIntradayData & { glucose: TimePoint[]; cgmSessionStarts: CgmSessionStart[]; cgmStatSummary: string | null }> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - dayCount);
  periodStart.setHours(0, 0, 0, 0);

  const [withings, health, cached] = await Promise.all([
    fetchHeartRateHistory(dayCount),
    samsungHealthService.fetchRecentMetrics(periodStart).catch(() => null),
    loadCachedHealthMetrics(),
  ]);

  const heartRate = [...withings.heartRate];
  if (health?.heartRate?.length) {
    for (const p of health.heartRate) {
      heartRate.push({ timestamp: p.timestamp, value: p.value });
    }
    heartRate.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  const mergedRaw = mergeGlucoseTimePoints([
    health?.glucose ?? [],
    cached?.glucose ?? [],
    appGlucose ?? [],
  ]);
  const { filtered, sessionStarts, statFilter } = prepareGlucoseSeries(mergedRaw, cached?.cgmSessionStarts);

  return {
    heartRate,
    calories: withings.calories,
    glucose: filtered,
    cgmSessionStarts: sessionStarts,
    cgmStatSummary: statFilter.summaryLine,
  };
}

function formatBodyMetrics(d: MetabolicTrend7dDay | undefined): string {
  if (!d) return 'BODY: no scale / trend data';
  return [
    'BODY:',
    `wt ${fmtKg(d.weightKg)} kg`,
    `fat ${fmtKg(d.fatMassKg)} kg`,
    `muscle ${fmtKg(d.muscleMassKg)} kg`,
    `visceral ${fmtKg(d.visceralFatIndex)}`,
    `BMR ${d.bmrKcalDay != null ? Math.round(d.bmrKcalDay) : '—'} kcal/day`,
    `Withings activity ${d.activityKcalDay != null ? Math.round(d.activityKcalDay) : '—'} kcal`,
  ].join(' | ');
}

function formatEnergyLine(eaten: number, burn: number | undefined): string {
  if (eaten === 0 && burn == null) return 'ENERGY: no food logged, burn unknown';
  const burnStr = burn != null ? `${burn} kcal estimated burn (BMR+passive+workouts)` : 'burn unknown';
  if (burn == null) return `ENERGY: ${eaten} kcal eaten | ${burnStr}`;
  const balance = eaten - burn;
  const label = balance < 0 ? 'deficit' : balance > 0 ? 'surplus' : 'even';
  return `ENERGY: ${eaten} kcal eaten | ${burnStr} | balance ${balance > 0 ? '+' : ''}${balance} (${label})`;
}

function formatFoodBlock(
  dayKey: string,
  macros: Awaited<ReturnType<typeof getDailyMacros>>,
): string {
  const header = [
    `${Math.round(macros.kcal)} kcal eaten`,
    `P${Math.round(macros.protein_g)}g C${Math.round(macros.carb_g)}g F${Math.round(macros.fat_g)}g`,
    `${macros.entries.length} meals`,
  ].join(' | ');
  if (macros.entries.length === 0) return header;
  const detail = buildMealsAiContext(macros.entries).todayMealsDetail;
  return detail ? `${header}\n${detail}` : header;
}

function buildTrendSection(
  windowKeys: string[],
  bodyDays: MetabolicTrend7dDay[],
  sessions: CompositionSession[],
): string {
  const windowSet = new Set(windowKeys);
  const inWindow = bodyDays.filter((d) => windowSet.has(d.dayKey));
  const anchor = resolveCompositionPeriodAnchor(sessions, windowKeys);

  const weightVals = inWindow.map((d) => d.weightKg);
  const fatVals = inWindow.filter((d) => d.fatMassKg != null).map((d) => d.fatMassKg);
  const muscleVals = inWindow.filter((d) => d.muscleMassKg != null).map((d) => d.muscleMassKg);
  const visceralVals = inWindow.filter((d) => d.visceralFatIndex != null).map((d) => d.visceralFatIndex);
  const bmrVals = inWindow.filter((d) => d.bmrKcalDay != null).map((d) => d.bmrKcalDay as number);

  const lines: string[] = ['TREND ANALYSIS (period):'];

  const wEnd = periodEndpointsKg(weightVals);
  if (wEnd) {
    const dW = periodDeltaKg(weightVals);
    lines.push(`  Weight: ${wEnd.start.toFixed(1)} → ${wEnd.end.toFixed(1)} kg (Δ ${dW != null ? (dW >= 0 ? '+' : '') + dW.toFixed(1) : '—'} kg)`);
  } else {
    lines.push('  Weight: insufficient data');
  }

  if (anchor) {
    const fatDelta = anchor.end.fatMassKg - anchor.start.fatMassKg;
    const muscleDelta = anchor.end.muscleMassKg - anchor.start.muscleMassKg;
    lines.push(
      `  Body comp (Withings BIA ${anchor.start.dayKey}→${anchor.end.dayKey}): fat ${anchor.start.fatMassKg.toFixed(1)}→${anchor.end.fatMassKg.toFixed(1)} kg (Δ ${fatDelta >= 0 ? '+' : ''}${fatDelta.toFixed(1)}), muscle ${anchor.start.muscleMassKg.toFixed(1)}→${anchor.end.muscleMassKg.toFixed(1)} kg (Δ ${muscleDelta >= 0 ? '+' : ''}${muscleDelta.toFixed(1)})`
    );
  }

  const vEnd = periodEndpointsKg(visceralVals);
  if (vEnd) {
    const dV = periodDeltaKg(visceralVals);
    lines.push(`  Visceral index: ${vEnd.start.toFixed(1)} → ${vEnd.end.toFixed(1)} (Δ ${dV != null ? (dV >= 0 ? '+' : '') + dV.toFixed(1) : '—'})`);
  }

  if (bmrVals.length >= 2) {
    const avg = Math.round(bmrVals.reduce((a, b) => a + b, 0) / bmrVals.length);
    lines.push(`  BMR: avg ${avg} kcal/day (${bmrVals.length} days with data)`);
  }

  const fatD = periodDeltaKg(fatVals);
  const muscleD = periodDeltaKg(muscleVals);
  if (fatD != null && !anchor) {
    lines.push(`  Fat mass delta (daily readings): ${fatD >= 0 ? '+' : ''}${fatD.toFixed(1)} kg`);
  }
  if (muscleD != null && !anchor) {
    lines.push(`  Muscle delta (daily readings): ${muscleD >= 0 ? '+' : ''}${muscleD.toFixed(1)} kg`);
  }

  return lines.join('\n');
}

function buildMacroAdherenceSummary(
  dayKeys: string[],
  macrosByDay: Map<string, Awaited<ReturnType<typeof getDailyMacros>>>,
  target: DailyMacroTarget | null | undefined,
): string {
  if (!target) return '';
  let mealDays = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let daysOverCarb = 0;
  let daysUnderProtein = 0;

  for (const dk of dayKeys) {
    const m = macrosByDay.get(dk);
    if (!m || m.entries.length === 0) continue;
    mealDays++;
    totalProtein += m.protein_g;
    totalCarbs += m.carb_g;
    if (m.carb_g > target.carb_g) daysOverCarb++;
    if (m.protein_g < target.protein_g * 0.9) daysUnderProtein++;
  }

  if (mealDays === 0) return 'MACRO ADHERENCE: no logged meals in period';
  return [
    'MACRO ADHERENCE:',
    `${mealDays}/${dayKeys.length} days with meals`,
    `avg P${Math.round(totalProtein / mealDays)}g C${Math.round(totalCarbs / mealDays)}g F target ${target.fat_g}g`,
    `${daysOverCarb} days over carb target (${target.carb_g}g)`,
    `${daysUnderProtein} days under 90% protein target (${target.protein_g}g)`,
  ].join(' | ');
}

/** Compact rollup — included on every chat/coach turn. */
export async function buildYesterdayWorkoutRollup(): Promise<string> {
  const dk = dayKeyDaysAgo(1);
  const [sessions, intraday] = await Promise.all([
    fetchWorkoutsHistory(14),
    fetchHeartRateHistory(3),
  ]);
  const block = formatDayWorkouts(sessions, dk, intraday.heartRate);
  if (block === 'No workouts logged.') {
    return `YESTERDAY WORKOUTS (${dk}): none logged`;
  }
  return `YESTERDAY WORKOUTS (${dk}):\n  ${block}`;
}

/** Full app snapshot — only when user asks for a period review (/7, chips, etc.). */
export async function buildPeriodReviewBlock(
  request: PeriodReviewRequest,
  macroTarget?: DailyMacroTarget | null,
  appGlucose?: TimePoint[] | null,
): Promise<string> {
  const dayCount = reviewDayCount(request);
  const dayKeys = windowDayKeys(dayCount);

  const [workouts, bodyPayload, intraday] = await Promise.all([
    fetchWorkoutsHistory(Math.max(dayCount + 7, 14)),
    fetchBodyCompositionTrend7d(),
    fetchPeriodIntraday(dayCount, appGlucose),
  ]);

  const periodGlucose = filterGlucoseToDayKeys(intraday.glucose, dayKeys);

  const bodyByDay = bodyDayMap(bodyPayload.days);
  const burnByDay = computeBurnKcalByDay(bodyPayload.days, intraday.calories, workouts);
  const macrosList = await Promise.all(dayKeys.map((dk) => getDailyMacros(dk)));
  const macrosByDay = new Map(dayKeys.map((dk, i) => [dk, macrosList[i]]));

  const targetLine = macroTarget
    ? `Macro targets: ${macroTarget.kcal} kcal | P${macroTarget.protein_g}g C${macroTarget.carb_g}g F${macroTarget.fat_g}g`
    : '';

  const lines: string[] = [
    `=== PERIOD REVIEW: ${periodTitle(request, dayKeys)} ===`,
    targetLine,
    '',
    buildTrendSection(dayKeys, bodyPayload.days, bodyPayload.debug.sessions),
    buildMacroAdherenceSummary(dayKeys, macrosByDay, macroTarget),
  ];

  const glucoseSection = buildPeriodMealGlucoseSection(
    dayKeys,
    macrosByDay,
    periodGlucose,
    intraday.cgmSessionStarts,
    intraday.cgmStatSummary,
  );
  if (glucoseSection) {
    lines.push('', glucoseSection);
  } else if (intraday.glucose.length > 0) {
    lines.push(
      '',
      `GLUCOSE: ${intraday.glucose.length} CGM samples loaded but none fall in this ${dayKeys.length}-day review window (days ${dayKeys[0]} → ${dayKeys[dayKeys.length - 1]}). Try a shorter window or check meal/day alignment.`,
    );
  } else {
    lines.push(
      '',
      'GLUCOSE: no CGM data available — sync Health Connect on the dashboard or import CareSens CSV.',
    );
  }

  lines.push('', 'DAILY DETAIL (newest last):');

  for (const dk of dayKeys) {
    const macros = macrosByDay.get(dk)!;
    const eaten = Math.round(macros.kcal);
    const hrLine = formatHrSummary(intraday.heartRate, dk);

    lines.push(
      '',
      `--- ${dk} ---`,
      formatBodyMetrics(bodyByDay.get(dk)),
      formatEnergyLine(eaten, burnByDay.get(dk)),
      hrLine,
      'FOOD & MEALS:',
      formatFoodBlock(dk, macros),
    );

    const dayGlucoseBlock = buildDayMealGlucoseBlock(macros.entries, periodGlucose, dk);
    if (dayGlucoseBlock) {
      lines.push(dayGlucoseBlock);
    }

    lines.push(
      'WORKOUTS (+ HR during each session):',
      `  ${formatDayWorkouts(workouts, dk, intraday.heartRate)}`,
    );
  }

  lines.push('', '=== END PERIOD REVIEW ===');
  return lines.filter((l) => l !== '').join('\n');
}

export const PERIOD_REVIEW_CHAT_INSTRUCTION =
  'When a PERIOD REVIEW block is present: analyze the FULL snapshot — body trends, BMR, energy balance, heart rate, food logs, GLUCOSE & FOOD IMPACT (CGM vs meals), workouts, macro adherence. For GLUCOSE: MUST quote period avg, min, max (mg/dL) from Period CGM stats; exclude first 24h sensor warm-up (falsely low — see CGM sensor start line); never vague phrases like "elevated days" without numbers. For each workout, use HR during session (avg, max, vs resting baseline, recovery) — Coach 💪 leads on this. Nutritionist 🥗 and Doctor 🩺: trusted CGM trend + foods before spikes when meals exist. Say what went well, what to improve, and give 2–4 concrete next steps. Each active mentor must contribute their angle. Cite specific numbers from the block.';
