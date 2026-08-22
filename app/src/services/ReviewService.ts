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
import { getDailyMacros, buildMealsAiContext, dayMarkerTotals } from './FoodLogService';
import {
  formatMarkerAmountsVsTargets,
  formatTreatmentMarkersTargetLine,
  loadTreatmentMarkers,
  type TreatmentMarker,
} from './TreatmentMarkerService';
import { buildLabsAiContext, getLabReportsForDayKeys } from './LabLogService';
import {
  buildDayMealGlucoseBlock,
  buildPeriodMealGlucoseSection,
} from '../logic/mealGlucoseAnalysis';
import type {
  WorkoutSession,
  WithingsHeartRatePoint,
  WithingsCaloriePoint,
  WithingsIntradayData,
} from './WithingsApiService';
import { hybridWithingsActivityKcal } from './hybridActivityBurn';
import { filterGlucoseToDayKeys } from './healthMetricsCache';
import type { CgmSessionStart } from '../logic/cgmWarmupFilter';
import { loadCgmViewFromStore, syncCgmStore } from './CgmPersistenceService';
import { loadMetricsStore, syncMetricsStore, type MetricsPersistedStore } from './MetricsPersistenceService';
import type { TimePoint } from './HealthConnectService';
import type { DailyMacroTarget } from './TargetService';
import {
  clinicMacroRedesignActive,
  formatEffectiveDailyMacroTargetLine,
  type ResolvedAxisMeter,
} from './ClinicMacroBoundsService';

export const MAX_REVIEW_DAYS = 128;

/** Full per-sample CGM series (HH:MM=mg/dL) included in period reviews up to this many days. */
export const MAX_FULL_CGM_SERIES_DAYS = 7;

export type PeriodReviewRequest =
  | { mode: 'yesterday' }
  | { mode: 'days'; days: number };

/** @deprecated use PeriodReviewRequest */
export type PeriodReviewType = 'yesterday' | 'week' | 'month';

export function detectPeriodReviewQuery(text: string): PeriodReviewRequest | null {
  const t = text.trim();

  // Slash commands only — natural-language "סיכום שבועי" etc. is Gemini judgment in chat.
  if (t === '/yesterday' || t.toLowerCase() === '/yesterday') {
    return { mode: 'yesterday' };
  }

  if (t.startsWith('/') && t.length > 1) {
    const rest = t.slice(1).trim();
    const space = rest.indexOf(' ');
    const numPart = space === -1 ? rest : rest.slice(0, space);
    let n = 0;
    for (let i = 0; i < numPart.length; i++) {
      const d = numPart.charCodeAt(i) - 48;
      if (d < 0 || d > 9) {
        n = 0;
        break;
      }
      n = n * 10 + d;
    }
    if (n >= 1 && n <= MAX_REVIEW_DAYS && (space === -1 || rest.slice(space).trim() === '')) {
      return n === 1 ? { mode: 'yesterday' } : { mode: 'days', days: n };
    }
    // Leading /N with trailing words still counts as period review (existing chat behavior).
    if (n >= 1 && n <= MAX_REVIEW_DAYS && space !== -1) {
      return n === 1 ? { mode: 'yesterday' } : { mode: 'days', days: n };
    }
  }

  return null;
}

function dayKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return localDayKeyFromMs(d.getTime());
}

