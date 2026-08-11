/**
 * Unified macro target revision — one pipeline for dashboard, chat, weigh-in, and lab import.
 */

import { Alert } from 'react-native';
import type { MetabolicTrend7dDay } from './metabolicTrend7d';
import {
  applyKidneyMacroGuardrail,
  deriveFiberTargetFromCarbs,
  ensureCarbFiberNet,
  FIBER_FLOOR_CARB_THRESHOLD_G,
  FIBER_TO_CARB_RATIO,
  kidneyProteinCapG,
  macroKcalFromPcf,
  postProcessMacroSuggestion,
  STANDARD_FIBER_TARGET_G,
  type MacroPcf,
} from './macroFiberCoupling';
import { buildPeriodReviewBlock, get7DayAverageBurnKcal, get7DayAverageEatenKcal, get7DayAverageEatenCarb_g } from '../services/ReviewService';
import {
  loadTreatmentMarkers,
  treatmentMarkersHardBlock,
} from '../services/TreatmentMarkerService';
import {
  buildLabsForMacroRevision,
  formatKidneyMarkersSummary,
  getLatestGlycemicLabStatus,
  getLatestKidneyLabStatus,
  getLatestLipidLabStatus,
  type GlycemicLabStatus,
  type KidneyLabStatus,
  type LipidLabStatus,
} from '../services/LabLogService';
import {
  formatGlycemicGuidanceBlock,
  formatKidneyGuidanceBlock,
  formatLipidGuidanceBlock,
} from './macroLabGuidance';
import {
  computeClinicalProfile,
  formatClinicalProfileBlock,
  type ClinicalProfileSummary,
} from './macroClinicalProfile';
import { formatMacroRevisionRulesBlock } from './userRulesContext';
import { getNutritionDirectiveAiContext, getActiveNutritionDirective } from '../services/NutritionDirectiveService';
import { loadMetricsStore, syncMetricsStore } from '../services/MetricsPersistenceService';
import { getManualBody } from '../services/ManualBodyService';
import {
  getBodyTarget,
  getBirthdate,
  getCachedHeightCm,
  getGender,
  getLanguage,
  getMacroTarget,
  getMentors,
  getUserRules,
  listRecentMacroTargetSnapshots,
  saveMacroTarget,
  computeAge,
  withCarbFiberNetTargets,
  type BodyTarget,
  type DailyMacroTarget,
  type UserLanguage,
  type Gender,
  type UserRules,
  getMacroAutoAdjustState,
  saveMacroAutoAdjustState,
  setMacroManualLock,
} from '../services/TargetService';
import {
  reviseMacroTargetsWithGemini,
  extractDirectiveMacroSummary,
  type MacroSuggestion,
  type DirectiveMacroSummary,
} from '../services/GeminiService';
import { captureMacroGeminiPrompt } from '../services/macroPromptExport';
import {
  appendMacroRevisionLog,
  getMacroRevisionLog,
  type MacroRevisionLogEntry,
  type MacroRevisionSource,
  type MacroRevisionTrigger,
} from './macroRevisionLog';
import { assessAutoApplyBlock } from './macroRevisionGuard';
import { dampenMacroSuggestion } from './macroStability';

export type MacroNeedsReviewPayload = {
  proposal: MacroSuggestion;
  source: MacroRevisionSource;
  blockReasons: string[];
  triggerDetail?: string;
};

const GEMINI_AUTO_RETRY_DELAY_MS = 1200;

async function reviseMacroWithGeminiRetry(
  contextText: string,
  lang: UserLanguage | null | undefined,
  retries: number,
): Promise<MacroSuggestion> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await reviseMacroTargetsWithGemini(contextText, lang);
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, GEMINI_AUTO_RETRY_DELAY_MS));
      }
    }
  }
  throw lastErr;
}

export type { MacroRevisionTrigger, MacroRevisionSource };
export { getMacroRevisionLog } from './macroRevisionLog';

export type MacroRevisionResult = {
  suggestion: MacroSuggestion;
  source: MacroRevisionSource;
};

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
  lipidLabStatus: LipidLabStatus | null;
  glycemicLabStatus: GlycemicLabStatus | null;
  avgEatenKcal7d: number | null;
  avgEatenCarb7d: number | null;
  weightDelta14dKg: number | null;
  age: number | null;
  gender: Gender | null;
  clinicalProfile: ClinicalProfileSummary;
  /** AI-extracted HARD macros from active nutritionist directive (null if none / extract failed). */
  directiveMacros: DirectiveMacroSummary | null;
};

/** ~7700 kcal per kg body-weight change (textbook energy density). */
const KCAL_PER_KG_BODYWEIGHT = 7700;
const MAX_DEFICIT_KCAL_ABS = 500;

function absoluteKcalFloor(
  burn: number,
  gender: Gender | null,
  age: number | null,
  burnPct = 0.75,
): number {
  const sexMin = gender === 'female' ? 1400 : gender === 'male' ? 1650 : 1525;
  const ageAdj = age != null && age >= 55 ? 100 : 0;
  return Math.max(sexMin + ageAdj, Math.round(burn * burnPct));
}

