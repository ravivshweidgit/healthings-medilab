/**
 * Unified macro target revision — one pipeline for dashboard, chat, weigh-in, and lab import.
 */

import { Alert } from 'react-native';
import type { MetabolicTrend7dDay } from './metabolicTrend7d';
import {
  applyKidneyMacroGuardrail,
  deriveFiberTargetFromCarbs,
  macroKcalFromPcf,
  parseCarbCapFromRules,
  postProcessMacroSuggestion,
  type MacroPcf,
} from './macroFiberCoupling';
import { buildPeriodReviewBlock, get7DayAverageBurnKcal, get7DayAverageEatenKcal, get7DayAverageEatenCarb_g } from '../services/ReviewService';
import {
  buildLabsForMacroRevision,
  formatKidneyMarkersSummary,
  getLatestKidneyLabStatus,
  type KidneyLabStatus,
} from '../services/LabLogService';
import { loadWithingsStore, syncWithingsStore } from '../services/WithingsPersistenceService';
import {
  getBodyTarget,
  getBirthdate,
  getCachedHeightCm,
  getGender,
  getLanguage,
  getMacroTarget,
  getMentors,
  getUserRules,
  saveMacroTarget,
  computeAge,
  withFiberTarget,
  type BodyTarget,
  type DailyMacroTarget,
  type UserLanguage,
  type Gender,
  type UserRules,
  getMacroAutoAdjustState,
  saveMacroAutoAdjustState,
  setMacroManualLock,
} from '../services/TargetService';
import { reviseMacroTargetsWithGemini, type MacroSuggestion } from '../services/GeminiService';
import { captureMacroGeminiPrompt } from '../services/macroPromptExport';

export type MacroRevisionTrigger =
  | 'dashboard-suggest'
  | 'chat-proposal'
  | 'weigh-in'
  | 'lab-import';

export type MacroRevisionBundle = {
  contextText: string;
  weightKg: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  bmr_kcal: number | null;
  avgBurn7d: number | null;
  bodyTarget: BodyTarget | null;
  userRules: UserRules | null;
  macroTarget: DailyMacroTarget | null;
  kidneyLabStatus: KidneyLabStatus | null;
  avgEatenKcal7d: number | null;
  avgEatenCarb7d: number | null;
  weightDelta14dKg: number | null;
  age: number | null;
  gender: Gender | null;
};

/** ~7700 kcal per kg body-weight change (textbook energy density). */
const KCAL_PER_KG_BODYWEIGHT = 7700;
const MAX_DEFICIT_KCAL_ABS = 500;

function absoluteKcalFloor(
  burn: number,
  gender: Gender | null,
  age: number | null,
): number {
  const sexMin = gender === 'female' ? 1400 : gender === 'male' ? 1650 : 1525;
  const ageAdj = age != null && age >= 55 ? 100 : 0;
  return Math.max(sexMin + ageAdj, Math.round(burn * 0.75));
}

function deficitKcalFromWeeklyKg(weeklyKg: number): number {
  if (weeklyKg <= 0) return 0;
  return Math.round((weeklyKg * KCAL_PER_KG_BODYWEIGHT) / 7);
}

/** Target loss rate (% body weight / week) by kg remaining — textbook tapering. */
function targetWeeklyLossPctBw(gapKg: number, nearGoal: boolean): number {
  if (gapKg < 0.5) return 0;
  if (nearGoal) return 0.003;
  if (gapKg < 5) return 0.005;
  return 0.007;
}

function observedWeeklyLossKg(delta14: number | null): number | null {
  if (delta14 == null || delta14 >= 0) return delta14 === 0 ? 0 : null;
  return (-delta14 * 7) / 14;
}

function maxDeficitPctTdee(gapKg: number, nearGoal: boolean): number {
  if (nearGoal) return 0.07;
  if (gapKg < 5) return 0.12;
  return 0.2;
}

function weightDeltaKg(days: MetabolicTrend7dDay[], lookback: number): number | null {
  const withWeight = days.filter((d) => d.weightKg != null).slice(-lookback);
  if (withWeight.length < 2) return null;
  const first = withWeight[0]!.weightKg!;
  const last = withWeight[withWeight.length - 1]!.weightKg!;
  return last - first;
}

export type GoalDirection = 'loss' | 'gain' | 'maintain';

export function goalDirection(startKg: number, targetKg: number): GoalDirection {
  if (Math.abs(startKg - targetKg) < 0.5) return 'maintain';
  return startKg > targetKg ? 'loss' : 'gain';
}

