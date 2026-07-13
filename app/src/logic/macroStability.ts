/**
 * Macro target stability — dampen AI jumps toward the active target.
 * Used on auto-apply (weigh-in / lab); explicit Accept still saves full proposal.
 */

import type { DailyMacroTarget } from '../services/TargetService';
import type { MacroSuggestion } from '../services/GeminiService';
import { deriveFiberTargetFromCarbs } from './macroFiberCoupling';

/** Blend toward AI ideal (higher = stickier current). */
export const MACRO_STABILITY_EMA_CURRENT = 0.7;
export const MACRO_STABILITY_EMA_IDEAL = 0.3;

/** Soft daily caps for silent auto-apply after EMA. */
export const MACRO_DAILY_CAP = {
  carbPct: 0.05,
  carbAbsMin_g: 3,
  carbAbsMax_g: 8,
  proteinAbs_g: 5,
  fatAbs_g: 5,
  kcalAbs: 120,
} as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function blendRound(current: number, ideal: number): number {
  return Math.round(MACRO_STABILITY_EMA_CURRENT * current + MACRO_STABILITY_EMA_IDEAL * ideal);
}

function capDelta(current: number, next: number, absCap: number, pctCap?: number): number {
  let maxAbs = absCap;
  if (pctCap != null && current > 0) {
    maxAbs = Math.max(absCap, Math.round(current * pctCap));
  }
  return clamp(next, current - maxAbs, current + maxAbs);
}

/**
 * Move active macros toward AI ideal with EMA + daily caps.
 * Returns null if `current` is missing (first-time: use ideal as-is).
 */
export function dampenMacroSuggestion(
  current: DailyMacroTarget | null,
  ideal: MacroSuggestion,
): MacroSuggestion {
  if (!current) return ideal;

  let protein_g = blendRound(current.protein_g, ideal.protein_g);
  protein_g = capDelta(current.protein_g, protein_g, MACRO_DAILY_CAP.proteinAbs_g);

  let carb_g = blendRound(current.carb_g, ideal.carb_g);
  const carbAbs = Math.max(
    MACRO_DAILY_CAP.carbAbsMin_g,
    Math.min(MACRO_DAILY_CAP.carbAbsMax_g, Math.round(current.carb_g * MACRO_DAILY_CAP.carbPct) || MACRO_DAILY_CAP.carbAbsMin_g),
  );
  carb_g = capDelta(current.carb_g, carb_g, carbAbs, MACRO_DAILY_CAP.carbPct);

  let fat_g = blendRound(current.fat_g, ideal.fat_g);
  fat_g = capDelta(current.fat_g, fat_g, MACRO_DAILY_CAP.fatAbs_g);

  let kcal = blendRound(current.kcal, ideal.kcal);
  kcal = capDelta(current.kcal, kcal, MACRO_DAILY_CAP.kcalAbs);

  // Fiber stays coupled to dampened carbs (canonical app rule).
  const fiber_g = deriveFiberTargetFromCarbs(carb_g);

  const note = `Stabilized toward prior targets (EMA + daily caps). AI ideal was P${ideal.protein_g} C${ideal.carb_g} F${ideal.fat_g} ${ideal.kcal} kcal.`;
  const reasoning = ideal.reasoning?.trim()
    ? `${ideal.reasoning.trim()}\n\n${note}`
    : note;

  return {
    ...ideal,
    protein_g,
    carb_g,
    fat_g,
    fiber_g,
    kcal,
    reasoning,
  };
}