/** Max daily deficit when user sets an explicit goal timeline (7700 kcal/kg physics). */
function userTimelineDeficitCap(burn: number, timelineWeeks: number): number {
  const pct =
    timelineWeeks <= 2 ? 0.27 : timelineWeeks <= 4 ? 0.22 : timelineWeeks <= 8 ? 0.18 : 0.15;
  return Math.min(850, Math.round(burn * pct));
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

/** Loss/gain from **current** scale weight vs goal — not start weight at goal creation. */
export function goalDirection(currentKg: number, targetKg: number): GoalDirection {
  if (Math.abs(currentKg - targetKg) < 0.5) return 'maintain';
  return currentKg > targetKg ? 'loss' : 'gain';
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

  const direction = goalDirection(weightKg, targetKg);
  const gapKg = Math.abs(weightKg - targetKg);
  const delta14 = opts.weightDelta14dKg;
  const observedWeekly = observedWeeklyLossKg(delta14);
  const nearGoal = direction === 'loss' && gapKg < 2;

  let scenario: string;
  let rule: string;
  let monitoringNote: string;
  let targetKcal: number;
  let deficitKcal: number;
  let appliedAbsFloor = absFloor;
  let appliedMaxDeficit = maxDeficitKcal;

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
    const timelineWeeks =
      opts.bodyTarget?.targetWeeks ?? opts.bodyTarget?.estimatedWeeks ?? null;
    const useUserTimeline = timelineWeeks != null && timelineWeeks > 0;

    const targetPctBw = targetWeeklyLossPctBw(gapKg, nearGoal);
    let planWeeklyLossKg = useUserTimeline
      ? gapKg / timelineWeeks!
      : weightKg * targetPctBw;

    let deficitFromRate = deficitKcalFromWeeklyKg(planWeeklyLossKg);
    const maxPct = maxDeficitPctTdee(gapKg, nearGoal);
    const maxFromPct = Math.round(burn * maxPct);

    if (useUserTimeline) {
      appliedAbsFloor = absoluteKcalFloor(burn, gender, age, 0.7);
      appliedMaxDeficit = userTimelineDeficitCap(burn, timelineWeeks!);
      const uncappedDeficit = deficitFromRate;
      deficitKcal = Math.min(uncappedDeficit, appliedMaxDeficit);
      scenario = 'user_timeline';
      const timelineSrc =
        opts.bodyTarget?.targetWeeks != null ? 'user timeline' : 'AI timeline estimate';
      const expectedKgAtPace =
        (deficitKcal * 7 * timelineWeeks!) / KCAL_PER_KG_BODYWEIGHT;
      rule =
        `${gapKg.toFixed(1)} kg in ${timelineWeeks} weeks (${timelineSrc}) → ${planWeeklyLossKg.toFixed(2)} kg/wk` +
        (uncappedDeficit > deficitKcal
          ? ` → full gap needs ~${uncappedDeficit} kcal/day; using ~${deficitKcal} kcal/day (≤${Math.round((appliedMaxDeficit / burn) * 100)}% TDEE) → ~${expectedKgAtPace.toFixed(1)} kg in ${timelineWeeks} wk at this pace.`
          : ` → ${deficitKcal} kcal/day deficit (7700 kcal/kg).`);
      monitoringNote =
        'User timeline drives deficit from gap ÷ weeks; short deadlines allow up to ~27% TDEE (~700 kcal at typical burn).';
    } else {
      appliedAbsFloor = absFloor;
      appliedMaxDeficit = maxDeficitKcal;
      deficitKcal = Math.min(deficitFromRate, maxFromPct, maxDeficitKcal);
      const eaten = opts.avgEatenKcal7d;
      const eatenLow = eaten != null && eaten > 0 && eaten < burn - 300;
      const farFromGoal = gapKg >= 2;

      if (observedWeekly != null && planWeeklyLossKg > 0) {
        if (observedWeekly >= planWeeklyLossKg * 1.5) {
          if (farFromGoal || eatenLow) {
            scenario = 'standard_loss_fast_scale';
            rule =
              `Scale losing ${observedWeekly.toFixed(2)} kg/wk (faster than ${planWeeklyLossKg.toFixed(2)} kg/wk) but ${gapKg.toFixed(1)} kg to goal` +
              (eatenLow ? ` and 7d eaten ${Math.round(eaten!)} kcal` : '') +
              ` — keep textbook ~${deficitKcal} kcal/day deficit (no 5% TDEE taper-up).`;
            monitoringNote =
              'Fast scale loss noted; macro target stays on textbook rate until <2 kg to goal and intake nears burn.';
          } else {
            deficitKcal = Math.min(deficitKcal, Math.round(burn * 0.05));
            scenario = 'adaptive_fast_loss';
            rule =
              `Scale: losing ${observedWeekly.toFixed(2)} kg/wk (faster than ${planWeeklyLossKg.toFixed(2)} kg/wk target) → cap at ~5% TDEE (~${Math.round(burn * 0.05)} kcal/day) — do not deepen cut.`;
            monitoringNote =
              'No user timeline set — adaptive taper from scale trend; set target weeks in My Targets to override.';
          }
        } else if (observedWeekly >= planWeeklyLossKg) {
          if (farFromGoal && eatenLow) {
            scenario = 'standard_loss';
            rule =
              `Scale on/at target rate with ${gapKg.toFixed(1)} kg to goal and low 7d eaten (${Math.round(eaten!)} kcal) — textbook ~${deficitKcal} kcal/day deficit.`;
            monitoringNote =
              'On-track scale trend; textbook deficit until near goal or intake rises.';
          } else {
            deficitKcal = Math.min(deficitKcal, Math.round(burn * 0.07));
            scenario = nearGoal ? 'near_goal_on_track' : 'on_track_loss';
            rule =
              `Scale on/at target rate (${observedWeekly.toFixed(2)} vs ${planWeeklyLossKg.toFixed(2)} kg/wk) → ~7% TDEE max (~${Math.round(burn * 0.07)} kcal/day).`;
            monitoringNote =
              'Scale trend matches textbook rate; deficit capped by % TDEE from wearable burn.';
          }
        } else if (nearGoal) {
          scenario = 'near_goal_stable';
          rule =
            `<2 kg to goal — target ${(targetPctBw * 100).toFixed(1)}% BW/wk (${planWeeklyLossKg.toFixed(2)} kg/wk) → ${deficitKcal} kcal/day from energy balance formula.`;
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
    }

    targetKcal = Math.round(burn - deficitKcal);
    targetKcal = Math.max(targetKcal, appliedAbsFloor);
    targetKcal = Math.max(targetKcal, Math.round(burn - appliedMaxDeficit));
    // Loss: intake must stay below measured burn — do not raise toward prior overeating.
    targetKcal = Math.min(targetKcal, Math.round(burn - 50));

    deficitKcal = Math.max(0, burn - targetKcal);
  }

  const deficitPctTdee =
    burn > 0 ? Math.round((Math.abs(burn - targetKcal) / burn) * 1000) / 10 : 0;
  const timelineWeeksForReturn =
    opts.bodyTarget?.targetWeeks ?? opts.bodyTarget?.estimatedWeeks ?? null;
  const targetWeeklyLossKg =
    direction === 'loss'
      ? timelineWeeksForReturn != null && timelineWeeksForReturn > 0
        ? gapKg / timelineWeeksForReturn
        : weightKg * targetWeeklyLossPctBw(gapKg, nearGoal)
      : 0;

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
    absoluteFloorKcal: appliedAbsFloor,
    maxDeficitKcal: appliedMaxDeficit,
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
    '## ENERGY BALANCE (computed — FALLBACK for JSON `kcal` only)',
    '**Do not use** when NUTRITIONIST DIRECTIVE or My Rules state an explicit daily calorie / קלוריות target (those win — Gemini judgment, no code parse).',
    plan.scenario === 'user_timeline'
      ? 'Method: **user timeline** — (kg to goal ÷ target weeks) × 7700 kcal/kg ÷ 7, capped at ~27% TDEE for ≤2 wk deadlines; anchored on **7d wearable burn**. Direction uses **current scale weight** vs goal.'
      : 'Method: textbook % body-weight/week × 7700 kcal/kg, anchored on **7d wearable burn** (not BMR), adapted to **smart-scale 14d trend**. Direction uses **current scale weight** vs goal (not start weight at goal creation).',
    `7-day avg burn (watch TDEE, highest day excluded, ≥6 days with data): ${plan.avgBurn7d} kcal/day`,
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
    'If no explicit kcal in directive/My Rules: set JSON `kcal` to the target above unless CGM lows (<70 trusted day) require holding higher — explain any change in `reasoning`.',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Fat fills remainder toward AI `kcal` when set.
 * ENERGY BALANCE only if AI omitted kcal — never overwrite a directive/rules kcal the model chose.
 */
function applyMacroEnergyTarget<T extends MacroPcf>(
  macros: T,
  plan: MacroEnergyPlan | null,
): T {
  let kcalTarget = macros.kcal > 0 ? macros.kcal : null;
  if (kcalTarget == null && plan != null) {
    kcalTarget = plan.targetKcal;
    if (plan.direction === 'loss' && plan.avgBurn7d > 0) {
      kcalTarget = Math.min(kcalTarget, plan.avgBurn7d - 50);
    }
  }
  if (kcalTarget == null || !(kcalTarget > 0)) return macros;

  const fat_g = Math.max(
    40,
    Math.round((kcalTarget - 4 * macros.protein_g - 4 * macros.carb_g) / 9),
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
  // HARD: nutritionist report macros beat AI + ENERGY BALANCE when extracted.
  processed = applyDirectiveMacroSummary(processed, bundle.directiveMacros);
  processed = postProcessMacroSuggestion(processed, bundle.userRules);

  const hasDirectiveKcal = bundle.directiveMacros?.kcal != null && bundle.directiveMacros.kcal > 0;
  const energyPlan = hasDirectiveKcal
    ? null
    : computeMacroEnergyPlan({
        avgBurn7d: bundle.avgBurn7d,
        weightKg: bundle.weightKg,
        bodyTarget: bundle.bodyTarget,
        weightDelta14dKg: bundle.weightDelta14dKg,
        avgEatenKcal7d: bundle.avgEatenKcal7d,
        age: bundle.age,
        gender: bundle.gender,
      });
  processed = applyMacroEnergyTarget(processed, energyPlan);
  const cp = bundle.clinicalProfile;
  return {
    ...processed,
    clinical_profile: processed.clinical_profile?.trim() || cp.profileLine,
    macro_order: processed.macro_order?.trim() || cp.macroOrder,
    pcf_priority: processed.pcf_priority?.trim() || cp.pcfPriority,
  };
}

function fmtKg(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(decimals)} kg`;
}

function formatBodyTarget(bt: BodyTarget | null): string | null {
  if (!bt) return 'Body target: not set';
  const weeks = bt.targetWeeks ?? bt.estimatedWeeks;
  return [
    `Body target: ${bt.targetWeight_kg} kg | fat ${bt.targetFatPct}% | muscle ${bt.targetMuscleMass_kg} kg`,
    weeks != null && weeks > 0 ? `Timeline: ${weeks} weeks to goal` : null,
    `Start: ${bt.startWeight_kg} kg | muscle ${bt.startMuscle_kg} kg`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatDirectiveMacroHardBlock(summary: DirectiveMacroSummary): string {
  const lines = [
    '## DIRECTIVE MACRO SUMMARY (AI-extracted — HARD for JSON kcal / grams)',
    'These numbers come from the active nutritionist report. They **beat ENERGY BALANCE and ACTIVE targets**. Large jumps from current macros are required and OK.',
  ];
  if (summary.kcal != null) lines.push(`kcal: ${summary.kcal}`);
  if (summary.protein_g != null) lines.push(`protein_g: ${summary.protein_g}`);
  if (summary.fiber_g != null) lines.push(`fiber_g: ${summary.fiber_g}`);
  if (summary.net_carb_g != null) {
    lines.push(`net_carb_g (cap): ${summary.net_carb_g} — set carb_g = net_carb_g + fiber_g`);
  }
  if (summary.carb_g != null) lines.push(`carb_g (total, if stated): ${summary.carb_g}`);
  lines.push('Set JSON `kcal` exactly to the kcal line above when present. Fat fills remaining kcal after P/C.');
  return lines.join('\n');
}

/** Apply AI-extracted directive macros onto a suggestion (HARD). */
function applyDirectiveMacroSummary<T extends MacroPcf>(macros: T, summary: DirectiveMacroSummary | null): T {
  if (!summary) return macros;
  let m = { ...macros };
  if (summary.protein_g != null) m.protein_g = summary.protein_g;
  if (summary.fiber_g != null) m.fiber_g = summary.fiber_g;
  if (summary.net_carb_g != null && summary.net_carb_g > 0) {
    const fi = m.fiber_g > 0 ? m.fiber_g : summary.fiber_g ?? 0;
    m.fiber_g = fi;
    m.carb_g = summary.net_carb_g + fi;
  } else if (summary.carb_g != null) {
    m.carb_g = summary.carb_g;
  }
  if (summary.kcal != null) m.kcal = summary.kcal;
  return ensureCarbFiberNet(m);
}
export function formatCarbGuidanceBlock(opts: {
  avgEatenCarb7d: number | null;
  userRules: UserRules | null;
  lipidLabStatus?: LipidLabStatus | null;
}): string | null {
  const avg = opts.avgEatenCarb7d;
  const lipidPrimary = Boolean(opts.lipidLabStatus?.hasActionableMarker);

  const lines = [
    '## CARB GUIDANCE (computed — habit/lab context only)',
    'HARD numbers for carb / net-carb / fiber come from **NUTRITIONIST DIRECTIVE** and **My Rules** (Gemini judgment — do not rely on this block for those).',
    'When directive/My Rules state net carbs (פחמימות נטו / C−Fi): set fiber → net → `carb_g = net + fiber_g`; net is a cap (smaller OK). Total-carb floors combine by raising fiber, not net.',
  ];

  if (avg == null) {
    return lines.join('\n');
  }

  lines.push(`7d eaten carb avg: ${avg}g/day`);

  if (avg >= 50) {
    lines.push(
      `Habit anchor (only if no explicit carb/net in directive/My Rules): **${avg - 10}–${avg + 10}g**.`,
    );
  } else if (lipidPrimary) {
    const suggest = Math.min(80, Math.max(50, Math.round(avg + 17)));
    lines.push(
      `Eaten avg <50g + lipid labs actionable → unless directive/My Rules say otherwise, favor **50–80g** soluble-fiber carbs; start near **${suggest}g**.`,
    );
  } else {
    lines.push(
      `Low-carb habit: may hold **${Math.max(0, avg - 10)}–${avg + 10}g** if directive/My Rules allow; explain in reasoning.`,
    );
  }

  return lines.join('\n');
}

function formatFiberGuidanceBlock(opts: {
  userRules: UserRules | null;
  lipidLabStatus: LipidLabStatus | null;
}): string {
  const ratioPct = Math.round(FIBER_TO_CARB_RATIO * 100);
  const lipidPrimary = Boolean(opts.lipidLabStatus?.hasActionableMarker);

  const lines = [
    '## FIBER GUIDANCE (computed — default math only)',
    'Explicit fiber grams in NUTRITIONIST DIRECTIVE / My Rules are HARD (Gemini judgment).',
    `Fallback when none stated: fiber_g ≈ round(${ratioPct}% × carb_g), min ${STANDARD_FIBER_TARGET_G}g when carb_g ≥ ${FIBER_FLOOR_CARB_THRESHOLD_G}g; never exceed carb_g.`,
  ];

  if (lipidPrimary) {
    lines.push(
      'LDL/cholesterol labs actionable → soluble-fiber whole foods (veg, seeds, psyllium); example **66g carbs → ~36g fiber** unless directive says otherwise.',
    );
  }

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
  await syncMetricsStore();
  const [macroTarget, bodyTarget, userRules, store, avgBurn7d, avgEatenKcal7d, avgEatenCarb7d, birthdate, heightCm, gender, nutritionDirectiveContext] =
    await Promise.all([
      getMacroTarget(),
      getBodyTarget(),
      getUserRules(),
      loadMetricsStore(),
      get7DayAverageBurnKcal(),
      get7DayAverageEatenKcal(),
      get7DayAverageEatenCarb_g(),
      getBirthdate(),
      getCachedHeightCm(),
      getGender(),
      getNutritionDirectiveAiContext(),
    ]);

  const scan = store.bodyScan;
  const manual = await getManualBody();
  const weightKg = scan?.weightKg ?? manual?.weight_kg ?? null;
  const fatMassKg =
    scan?.fatMassKg ??
    (manual != null ? (manual.weight_kg * manual.fat_pct) / 100 : null);
  const leanMassKg =
    weightKg != null && fatMassKg != null ? weightKg - fatMassKg : null;
  const bmr_kcal = scan?.bmrKcalDay ?? manual?.bmr_kcal ?? null;
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
  const [labs, kidneyLabStatus, lipidLabStatus, glycemicLabStatus, treatStore] = await Promise.all([
    buildLabsForMacroRevision(),
    getLatestKidneyLabStatus(),
    getLatestLipidLabStatus(),
    getLatestGlycemicLabStatus(),
    loadTreatmentMarkers(),
  ]);

  const treatmentMarkersBlock =
    treatStore?.markers?.length ? treatmentMarkersHardBlock(treatStore.markers) : null;

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

  const clinicalProfile = computeClinicalProfile({
    userRules,
    kidney: kidneyLabStatus,
    lipid: lipidLabStatus,
    glycemic: glycemicLabStatus,
    energyPlan: energyPlan
      ? {
          direction: energyPlan.direction,
          observedWeeklyLossKg: energyPlan.observedWeeklyLossKg,
          targetWeeklyLossKg: energyPlan.targetWeeklyLossKg,
        }
      : null,
  });

  const recentSnaps = await listRecentMacroTargetSnapshots(7);

  const lang = await getLanguage();
  const activeDirective = await getActiveNutritionDirective();
  let directiveMacros: DirectiveMacroSummary | null = null;
  if (activeDirective?.fullText?.trim()) {
    try {
      directiveMacros = await extractDirectiveMacroSummary(activeDirective.fullText, lang);
    } catch (e) {
      console.warn('[macroAutoAdjust] directive macro extract failed', e);
    }
  }
  const hasDirectiveKcal = directiveMacros?.kcal != null && directiveMacros.kcal > 0;

  const priorTargetsBlock =
    macroTarget || recentSnaps.length > 0
      ? [
          hasDirectiveKcal
            ? 'ACTIVE / RECENT MACRO TARGETS (context only — DIRECTIVE MACRO SUMMARY wins; large jumps from active targets are required):'
            : 'ACTIVE / RECENT MACRO TARGETS (hold steady unless labs, rules, directive, or clear progress failure require change):',
          macroTarget
            ? `  Active now: ${macroTarget.kcal} kcal · P${macroTarget.protein_g} · C${macroTarget.carb_g} · F${macroTarget.fat_g} · Fi${macroTarget.fiber_g ?? '—'} (${macroTarget.diet_label})`
            : null,
          ...recentSnaps.map(
            (s) =>
              `  ${s.dayKey}: ${s.kcal} kcal · P${s.protein_g} · C${s.carb_g} · F${s.fat_g} · Fi${s.fiber_g}`,
          ),
          hasDirectiveKcal
            ? 'Do not keep the active kcal when DIRECTIVE MACRO SUMMARY lists a different kcal.'
            : 'Prefer small daily titrations (±5% carbs, few grams P/F). Do not regenerate a new plan from scratch when lifestyle is stable.',
        ]
          .filter(Boolean)
          .join('\n')
      : null;

  const contextText = [
    header,
    formatBodyTarget(bodyTarget),
    nutritionDirectiveContext,
    directiveMacros ? formatDirectiveMacroHardBlock(directiveMacros) : null,
    userRules ? formatMacroRevisionRulesBlock(userRules) : null,
    treatmentMarkersBlock,
    formatProfileBasics({ age, gender, heightCm, weightKg, fatMassKg, bmr_kcal, leanMassKg, avgBurn7d }),
    weightTrend14,
    // Omit burn-based ENERGY BALANCE when directive sets kcal — it was anchoring ~2500.
    !hasDirectiveKcal && energyPlan ? formatEnergyBalanceBlock(energyPlan) : null,
    formatClinicalProfileBlock(clinicalProfile),
    formatKidneyGuidanceBlock({ kidney: kidneyLabStatus, leanMassKg, weightKg }),
    formatLipidGuidanceBlock({ lipid: lipidLabStatus, userRules }),
    formatGlycemicGuidanceBlock({ glycemic: glycemicLabStatus }),
    formatCarbGuidanceBlock({ avgEatenCarb7d, userRules, lipidLabStatus }),
    formatFiberGuidanceBlock({ userRules, lipidLabStatus }),
    priorTargetsBlock,
    bodyTrend28,
    labs,
    period7,
    hasDirectiveKcal
      ? 'Derive daily macro TARGETS from DIRECTIVE MACRO SUMMARY first (HARD). Then P/C/Fi/net from directive/My Rules; fat fills remaining kcal.'
      : 'Derive daily macro TARGETS from the raw data above (not meal advice). Start from ACTIVE targets above; only change what the data justifies. Large jumps need a clear clinical or adherence reason.',
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
    lipidLabStatus,
    glycemicLabStatus,
    avgEatenKcal7d,
    avgEatenCarb7d,
    weightDelta14dKg,
    age,
    gender,
    clinicalProfile,
    directiveMacros,
  };
}

export function deterministicMacroFallback(
  bundle: MacroRevisionBundle,
  langCode = 'en',
): MacroSuggestion {
  const burn = bundle.avgBurn7d ?? bundle.bmr_kcal ?? 2000;
  const weightKg = bundle.weightKg ?? bundle.bodyTarget?.startWeight_kg ?? 80;
  const targetKg = bundle.bodyTarget?.targetWeight_kg ?? weightKg;
  const direction = goalDirection(weightKg, targetKg);
  const energyPlan = computeMacroEnergyPlan({
    avgBurn7d: bundle.avgBurn7d ?? burn,
    weightKg: bundle.weightKg,
    bodyTarget: bundle.bodyTarget,
    weightDelta14dKg: bundle.weightDelta14dKg,
    avgEatenKcal7d: bundle.avgEatenKcal7d,
    age: bundle.age,
    gender: bundle.gender,
  });
  const directiveKcal = bundle.directiveMacros?.kcal;
  const targetKcal =
    directiveKcal != null && directiveKcal > 0
      ? directiveKcal
      : (energyPlan?.targetKcal ?? Math.round(burn));
  const deficitKcal =
    energyPlan?.deficitKcal ?? Math.max(0, (bundle.avgBurn7d ?? burn) - targetKcal);

  const lean = bundle.leanMassKg ?? weightKg * 0.75;
  const kidneyCap =
    bundle.kidneyLabStatus?.hasHighMarker
      ? kidneyProteinCapG(bundle.leanMassKg, bundle.weightKg)
      : null;
  let protein_g = Math.round(1.8 * lean);
  if (kidneyCap != null) protein_g = Math.min(protein_g, kidneyCap);

  // Hold saved carbs on Gemini failure — directive/My Rules numbers are AI-only (no regex floors).
  let carb_g = bundle.macroTarget?.carb_g ?? 30;
  let fiber_g = bundle.macroTarget?.fiber_g ?? deriveFiberTargetFromCarbs(carb_g);
  fiber_g = Math.min(fiber_g, carb_g);
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
  return withCarbFiberNetTargets({
    protein_g: result.protein_g,
    fat_g: result.fat_g,
    carb_g: result.carb_g,
    fiber_g: result.fiber_g,
    net_carb_g: result.net_carb_g,
    kcal: result.kcal,
    diet_label: result.diet_label,
    reasoning: result.reasoning,
    clinical_profile: result.clinical_profile,
    macro_order: result.macro_order,
    pcf_priority: result.pcf_priority,
    rulesContext: userRules?.constraints?.length
      ? userRules.constraints.join(' · ')
      : (userRules?.rawText ?? ''),
    mentors,
    aiSuggested: {
      protein_g: result.protein_g,
      fat_g: result.fat_g,
      carb_g: result.carb_g,
      fiber_g: result.fiber_g,
      net_carb_g: result.net_carb_g,
      kcal: result.kcal,
    },
    analyzedAt: now,
  });
}

export async function suggestMacroTargets(opts: {
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
  lang?: UserLanguage | null;
}): Promise<MacroRevisionResult> {
  const bundle = await buildMacroRevisionBundle(opts);
  const lang = opts.lang ?? (await getLanguage());
  await captureMacroGeminiPrompt({
    trigger: opts.trigger,
    triggerDetail: opts.triggerDetail,
    lang,
    contextText: bundle.contextText,
  });
  const langCode = lang?.code ?? 'en';
  const geminiRetries =
    opts.trigger === 'weigh-in' || opts.trigger === 'lab-import' ? 1 : 0;
  let source: MacroRevisionSource = 'gemini';
  let suggestion: MacroSuggestion;
  try {
    const raw = await reviseMacroWithGeminiRetry(bundle.contextText, lang, geminiRetries);
    suggestion = finalizeMacroSuggestion(raw, bundle, langCode);
  } catch (e) {
    console.warn('[macroAutoAdjust] Gemini revision failed, using fallback', e);
    source = 'fallback';
    suggestion = deterministicMacroFallback(bundle, langCode);
  }

  await appendMacroRevisionLog({
    at: new Date().toISOString(),
    trigger: opts.trigger,
    triggerDetail: opts.triggerDetail,
    source,
    kcal: suggestion.kcal,
    protein_g: suggestion.protein_g,
    carb_g: suggestion.carb_g,
    fat_g: suggestion.fat_g,
    fiber_g: suggestion.fiber_g,
    applied: false,
  });

  return { suggestion, source };
}

/** Save macro proposal after explicit user confirm (chat card / dashboard). Sets manual lock. */
export async function confirmMacroTargetFromProposal(
  proposal: MacroSuggestion,
): Promise<DailyMacroTarget> {
  const [userRules, mentors] = await Promise.all([getUserRules(), getMentors()]);
  const target = macroSuggestionToDailyTarget(proposal, userRules, mentors);
  await confirmSavedMacroTarget(target, 'chat-proposal');
  return target;
}

/** After user confirms an already-built DailyMacroTarget (dashboard strip). */
export async function confirmSavedMacroTarget(
  target: DailyMacroTarget,
  trigger: MacroRevisionTrigger = 'dashboard-suggest',
): Promise<void> {
  await saveMacroTarget(target);
  const state = await getMacroAutoAdjustState();
  await saveMacroAutoAdjustState({
    ...state,
    lastKcal: target.kcal,
    lastAdjustedAt: new Date().toISOString(),
    manualLock: true,
  });
  await appendMacroRevisionLog({
    at: new Date().toISOString(),
    trigger,
    triggerDetail: 'user confirmed',
    source: 'gemini',
    kcal: target.kcal,
    protein_g: target.protein_g,
    carb_g: target.carb_g,
    fat_g: target.fat_g,
    fiber_g: target.fiber_g ?? deriveFiberTargetFromCarbs(target.carb_g),
    applied: true,
  });
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

function weighInMacroAlreadyProcessed(
  measuredAt: string,
  weightKg: number,
  log: MacroRevisionLogEntry[],
): boolean {
  const measuredMs = Date.parse(measuredAt);
  if (Number.isNaN(measuredMs)) return false;
  const detail = `${weightKg.toFixed(1)} kg`;
  return log.some((e) => {
    if (e.trigger !== 'weigh-in' || e.triggerDetail !== detail) return false;
    const logMs = Date.parse(e.at);
    return !Number.isNaN(logMs) && logMs >= measuredMs - 60_000;
  });
}
function notifyMacroReviewNeeded(
  trigger: MacroRevisionTrigger,
  triggerDetail: string | undefined,
  proposed: MacroSuggestion,
  blockReasons: string[],
  langCode: string,
): void {
  const he = langCode === 'he';
  const line = `${proposed.kcal} kcal · P${proposed.protein_g} · C${proposed.carb_g} · F${proposed.fat_g}`;
  const title = he ? 'נדרש עדכון מאקרו ידני' : 'Macro review needed';
  const body = he
    ? `לא עודכנו יעדים אוטומטית${triggerDetail ? ` (שקילה ${triggerDetail})` : ''}.\n${line}\nסיבה: ${blockReasons.join('; ')}\nשלח/י /macros בצ'אט תזונאית לאישור.`
    : `Targets were not auto-updated${triggerDetail ? ` (weigh-in ${triggerDetail})` : ''}.\n${line}\nReason: ${blockReasons.join('; ')}\nSend /macros in nutritionist chat to confirm.`;
  Alert.alert(title, body, [{ text: he ? 'הבנתי' : 'OK' }]);
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
  /** Withings measuredAt ISO — new reading even when weight unchanged must re-run revision. */
  measuredAt?: string | null;
  labReportId?: string | null;
  onSaved?: (t: DailyMacroTarget) => void;
  /** When auto-save is blocked — show proposal UI instead of a dead-end alert. */
  onNeedsReview?: (payload: MacroNeedsReviewPayload) => void;
}): Promise<DailyMacroTarget | null> {
  const state = await getMacroAutoAdjustState();
  const lang = await getLanguage();

  if (opts.trigger === 'weigh-in') {
    const w = opts.weightKg;
    const at = opts.measuredAt ?? null;
    if (w == null) return null;

    if (at) {
      const log = await getMacroRevisionLog();
      if (weighInMacroAlreadyProcessed(at, w, log)) return null;
    } else if (Math.abs(state.lastWeightKg - w) < 0.05) {
      return null;
    }

    // Legacy bootstrap: skip only when macros already saved but auto-adjust state never initialized.
    if (state.lastAdjustedAt === '' && state.lastWeightKg === 0 && !state.lastWeighInAt) {
      const saved = await getMacroTarget();
      if (saved) {
        await saveMacroAutoAdjustState({ ...state, lastWeightKg: w, lastWeighInAt: at });
        return null;
      }
    }
  }

  if (opts.trigger === 'lab-import') {
    const id = opts.labReportId;
    if (!id) return null;
    if (state.lastLabReportId === id) return null;
  }

  const { suggestion: proposed, source } = await suggestMacroTargets({
    trigger: opts.trigger,
    triggerDetail: opts.triggerDetail,
    lang,
  });

  const saved = await getMacroTarget();
  const [userRules, mentors, recentLog, avgEatenCarb7d, lipidLabStatus] = await Promise.all([
    getUserRules(),
    getMentors(),
    getMacroRevisionLog(),
    get7DayAverageEatenCarb_g(),
    getLatestLipidLabStatus(),
  ]);

  const block = assessAutoApplyBlock({
    proposed,
    saved,
    source,
    avgEatenCarb7d,
    userRules,
    recentLog,
    lipidActionable: Boolean(lipidLabStatus?.hasActionableMarker),
  });

  const bumpState = async () => {
    if (opts.trigger === 'weigh-in' && opts.weightKg != null) {
      await saveMacroAutoAdjustState({
        ...state,
        lastWeightKg: opts.weightKg,
        lastWeighInAt: opts.measuredAt ?? state.lastWeighInAt,
      });
    }
    if (opts.trigger === 'lab-import' && opts.labReportId) {
      await saveMacroAutoAdjustState({ ...state, lastLabReportId: opts.labReportId });
    }
  };

  if (block.blocked) {
    await appendMacroRevisionLog({
      at: new Date().toISOString(),
      trigger: opts.trigger,
      triggerDetail: opts.triggerDetail,
      source,
      kcal: proposed.kcal,
      protein_g: proposed.protein_g,
      carb_g: proposed.carb_g,
      fat_g: proposed.fat_g,
      fiber_g: proposed.fiber_g,
      applied: false,
      blockReason: block.reasons.join('; '),
    });
    await bumpState();
    if (opts.onNeedsReview) {
      opts.onNeedsReview({
        proposal: proposed,
        source,
        blockReasons: block.reasons,
        triggerDetail: opts.triggerDetail,
      });
    } else {
      notifyMacroReviewNeeded(opts.trigger, opts.triggerDetail, proposed, block.reasons, lang.code);
    }
    return null;
  }

  if (!materiallyChanged(saved, proposed)) {
    await appendMacroRevisionLog({
      at: new Date().toISOString(),
      trigger: opts.trigger,
      triggerDetail: opts.triggerDetail,
      source,
      kcal: proposed.kcal,
      protein_g: proposed.protein_g,
      carb_g: proposed.carb_g,
      fat_g: proposed.fat_g,
      fiber_g: proposed.fiber_g,
      applied: false,
      blockReason: 'unchanged vs saved',
    });
    await bumpState();
    return null;
  }

  // Silent auto-apply: dampen toward current so day-to-day P/C/F don't whiplash.
  const stabilized = dampenMacroSuggestion(saved, proposed);
  if (!materiallyChanged(saved, stabilized)) {
    await appendMacroRevisionLog({
      at: new Date().toISOString(),
      trigger: opts.trigger,
      triggerDetail: opts.triggerDetail,
      source,
      kcal: proposed.kcal,
      protein_g: proposed.protein_g,
      carb_g: proposed.carb_g,
      fat_g: proposed.fat_g,
      fiber_g: proposed.fiber_g,
      applied: false,
      blockReason: 'stabilized delta below material threshold',
    });
    await bumpState();
    return null;
  }

  const target = macroSuggestionToDailyTarget(stabilized, userRules, mentors);
  await saveMacroTarget(target);

  await saveMacroAutoAdjustState({
    lastWeightKg: opts.weightKg ?? state.lastWeightKg,
    lastWeighInAt: opts.measuredAt ?? state.lastWeighInAt,
    lastLabReportId: opts.labReportId ?? state.lastLabReportId,
    lastKcal: target.kcal,
    lastAdjustedAt: new Date().toISOString(),
    manualLock: false,
  });

  await appendMacroRevisionLog({
    at: new Date().toISOString(),
    trigger: opts.trigger,
    triggerDetail: opts.triggerDetail,
    source,
    kcal: target.kcal,
    protein_g: target.protein_g,
    carb_g: target.carb_g,
    fat_g: target.fat_g,
    fiber_g: target.fiber_g ?? deriveFiberTargetFromCarbs(target.carb_g),
    applied: true,
  });

  notifyMacroUpdated(opts.trigger, opts.triggerDetail, stabilized, lang.code);
  opts.onSaved?.(target);
  return target;
}

export async function onMacroTargetUserEdit(): Promise<void> {
  await setMacroManualLock(true);
}