export function kcalAdjustmentFromGap(
  weightKg: number,
  targetKg: number,
  direction: GoalDirection,
): number {
  if (direction === 'maintain') return 0;

  if (direction === 'loss') {
    const gapKg = weightKg - targetKg;
    if (gapKg <= 0) return 0;
    return -Math.min(500, Math.max(200, Math.round(gapKg * 150)));
  }

  const gapKg = targetKg - weightKg;
  if (gapKg <= 0) return 0;
  return Math.min(400, Math.max(200, Math.round(gapKg * 120)));
}

export type MacroEnergyPlan = {
  avgBurn7d: number;
  weightKg: number;
  targetKg: number;
  gapKg: number;
  weightDelta14dKg: number | null;
  observedWeeklyLossKg: number | null;
  targetWeeklyLossKg: number;
  direction: GoalDirection;
  deficitKcal: number;
  deficitPctTdee: number;
  targetKcal: number;
  minKcal: number;
  absoluteFloorKcal: number;
  maxDeficitKcal: number;
  scenario: string;
  rule: string;
  monitoringNote: string;
};

export type MacroEnergyPlanInput = {
  avgBurn7d: number | null;
  weightKg: number | null;
  bodyTarget: BodyTarget | null;
  weightDelta14dKg: number | null;
  avgEatenKcal7d: number | null;
  age?: number | null;
  gender?: Gender | null;
};