function windowDayKeys(request: PeriodReviewRequest): string[] {
  // /yesterday → just yesterday. Any /N (and the default 2-day snapshot) is a window
  // that ENDS TODAY: today + the N-1 prior days, oldest first. Excluding today here was a
  // bug — the chat snapshot then missed meals/glucose/workouts logged earlier today.
  if (request.mode === 'yesterday') {
    return [dayKeyDaysAgo(1)];
  }
  const dayCount = Math.min(request.days, MAX_REVIEW_DAYS);
  const keys: string[] = [];
  for (let daysAgo = dayCount - 1; daysAgo >= 0; daysAgo--) {
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

export function computeBurnKcalByDay(
  bodyDays: MetabolicTrend7dDay[],
  caloriePoints: WithingsCaloriePoint[],
  sessions: WorkoutSession[],
): Map<string, number> {
  const BUCKET_MS = 30 * 60 * 1000;
  const bmrByDay = new Map<string, number>();
  const weightByDay = new Map<string, number>();
  const distanceByDay = new Map<string, number>();
  for (const d of bodyDays) {
    if (d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay)) {
      bmrByDay.set(d.dayKey, d.bmrKcalDay);
    }
    if (d.weightKg != null && Number.isFinite(d.weightKg) && d.weightKg > 0) {
      weightByDay.set(d.dayKey, d.weightKg);
    }
    if (d.distanceM != null && Number.isFinite(d.distanceM) && d.distanceM > 0) {
      distanceByDay.set(d.dayKey, d.distanceM);
    }
  }

  const fallbackWeight =
    [...weightByDay.values()].slice(-1)[0]
    ?? bodyDays.map((d) => d.weightKg).filter((w): w is number => w != null && w > 0).slice(-1)[0]
    ?? null;

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
    if (w.source === 'health-connect') continue;
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
    ...distanceByDay.keys(),
  ]);

  const result = new Map<string, number>();
  for (const dk of allDayKeys) {
    const bmr = bmrByDay.get(dk);
    if (bmr == null || !Number.isFinite(bmr)) continue;

    const dist = distanceByDay.get(dk) ?? null;
    const weightKg = weightByDay.get(dk) ?? fallbackWeight;
    if (weightKg != null && weightKg > 0) {
      const activity = hybridWithingsActivityKcal({
        dayKey: dk,
        distanceM: dist,
        weightKg,
        workouts: sessions,
      });
      result.set(dk, Math.round(bmr + activity));
      continue;
    }

    // No weight — legacy fallback.
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

function filterPointsByLookbackDays<T extends { timestamp: string }>(
  points: T[],
  dayCount: number,
): T[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - dayCount);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffMs = cutoff.getTime();
  return points.filter((p) => {
    const ms = Date.parse(p.timestamp);
    return !Number.isNaN(ms) && ms >= cutoffMs;
  });
}

function filterWorkoutsByLookback(sessions: WorkoutSession[], lookbackDays: number): WorkoutSession[] {
  const cutoffMs = Date.now() - lookbackDays * 24 * 3600 * 1000;
  return sessions.filter((s) => s.startMs >= cutoffMs);
}

/** Withings intraday + CGM from local persistence (sync runs before read in callers). */
async function loadPeriodIntradayFromPersistence(
  dayCount: number,
  appGlucose?: TimePoint[] | null,
): Promise<WithingsIntradayData & { glucose: TimePoint[]; glucoseRaw: TimePoint[]; cgmSessionStarts: CgmSessionStart[]; cgmStatSummary: string | null }> {
  const withingsStore = await loadMetricsStore();
  const cgm = await loadCgmViewFromStore(appGlucose);

  return {
    heartRate: filterPointsByLookbackDays(withingsStore.heartRate, dayCount),
    calories: filterPointsByLookbackDays(withingsStore.calories, dayCount),
    glucose: cgm.glucose,
    glucoseRaw: cgm.glucoseRaw,
    cgmSessionStarts: cgm.cgmSessionStarts,
    cgmStatSummary: cgm.cgmStatSummary,
  };
}

/**
 * Full per-day CGM series (every ~5-min sample, RAW — warm-up NOT removed) so the mentor can
 * correlate meal timestamps with glucose timestamps and judge short spikes / compression lows
 * itself. Emitted when the review window is ≤ MAX_FULL_CGM_SERIES_DAYS (7); wider /N reviews
 * keep aggregates + day/night stats only (token budget).
 */