export function computeMacroEnergyPlan(opts: MacroEnergyPlanInput): MacroEnergyPlan | null {
  const burn = opts.avgBurn7d;
  if (burn == null || burn <= 0) return null;

  const gender = opts.gender ?? null;
  const age = opts.age ?? null;
  const absFloor = absoluteKcalFloor(burn, gender, age);
  const maxDeficitKcal = Math.min(MAX_DEFICIT_KCAL_ABS, Math.round(burn * 0.2));

  const weightKg = opts.weightKg ?? opts.bodyTarget?.startWeight_kg ?? null;
  const targetKg = opts.bodyTarget?.targetWeight_kg ?? weightKg;
  if (weightKg == null || targetKg == null) {
    return {
      avgBurn7d: burn,
      weightKg: weightKg ?? 0,
      targetKg: targetKg ?? 0,
      gapKg: 0,
      weightDelta14dKg: opts.weightDelta14dKg,
      observedWeeklyLossKg: observedWeeklyLossKg(opts.weightDelta14dKg),
      targetWeeklyLossKg: 0,
      direction: 'maintain',
      deficitKcal: 0,
      deficitPctTdee: 0,
      targetKcal: Math.round(burn),
      minKcal: Math.round(burn),
      absoluteFloorKcal: absFloor,
      maxDeficitKcal,
      scenario: 'maintenance',
      rule: 'No weight/goal data — anchor on 7d wearable burn (maintenance).',
      monitoringNote: 'Sources: smartwatch 7d avg burn.',
    };
  }

  const startKg = opts.bodyTarget?.startWeight_kg ?? weightKg;
  const direction = goalDirection(startKg, targetKg);
  const gapKg = Math.abs(weightKg - targetKg);
  const delta14 = opts.weightDelta14dKg;
  const observedWeekly = observedWeeklyLossKg(delta14);
  const nearGoal = direction === 'loss' && gapKg < 2;

  let scenario: string;
  let rule: string;
  let monitoringNote: string;
  let targetKcal: number;
  let deficitKcal: number;

  if (direction === 'maintain') {
    scenario = 'maintenance';
    rule = 'At or past body goal — maintenance at measured 7d burn.';
    monitoringNote =
      'Scale trend at goal; wearable burn is the intake anchor (adaptive maintenance).';
    deficitKcal = 0;
    targetKcal = Math.round(burn);
  } else if (direction === 'gain') {
    const targetWeeklyGainKg = Math.min(0.35, Math.max(0.15, gapKg * 0.05));
    const surplusFromRate = deficitKcalFromWeeklyKg(targetWeeklyGainKg);
    const surplusCap = Math.min(400, Math.round(burn * 0.1));
    const surplusKcal = Math.min(surplusFromRate, surplusCap);
    scenario = 'surplus';
    rule = `Gaining ${gapKg.toFixed(1)} kg to goal — ~${(targetWeeklyGainKg * 100).toFixed(2)}% BW/week → ~${surplusKcal} kcal/day surplus (capped 10% TDEE).`;
    monitoringNote =
      'Scale trend vs goal; surplus derived from target gain rate and wearable burn.';
    deficitKcal = -surplusKcal;
    targetKcal = Math.round(burn + surplusKcal);
  } else {
    const targetPctBw = targetWeeklyLossPctBw(gapKg, nearGoal);
    const targetWeeklyLossKg = weightKg * targetPctBw;
    const deficitFromRate = deficitKcalFromWeeklyKg(targetWeeklyLossKg);
    const maxPct = maxDeficitPctTdee(gapKg, nearGoal);
    const maxFromPct = Math.round(burn * maxPct);
    deficitKcal = Math.min(deficitFromRate, maxFromPct, maxDeficitKcal);

    if (observedWeekly != null && targetWeeklyLossKg > 0) {
      if (observedWeekly >= targetWeeklyLossKg * 1.5) {
        deficitKcal = Math.min(deficitKcal, Math.round(burn * 0.05));
        scenario = 'adaptive_fast_loss';
        rule =
          `Scale: losing ${observedWeekly.toFixed(2)} kg/wk (faster than ${targetWeeklyLossKg.toFixed(2)} kg/wk target) → cap at ~5% TDEE (~${Math.round(burn * 0.05)} kcal/day) — do not deepen cut.`;
        monitoringNote =
          'Smart scale 14d Δ drives adaptive taper; wearable burn anchors TDEE; food log confirms intake.';
      } else if (observedWeekly >= targetWeeklyLossKg) {
        deficitKcal = Math.min(deficitKcal, Math.round(burn * 0.07));
        scenario = nearGoal ? 'near_goal_on_track' : 'on_track_loss';
        rule =
          `Scale on/at target rate (${observedWeekly.toFixed(2)} vs ${targetWeeklyLossKg.toFixed(2)} kg/wk) → ~7% TDEE max (~${Math.round(burn * 0.07)} kcal/day).`;
        monitoringNote =
          'Scale trend matches textbook rate; deficit capped by % TDEE from wearable burn.';
      } else if (nearGoal) {
        scenario = 'near_goal_stable';
        rule =
          `<2 kg to goal — target ${(targetPctBw * 100).toFixed(1)}% BW/wk (${targetWeeklyLossKg.toFixed(2)} kg/wk) → ${deficitKcal} kcal/day from energy balance formula.`;
        monitoringNote =
          'Near goal: conservative % BW/week; burn from watch; scale Δ confirms pace.';
      } else {
        scenario = 'standard_loss';
        rule =
          `${gapKg.toFixed(1)} kg to goal — target ${(targetPctBw * 100).toFixed(1)}% BW/wk → up to ${Math.round(maxPct * 100)}% TDEE deficit (${deficitKcal} kcal/day).`;
        monitoringNote =
          'Textbook % BW/week loss rate; TDEE from 7d wearable burn; scale trend adjusts cap.';
      }
    } else {
      scenario = nearGoal ? 'near_goal_no_trend' : 'standard_loss';
      rule =
        `${gapKg.toFixed(1)} kg to goal — target ${(targetPctBw * 100).toFixed(1)}% BW/wk (${deficitKcal} kcal/day deficit from measured burn).`;
      monitoringNote =
        'Insufficient 14d scale trend — using textbook rate × wearable TDEE; recheck when more weigh-ins.';
    }

    targetKcal = Math.round(burn - deficitKcal);
    targetKcal = Math.max(targetKcal, absFloor);
    targetKcal = Math.max(targetKcal, Math.round(burn - maxDeficitKcal));
    if (opts.avgEatenKcal7d != null && opts.avgEatenKcal7d > 0) {
      targetKcal = Math.max(targetKcal, Math.round(opts.avgEatenKcal7d * 0.95));
    }
    deficitKcal = Math.max(0, burn - targetKcal);
  }

  const deficitPctTdee =
    burn > 0 ? Math.round((Math.abs(burn - targetKcal) / burn) * 1000) / 10 : 0;
  const targetWeeklyLossKg =
    direction === 'loss' ? weightKg * targetWeeklyLossPctBw(gapKg, nearGoal) : 0;

  return {
    avgBurn7d: burn,
    weightKg,
    targetKg,
    gapKg,
    weightDelta14dKg: delta14,
    observedWeeklyLossKg: observedWeekly,
    targetWeeklyLossKg,
    direction,
    deficitKcal: direction === 'gain' ? deficitKcal : deficitKcal,
    deficitPctTdee,
    targetKcal,
    minKcal: targetKcal,
    absoluteFloorKcal: absFloor,
    maxDeficitKcal,
    scenario,
    rule,
    monitoringNote,
  };
}