function formatDayGlucoseSeries(glucose: TimePoint[], dayKey: string): string | null {
  const dayPts = glucose
    .filter((p) => localDayKeyFromMs(new Date(p.timestamp).getTime()) === dayKey)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  if (dayPts.length === 0) return null;

  const readings = dayPts.map((p) => {
    const hhmm = new Date(p.timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${hhmm}=${Math.round(p.value)}`;
  });
  const last = dayPts[dayPts.length - 1]!;
  const lastTime = new Date(last.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    `CGM ALL READINGS (${dayPts.length} raw samples, HH:MM=mg/dL — match meal times above to these; warm-up lows NOT removed, so isolated lows may be sensor warm-up or compression):`,
    `  ${readings.join(', ')}`,
    `  Latest reading this day: ${Math.round(last.value)} mg/dL at ${lastTime}`,
  ].join('\n');
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
  treatmentMarkers?: TreatmentMarker[] | null,
): string {
  const header = [
    `${Math.round(macros.kcal)} kcal eaten`,
    `P${Math.round(macros.protein_g)}g C${Math.round(macros.carb_g)}g F${Math.round(macros.fat_g)}g Fi${Math.round(macros.fiber_g ?? 0)}g`,
    `${macros.entries.length} meals`,
  ].join(' | ');
  const treat =
    treatmentMarkers?.length && macros.entries.length
      ? formatMarkerAmountsVsTargets(
          dayMarkerTotals(
            macros.entries,
            treatmentMarkers.map((m) => m.marker),
          ).totals,
          treatmentMarkers,
        )
      : '';
  const head = treat ? `${header} | ${treat}` : header;
  if (macros.entries.length === 0) return head;
  const detail = buildMealsAiContext(macros.entries, treatmentMarkers).todayMealsDetail;
  return detail ? `${head}\n${detail}` : head;
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

/** Eaten totals only — for macro revision (no saved targets or adherence judgments). */
function buildMacroEatenSummary(
  dayKeys: string[],
  macrosByDay: Map<string, Awaited<ReturnType<typeof getDailyMacros>>>,
): string {
  let mealDays = 0;
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;

  for (const dk of dayKeys) {
    const m = macrosByDay.get(dk);
    if (!m || m.entries.length === 0) continue;
    mealDays++;
    totalKcal += m.kcal;
    totalProtein += m.protein_g;
    totalCarbs += m.carb_g;
    totalFat += m.fat_g;
    totalFiber += m.fiber_g ?? 0;
  }

  if (mealDays === 0) return 'FOOD MACROS (7d): no logged meals in period';
  return [
    'FOOD MACROS (7d, eaten only — not targets):',
    `${mealDays}/${dayKeys.length} days with meals`,
    `avg ${Math.round(totalKcal / mealDays)} kcal | P${Math.round(totalProtein / mealDays)}g C${Math.round(totalCarbs / mealDays)}g F${Math.round(totalFat / mealDays)}g Fi${Math.round(totalFiber / mealDays)}g`,
  ].join(' | ');
}

function formatWorkoutRollup(
  sessions: WorkoutSession[],
  hrPoints: WithingsHeartRatePoint[] | undefined,
  daysAgo: number,
  label: 'TODAY' | 'YESTERDAY',
): string {
  const dk = dayKeyDaysAgo(daysAgo);
  const block = formatDayWorkouts(sessions, dk, hrPoints);
  if (block === 'No workouts logged.') {
    return `${label} WORKOUTS (${dk}): none logged`;
  }
  return `${label} WORKOUTS (${dk}):\n  ${block}`;
}

/** Today + yesterday workout lines — persisted Withings or Health Connect activity store. */
export async function buildChatWorkoutRollups(): Promise<{ today: string; yesterday: string }> {
  await syncMetricsStore();
  const store = await loadMetricsStore();
  const sessions = filterWorkoutsByLookback(store.workouts, 14);
  const hrFiltered = filterPointsByLookbackDays(store.heartRate, 3);
  return {
    today: formatWorkoutRollup(sessions, hrFiltered, 0, 'TODAY'),
    yesterday: formatWorkoutRollup(sessions, hrFiltered, 1, 'YESTERDAY'),
  };
}

/** Compact rollup — included on every chat/coach turn. */
export async function buildYesterdayWorkoutRollup(): Promise<string> {
  return (await buildChatWorkoutRollups()).yesterday;
}

export async function buildTodayWorkoutRollup(): Promise<string> {
  return (await buildChatWorkoutRollups()).today;
}

/** Full app snapshot — only when user asks for a period review (/7, chips, etc.). */
export async function buildPeriodReviewBlock(
  request: PeriodReviewRequest,
  macroTarget?: DailyMacroTarget | null,
  appGlucose?: TimePoint[] | null,
  options?: {
    includeLabHistory?: boolean;
    rawDataOnly?: boolean;
    clinicMacroMeters?: ResolvedAxisMeter[];
  },
): Promise<string> {
  const dayCount = reviewDayCount(request);
  const dayKeys = windowDayKeys(request);

  await Promise.all([syncMetricsStore(), syncCgmStore()]);
  const withingsStore = await loadMetricsStore();
  const workoutsFiltered = filterWorkoutsByLookback(
    withingsStore.workouts,
    Math.max(dayCount + 7, 14),
  );
  const bodyPayload = {
    days: withingsStore.bodyTrendDays,
    periodAnchor: null,
    debug: {
      sessions: withingsStore.bodyTrendSessions,
      periodStart: null,
      periodEnd: null,
      lookbackDays: 0,
    },
  };
  const intraday = await loadPeriodIntradayFromPersistence(dayCount, appGlucose);

  const periodGlucose = filterGlucoseToDayKeys(intraday.glucose, dayKeys);
  // RAW samples (warm-up kept) for the full per-sample dump — only used for the short window.
  const periodGlucoseRaw = filterGlucoseToDayKeys(intraday.glucoseRaw, dayKeys);
  const includeFullGlucoseSeries = dayKeys.length <= MAX_FULL_CGM_SERIES_DAYS;

  const bodyByDay = bodyDayMap(bodyPayload.days);
  const burnByDay = computeBurnKcalByDay(bodyPayload.days, intraday.calories, workoutsFiltered);
  const macrosList = await Promise.all(dayKeys.map((dk) => getDailyMacros(dk)));
  const macrosByDay = new Map(dayKeys.map((dk, i) => [dk, macrosList[i]]));
  const treatStore = await loadTreatmentMarkers().catch(() => null);
  const treatmentMarkers = treatStore?.markers?.length ? treatStore.markers : null;

  const rawDataOnly = options?.rawDataOnly === true;
  const clinicMeters = options?.clinicMacroMeters ?? [];
  const redesign = clinicMacroRedesignActive(clinicMeters);
  const classicTarget = !rawDataOnly
    ? redesign
      ? formatEffectiveDailyMacroTargetLine(null, clinicMeters)
      : macroTarget
        ? `Macro targets: ${macroTarget.kcal} kcal | P${macroTarget.protein_g}g C${macroTarget.carb_g}g F${macroTarget.fat_g}g${macroTarget.fiber_g != null ? ` Fi${macroTarget.fiber_g}g` : ''}`
        : ''
    : '';
  const treatTarget =
    !rawDataOnly && treatmentMarkers
      ? formatTreatmentMarkersTargetLine(treatmentMarkers)
      : '';
  const targetLine = [classicTarget, treatTarget].filter(Boolean).join('\n');

  const periodHeader = rawDataOnly
    ? `=== ${dayKeys.length}-DAY RAW DATA (${dayKeys[0]} → ${dayKeys[dayKeys.length - 1]}) ===`
    : `=== PERIOD REVIEW: ${periodTitle(request, dayKeys)} ===`;

  const macroSummaryLine = rawDataOnly
    ? buildMacroEatenSummary(dayKeys, macrosByDay)
    : redesign
      ? buildMacroEatenSummary(dayKeys, macrosByDay)
      : buildMacroAdherenceSummary(dayKeys, macrosByDay, macroTarget);

  const lines: string[] = [
    periodHeader,
    targetLine,
    '',
    buildTrendSection(dayKeys, bodyPayload.days, bodyPayload.debug.sessions),
    macroSummaryLine,
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
      formatFoodBlock(dk, macros, treatmentMarkers),
    );

    const dayGlucoseBlock = buildDayMealGlucoseBlock(macros.entries, periodGlucose, dk);
    if (dayGlucoseBlock) {
      lines.push(dayGlucoseBlock);
    }

    if (includeFullGlucoseSeries) {
      const fullSeries = formatDayGlucoseSeries(periodGlucoseRaw, dk);
      if (fullSeries) lines.push(fullSeries);
    }

    lines.push(
      'WORKOUTS (+ HR during each session):',
      `  ${formatDayWorkouts(workoutsFiltered, dk, intraday.heartRate)}`,
    );
  }

  if (options?.includeLabHistory) {
    const labReports = await getLabReportsForDayKeys(dayKeys);
    const labBlock = buildLabsAiContext(labReports, 'history');
    if (labBlock) lines.push('', labBlock);
  }

  lines.push('', rawDataOnly ? `=== END ${dayKeys.length}-DAY RAW DATA ===` : '=== END PERIOD REVIEW ===');
  return lines.filter((l) => l !== '').join('\n');
}

export const PERIOD_REVIEW_CHAT_INSTRUCTION =
  'When a PERIOD REVIEW or RAW DATA block is present: analyze the FULL snapshot — body trends, BMR, energy balance, heart rate, food logs (incl. FOOD MACROS eaten averages), GLUCOSE & FOOD IMPACT (CGM vs meals), workouts. Do NOT compare to saved app macro targets — judge from what was actually eaten. For GLUCOSE: use Period CGM stats and the CGM DAY vs NIGHT block for day/night averages; for windows ≤7 days each day also has CGM ALL READINGS (every ~5 min, HH:MM=mg/dL) — cite from these, never invent. Exclude first 24h sensor warm-up (falsely low — see CGM sensor start line). For each workout, use HR during session (avg, max, vs resting baseline, recovery) — Coach 💪 leads on this. Nutritionist 🥗 and Doctor 🩺: trusted CGM trend + foods before spikes when meals exist. Say what went well, what to improve, and give 2–4 concrete next steps. Each active mentor must contribute their angle. Cite specific numbers from the block.';

/** Minimum days with burn data before TDEE avg is used for macros. */
const MIN_BURN_DAYS_FOR_TDEE = 6;
/** Prefer this many recent days after expanding lookback if 7d window is sparse. */
const TDEE_BURN_WINDOW_DAYS = 7;

function burnsFromDayKeys(burnByDay: Map<string, number>, dayKeys: string[]): number[] {
  const burns: number[] = [];
  for (const dk of dayKeys) {
    const b = burnByDay.get(dk);
    if (b != null && b > 0) burns.push(b);
  }
  return burns;
}

/** Mean daily burn excluding the single highest day (outlier bike days). */
export function averageBurnExcludingMax(burns: number[]): number | null {
  if (burns.length < MIN_BURN_DAYS_FOR_TDEE) return null;
  const max = Math.max(...burns);
  let removedMax = false;
  const trimmed = burns.filter((b) => {
    if (!removedMax && b === max) {
      removedMax = true;
      return false;
    }
    return true;
  });
  if (trimmed.length === 0) return null;
  return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
}

/** 7-day average total daily burn (BMR + passive + workouts) for macro revision. */
export async function get7DayAverageBurnKcal(): Promise<number | null> {
  await syncMetricsStore();
  const store = await loadMetricsStore();
  const workoutsFiltered = filterWorkoutsByLookback(store.workouts, 14);
  const burnByDay = computeBurnKcalByDay(store.bodyTrendDays, store.calories, workoutsFiltered);

  let burns = burnsFromDayKeys(burnByDay, windowDayKeys({ mode: 'days', days: TDEE_BURN_WINDOW_DAYS }));

  if (burns.length < MIN_BURN_DAYS_FOR_TDEE) {
    const keys14 = windowDayKeys({ mode: 'days', days: 14 });
    const recent: number[] = [];
    for (const dk of keys14) {
      const b = burnByDay.get(dk);
      if (b != null && b > 0) recent.push(b);
    }
    if (recent.length >= MIN_BURN_DAYS_FOR_TDEE) {
      burns = recent.slice(-TDEE_BURN_WINDOW_DAYS);
    }
  }

  return averageBurnExcludingMax(burns);
}

/** 7-day average kcal eaten (days with logged meals only). */
export async function get7DayAverageEatenKcal(): Promise<number | null> {
  const dayKeys = windowDayKeys({ mode: 'days', days: 7 });
  const macrosList = await Promise.all(dayKeys.map((dk) => getDailyMacros(dk)));
  const kcals: number[] = [];
  for (const m of macrosList) {
    if (m.entries.length > 0 && m.kcal > 0) kcals.push(m.kcal);
  }
  if (kcals.length === 0) return null;
  return Math.round(kcals.reduce((a, b) => a + b, 0) / kcals.length);
}

/** 7-day average carbs eaten (days with logged meals only). */
export async function get7DayAverageEatenCarb_g(): Promise<number | null> {
  const dayKeys = windowDayKeys({ mode: 'days', days: 7 });
  const macrosList = await Promise.all(dayKeys.map((dk) => getDailyMacros(dk)));
  const carbs: number[] = [];
  for (const m of macrosList) {
    if (m.entries.length > 0) carbs.push(m.carb_g);
  }
  if (carbs.length === 0) return null;
  return Math.round(carbs.reduce((a, b) => a + b, 0) / carbs.length);
}