/** Minimum safe daily kcal — same as energy plan targetKcal. */
export function computeMacroKcalFloor(opts: MacroEnergyPlanInput): number | null {
  return computeMacroEnergyPlan(opts)?.targetKcal ?? null;
}

export function formatEnergyBalanceBlock(plan: MacroEnergyPlan): string {
  const deltaLine =
    plan.weightDelta14dKg != null
      ? `14d weight Δ: ${plan.weightDelta14dKg >= 0 ? '+' : ''}${plan.weightDelta14dKg.toFixed(1)} kg`
      : '14d weight Δ: —';

  const observedLine =
    plan.observedWeeklyLossKg != null
      ? `Observed loss rate (scale): ${plan.observedWeeklyLossKg.toFixed(2)} kg/week`
      : 'Observed loss rate (scale): —';

  const targetRateLine =
    plan.direction === 'loss'
      ? `Target loss rate (textbook): ${plan.targetWeeklyLossKg.toFixed(2)} kg/week (${((plan.targetWeeklyLossKg / plan.weightKg) * 100).toFixed(2)}% body weight)`
      : null;

  const energyLine =
    plan.direction === 'gain'
      ? `Recommended surplus: ${Math.abs(plan.deficitKcal)} kcal/day (${plan.deficitPctTdee}% TDEE)`
      : plan.deficitKcal === 0
        ? 'Recommended deficit: 0 kcal/day (maintenance)'
        : `Recommended deficit: ${plan.deficitKcal} kcal/day (${plan.deficitPctTdee}% of measured TDEE)`;

  const mathLine =
    plan.direction === 'gain'
      ? `Target kcal: ${plan.targetKcal} (= ${plan.avgBurn7d} burn + ${Math.abs(plan.deficitKcal)} surplus)`
      : `Target kcal: ${plan.targetKcal} (= ${plan.avgBurn7d} burn − ${plan.deficitKcal} deficit)`;

  return [
    '## ENERGY BALANCE (computed — use this for JSON `kcal`)',
    'Method: textbook % body-weight/week × 7700 kcal/kg, anchored on **7d wearable burn** (not BMR), adapted to **smart-scale 14d trend** and **7d food intake**.',
    `7-day avg burn (watch TDEE): ${plan.avgBurn7d} kcal/day`,
    `Current ${plan.weightKg.toFixed(1)} kg → goal ${plan.targetKg} kg (${plan.gapKg.toFixed(1)} kg remaining)`,
    deltaLine,
    observedLine,
    targetRateLine,
    `Direction: ${plan.direction}`,
    energyLine,
    mathLine,
    `Rule applied: ${plan.rule}`,
    `Monitoring: ${plan.monitoringNote}`,
    `Hard limits: max ${plan.maxDeficitKcal} kcal below burn (${Math.round(plan.maxDeficitKcal / plan.avgBurn7d * 100)}% TDEE cap); absolute floor ${plan.absoluteFloorKcal} kcal (sex/age/active).`,
    'Set JSON `kcal` to the target above unless CGM lows (<70 trusted day) require holding higher — explain any change in `reasoning`.',
  ]
    .filter(Boolean)
    .join('\n');
}

function applyKcalEnergyFloor<T extends MacroPcf>(macros: T, floorKcal: number): T {
  if (macros.kcal >= floorKcal - 25) return macros;
  const fat_g = Math.max(
    40,
    Math.round((floorKcal - 4 * macros.protein_g - 4 * macros.carb_g) / 9),
  );
  const kcal = macroKcalFromPcf(macros.protein_g, macros.carb_g, fat_g);
  return { ...macros, fat_g, kcal };
}

function finalizeMacroSuggestion(
  raw: MacroSuggestion,
  bundle: MacroRevisionBundle,
  langCode: string,
): MacroSuggestion {
  let processed = postProcessMacroSuggestion(raw, bundle.userRules);
  processed = applyKidneyMacroGuardrail(processed, {
    kidney: bundle.kidneyLabStatus,
    leanMassKg: bundle.leanMassKg,
    weightKg: bundle.weightKg,
    userRules: bundle.userRules,
    langCode,
    markersSummary: bundle.kidneyLabStatus
      ? formatKidneyMarkersSummary(bundle.kidneyLabStatus)
      : undefined,
  });
  const floor = computeMacroKcalFloor({
    avgBurn7d: bundle.avgBurn7d,
    weightKg: bundle.weightKg,
    bodyTarget: bundle.bodyTarget,
    weightDelta14dKg: bundle.weightDelta14dKg,
    avgEatenKcal7d: bundle.avgEatenKcal7d,
    age: bundle.age,
    gender: bundle.gender,
  });
  if (floor != null) {
    processed = applyKcalEnergyFloor(processed, floor);
  }
  return processed;
}

function fmtKg(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(decimals)} kg`;
}

function formatBodyTarget(bt: BodyTarget | null): string | null {
  if (!bt) return 'Body target: not set';
  return [
    `Body target: ${bt.targetWeight_kg} kg | fat ${bt.targetFatPct}% | muscle ${bt.targetMuscleMass_kg} kg`,
    `Start: ${bt.startWeight_kg} kg | muscle ${bt.startMuscle_kg} kg`,
  ].join('\n');
}

function isCholesterolPrimaryGoal(rules: UserRules | null): boolean {
  if (!rules) return false;
  const blob = [rules.summary, rules.aiContext, ...(rules.constraints ?? []), rules.rawText ?? ''].join(' ');
  return /כולסטרול|cholesterol|\bldl\b|שומנים רוויים|saturated/i.test(blob);
}

function hasExplicitLowCarbIntent(rules: UserRules | null): boolean {
  if (!rules) return false;
  if (parseCarbCapFromRules(rules) != null) return true;
  const blob = [rules.summary, rules.aiContext, ...(rules.constraints ?? []), rules.rawText ?? ''].join(' ');
  return /קטו|קטוגנ|ketogenic|\bketo\b|דל.?פחמימ|low.?carb|פחמימות נמוכ/i.test(blob);
}

/** Tiered carb target — habit anchor only when intake is already moderate (≥50g). */
export function formatCarbGuidanceBlock(opts: {
  avgEatenCarb7d: number | null;
  userRules: UserRules | null;
}): string | null {
  const avg = opts.avgEatenCarb7d;
  if (avg == null) return null;

  const cap = parseCarbCapFromRules(opts.userRules);
  if (cap != null) {
    return [
      '## CARB GUIDANCE (computed — use for JSON `carb_g`)',
      `7d eaten carb avg: ${avg}g/day`,
      `My Rules explicit cap: ${cap}g → set carb_g ≤ ${cap}g (adjust only if CGM meal-spikes require lower).`,
    ].join('\n');
  }

  if (avg >= 50) {
    return [
      '## CARB GUIDANCE (computed — use for JSON `carb_g`)',
      `7d eaten carb avg: ${avg}g/day (moderate intake — habit anchor applies)`,
      `→ set carb_g within **${avg - 10}–${avg + 10}g** unless CGM meal-spikes justify change.`,
      'Rationale: at ≥50g/day, staying near logged habit supports adherence (dietitian practice).',
    ].join('\n');
  }

  if (isCholesterolPrimaryGoal(opts.userRules) && !hasExplicitLowCarbIntent(opts.userRules)) {
    const suggestMin = 50;
    const suggestMax = 80;
    const suggest = Math.min(suggestMax, Math.max(suggestMin, Math.round(avg + 17)));
    return [
      '## CARB GUIDANCE (computed — use for JSON `carb_g`)',
      `7d eaten carb avg: ${avg}g/day — **below 50g** (low-carb habit, not required for cholesterol/LDL)`,
      `Primary goal cholesterol → favor **soluble-fiber carbs** (vegetables, legumes, seeds per My Rules) — not carb minimization.`,
      `→ suggest **${suggestMin}–${suggestMax}g** band; start near **${suggest}g** (modest step up from habit).`,
      'Do NOT lock to eaten avg ±10g when avg <50g and goal is lipids — professional practice favors adequate fiber carbs unless CGM spikes or user chose low-carb.',
    ].join('\n');
  }

  return [
    '## CARB GUIDANCE (computed — use for JSON `carb_g`)',
    `7d eaten carb avg: ${avg}g/day (low-carb habit)`,
    `→ may hold **${Math.max(0, avg - 10)}–${avg + 10}g** if intentional low-carb or CGM stable; explain in reasoning.`,
  ].join('\n');
}

function formatUserRulesBlock(rules: UserRules | null): string | null {
  if (!rules) return null;
  const lines = ['My Rules — AI understood:'];
  if (rules.summary) lines.push(`Summary: ${rules.summary}`);
  const ctx = rules.aiContext?.trim();
  if (ctx && !/קטוגנ|ketogenic|\bketo\b/i.test(ctx)) {
    lines.push(`Goals: ${ctx}`);
  }
  for (const c of rules.constraints ?? []) lines.push(`- ${c}`);
  return lines.join('\n');
}

function formatProfileBasics(opts: {
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  fatMassKg: number | null;
  bmr_kcal: number | null;
  leanMassKg: number | null;
  avgBurn7d: number | null;
}): string {
  return [
    `Profile: sex ${opts.gender ?? 'unknown'} | age ${opts.age ?? '—'} | height ${opts.heightCm ?? '—'} cm`,
    `Weight: ${fmtKg(opts.weightKg)} | lean mass ${opts.leanMassKg != null ? `${opts.leanMassKg.toFixed(1)} kg` : '—'} | BMR ${opts.bmr_kcal ?? '—'} kcal/day`,
    `7-day avg burn: ${opts.avgBurn7d ?? '—'} kcal/day`,
  ].join('\n');
}

function formatWeightTrendLines(days: MetabolicTrend7dDay[], lookback: number): string | null {
  const withWeight = days.filter((d) => d.weightKg != null).slice(-lookback);
  if (withWeight.length === 0) return null;
  const lines = [`WEIGHT TREND (${withWeight.length}d):`];
  for (const d of withWeight) {
    lines.push(`  ${d.dayKey}: ${fmtKg(d.weightKg)}`);
  }
  const first = withWeight[0]!.weightKg!;
  const last = withWeight[withWeight.length - 1]!.weightKg!;
  lines.push(`  Δ ${(last - first).toFixed(1)} kg over window`);
  return lines.join('\n');
}

function formatBodyCompTrendLines(days: MetabolicTrend7dDay[], lookback: number): string | null {
  const slice = days.slice(-lookback);
  if (slice.length === 0) return null;
  const lines = [`BODY COMP TREND (${slice.length}d):`];
  for (const d of slice) {
    lines.push(
      `  ${d.dayKey}: W ${fmtKg(d.weightKg)} | fat ${d.fatMassKg != null ? `${d.fatMassKg.toFixed(1)} kg` : '—'} | muscle ${d.muscleMassKg != null ? `${d.muscleMassKg.toFixed(1)} kg` : '—'} | visceral ${d.visceralFatIndex ?? '—'}`,
    );
  }
  return lines.join('\n');
}

export async function buildMacroRevisionBundle(opts: {
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
}): Promise<MacroRevisionBundle> {
  await syncWithingsStore();
  const [macroTarget, bodyTarget, userRules, store, avgBurn7d, avgEatenKcal7d, avgEatenCarb7d, birthdate, heightCm, gender] =
    await Promise.all([
      getMacroTarget(),
      getBodyTarget(),
      getUserRules(),
      loadWithingsStore(),
      get7DayAverageBurnKcal(),
      get7DayAverageEatenKcal(),
      get7DayAverageEatenCarb_g(),
      getBirthdate(),
      getCachedHeightCm(),
      getGender(),
    ]);

  const scan = store.bodyScan;
  const weightKg = scan?.weightKg ?? null;
  const fatMassKg = scan?.fatMassKg ?? null;
  const leanMassKg =
    weightKg != null && fatMassKg != null ? weightKg - fatMassKg : null;
  const bmr_kcal = scan?.bmrKcalDay ?? null;
  const age = birthdate ? computeAge(birthdate) : null;

  const period7 = await buildPeriodReviewBlock(
    { mode: 'days', days: 7 },
    null,
    null,
    { rawDataOnly: true },
  );
  const weightTrend14 = formatWeightTrendLines(store.bodyTrendDays, 14);
  const weightDelta14dKg = weightDeltaKg(store.bodyTrendDays, 14);
  const bodyTrend28 = formatBodyCompTrendLines(store.bodyTrendDays, 28);
  const [labs, kidneyLabStatus] = await Promise.all([
    buildLabsForMacroRevision(),
    getLatestKidneyLabStatus(),
  ]);

  const header = `=== MACRO REVISION (${opts.trigger}${opts.triggerDetail ? `: ${opts.triggerDetail}` : ''}) ===`;

  const energyPlan = computeMacroEnergyPlan({
    avgBurn7d,
    weightKg,
    bodyTarget,
    weightDelta14dKg,
    avgEatenKcal7d,
    age,
    gender,
  });

  const contextText = [
    header,
    formatBodyTarget(bodyTarget),
    formatUserRulesBlock(userRules),
    formatProfileBasics({ age, gender, heightCm, weightKg, fatMassKg, bmr_kcal, leanMassKg, avgBurn7d }),
    weightTrend14,
    energyPlan ? formatEnergyBalanceBlock(energyPlan) : null,
    formatCarbGuidanceBlock({ avgEatenCarb7d, userRules }),
    bodyTrend28,
    labs,
    period7,
    'Derive daily macro TARGETS from the raw data above (not meal advice). Do not copy prior app targets — conclude P/C/F/kcal from weight goal, burn, food eaten, CGM, labs, and rules.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    contextText,
    weightKg,
    fatMassKg,
    leanMassKg,
    bmr_kcal,
    avgBurn7d,
    bodyTarget,
    userRules,
    macroTarget,
    kidneyLabStatus,
    avgEatenKcal7d,
    avgEatenCarb7d,
    weightDelta14dKg,
    age,
    gender,
  };
}

export function deterministicMacroFallback(
  bundle: MacroRevisionBundle,
  langCode = 'en',
): MacroSuggestion {
  const burn = bundle.avgBurn7d ?? bundle.bmr_kcal ?? 2000;
  const weightKg = bundle.weightKg ?? bundle.bodyTarget?.startWeight_kg ?? 80;
  const targetKg = bundle.bodyTarget?.targetWeight_kg ?? weightKg;
  const startKg = bundle.bodyTarget?.startWeight_kg ?? weightKg;
  const direction = goalDirection(startKg, targetKg);
  const energyPlan = computeMacroEnergyPlan({
    avgBurn7d: bundle.avgBurn7d ?? burn,
    weightKg: bundle.weightKg,
    bodyTarget: bundle.bodyTarget,
    weightDelta14dKg: bundle.weightDelta14dKg,
    avgEatenKcal7d: bundle.avgEatenKcal7d,
    age: bundle.age,
    gender: bundle.gender,
  });
  const targetKcal = energyPlan?.targetKcal ?? Math.round(burn);
  const deficitKcal = energyPlan?.deficitKcal ?? Math.max(0, burn - targetKcal);

  const lean = bundle.leanMassKg ?? (weightKg * 0.75);
  const protein_g = Math.round(1.8 * lean);
  const carbCap = parseCarbCapFromRules(bundle.userRules);
  const carb_g = carbCap ?? 30;
  const fiber_g = deriveFiberTargetFromCarbs(carb_g);
  const fat_g = Math.max(
    40,
    Math.round((targetKcal - 4 * protein_g - 4 * carb_g) / 9),
  );
  const kcal = macroKcalFromPcf(protein_g, carb_g, fat_g);

  const diet =
    direction === 'loss'
      ? deficitKcal > 0
        ? 'Low carb · deficit'
        : 'Low carb · maintenance'
      : direction === 'gain'
        ? 'Balanced · surplus'
        : 'Balanced · maintenance';

  const reasoning = energyPlan
    ? `${energyPlan.avgBurn7d} burn − ${deficitKcal} deficit = ${targetKcal} kcal; ${energyPlan.rule}`
    : bundle.avgBurn7d != null
      ? `7d avg burn ${bundle.avgBurn7d}; weight ${weightKg}→${targetKg}; fallback`
      : `BMR-based; weight ${weightKg}→${targetKg}; fallback`;

  return finalizeMacroSuggestion(
    { protein_g, fat_g, carb_g, fiber_g, kcal, diet_label: diet, reasoning },
    bundle,
    langCode,
  );
}

export function macroSuggestionToDailyTarget(
  result: MacroSuggestion,
  userRules: UserRules | null,
  mentors: Awaited<ReturnType<typeof getMentors>>,
): DailyMacroTarget {
  const now = new Date().toISOString();
  return withFiberTarget({
    protein_g: result.protein_g,
    fat_g: result.fat_g,
    carb_g: result.carb_g,
    fiber_g: result.fiber_g,
    kcal: result.kcal,
    diet_label: result.diet_label,
    reasoning: result.reasoning,
    rulesContext: userRules?.constraints?.length
      ? userRules.constraints.join(' · ')
      : (userRules?.rawText ?? ''),
    mentors,
    aiSuggested: {
      protein_g: result.protein_g,
      fat_g: result.fat_g,
      carb_g: result.carb_g,
      fiber_g: result.fiber_g,
      kcal: result.kcal,
    },
    analyzedAt: now,
  });
}

export async function suggestMacroTargets(opts: {
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
  lang?: UserLanguage | null;
}): Promise<MacroSuggestion> {
  const bundle = await buildMacroRevisionBundle(opts);
  const lang = opts.lang ?? (await getLanguage());
  await captureMacroGeminiPrompt({
    trigger: opts.trigger,
    triggerDetail: opts.triggerDetail,
    lang,
    contextText: bundle.contextText,
  });
  const langCode = lang?.code ?? 'en';
  try {
    const raw = await reviseMacroTargetsWithGemini(bundle.contextText, lang);
    return finalizeMacroSuggestion(raw, bundle, langCode);
  } catch {
    return deterministicMacroFallback(bundle, langCode);
  }
}

export function materiallyChanged(
  saved: DailyMacroTarget | null,
  proposed: MacroSuggestion,
): boolean {
  if (!saved) return true;
  if (Math.abs(saved.kcal - proposed.kcal) >= 50) return true;
  if (Math.abs(saved.protein_g - proposed.protein_g) >= 5) return true;
  if (Math.abs(saved.carb_g - proposed.carb_g) >= 5) return true;
  if (Math.abs(saved.fat_g - proposed.fat_g) >= 5) return true;
  const savedFi = saved.fiber_g ?? deriveFiberTargetFromCarbs(saved.carb_g);
  if (Math.abs(savedFi - proposed.fiber_g) >= 5) return true;
  return false;
}

function notifyMacroUpdated(
  trigger: MacroRevisionTrigger,
  triggerDetail: string | undefined,
  result: MacroSuggestion,
  langCode: string,
): void {
  const fi = result.fiber_g;
  const line = `${result.kcal} kcal · P${result.protein_g} · C${result.carb_g} · F${result.fat_g} · Fi${fi}`;
  const he = langCode === 'he';
  let title = he ? 'יעדי המאקרו עודכנו' : 'Macro targets updated';
  let body = result.reasoning;
  if (trigger === 'weigh-in' && triggerDetail) {
    body = he
      ? `אחרי שקילה ${triggerDetail}: ${line}`
      : `After weigh-in ${triggerDetail}: ${line}`;
  } else if (trigger === 'lab-import') {
    body = he ? `אחרי ייבוא בדיקות: ${line}` : `After lab import: ${line}\n${result.reasoning}`;
  } else {
    body = `${line}\n${result.reasoning}`;
  }
  Alert.alert(title, body, [{ text: he ? 'הבנתי' : 'OK' }]);
}

export async function applyAutoMacroRevision(opts: {
  trigger: 'weigh-in' | 'lab-import';
  triggerDetail?: string;
  weightKg?: number | null;
  labReportId?: string | null;
  onSaved?: (t: DailyMacroTarget) => void;
}): Promise<DailyMacroTarget | null> {
  const state = await getMacroAutoAdjustState();
  const lang = await getLanguage();

  if (opts.trigger === 'weigh-in') {
    const w = opts.weightKg;
    if (w == null) return null;
    if (state.lastAdjustedAt === '' && state.lastWeightKg === 0) {
      await saveMacroAutoAdjustState({ ...state, lastWeightKg: w });
      return null;
    }
    if (Math.abs(state.lastWeightKg - w) < 0.05) return null;
  }

  if (opts.trigger === 'lab-import') {
    const id = opts.labReportId;
    if (!id) return null;
    if (state.lastLabReportId === id) return null;
  }

  const proposed = await suggestMacroTargets({
    trigger: opts.trigger,
    triggerDetail: opts.triggerDetail,
    lang,
  });

  const saved = await getMacroTarget();
  if (!materiallyChanged(saved, proposed)) {
    if (opts.trigger === 'weigh-in' && opts.weightKg != null) {
      await saveMacroAutoAdjustState({
        ...state,
        lastWeightKg: opts.weightKg,
        manualLock: false,
      });
    }
    if (opts.trigger === 'lab-import' && opts.labReportId) {
      await saveMacroAutoAdjustState({
        ...state,
        lastLabReportId: opts.labReportId,
        manualLock: false,
      });
    }
    return null;
  }

  const [userRules, mentors] = await Promise.all([getUserRules(), getMentors()]);
  const target = macroSuggestionToDailyTarget(proposed, userRules, mentors);
  await saveMacroTarget(target);

  await saveMacroAutoAdjustState({
    lastWeightKg: opts.weightKg ?? state.lastWeightKg,
    lastLabReportId: opts.labReportId ?? state.lastLabReportId,
    lastKcal: target.kcal,
    lastAdjustedAt: new Date().toISOString(),
    manualLock: false,
  });

  notifyMacroUpdated(opts.trigger, opts.triggerDetail, proposed, lang.code);
  opts.onSaved?.(target);
  return target;
}

export async function onMacroTargetUserEdit(): Promise<void> {
  await setMacroManualLock(true);
}
