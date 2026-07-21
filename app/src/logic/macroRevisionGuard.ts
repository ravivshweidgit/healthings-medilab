/**
 * Guards against unstable auto-apply of macro revisions (esp. carb whiplash on weigh-in).
 * Carb bands use 7d eaten habit + lab lipid flag — not My Rules regex.
 */

import type { DailyMacroTarget, UserRules } from '../services/TargetService';
import type { MacroSuggestion } from '../services/GeminiService';
import {
  medianRecentGeminiCarbs,
  type MacroRevisionLogEntry,
  type MacroRevisionSource,
} from './macroRevisionLog';

export const CARB_AUTO_APPLY_ABS_DELTA_G = 15;
export const CARB_AUTO_APPLY_PCT_DELTA = 0.25;

export type CarbGuidanceBand = {
  min: number;
  max: number;
  label: string;
};

/** Habit / lipid-lab band for auto-apply sanity — My Rules numbers are Gemini-only. */
export function computeCarbGuidanceBand(
  avgEatenCarb7d: number | null,
  _userRules: UserRules | null,
  opts?: { lipidActionable?: boolean },
): CarbGuidanceBand | null {
  if (avgEatenCarb7d == null) return null;

  if (avgEatenCarb7d >= 50) {
    return {
      min: avgEatenCarb7d - 10,
      max: avgEatenCarb7d + 10,
      label: '7d habit anchor',
    };
  }

  if (opts?.lipidActionable) {
    return { min: 50, max: 80, label: 'cholesterol fiber band' };
  }

  return {
    min: Math.max(0, avgEatenCarb7d - 10),
    max: avgEatenCarb7d + 10,
    label: 'low-carb habit',
  };
}

export type AutoApplyBlockAssessment = {
  blocked: boolean;
  reasons: string[];
};

export function assessAutoApplyBlock(opts: {
  proposed: MacroSuggestion;
  saved: DailyMacroTarget | null;
  source: MacroRevisionSource;
  avgEatenCarb7d: number | null;
  userRules: UserRules | null;
  recentLog: MacroRevisionLogEntry[];
  lipidActionable?: boolean;
}): AutoApplyBlockAssessment {
  const reasons: string[] = [];

  if (opts.source === 'fallback') {
    reasons.push('AI fallback (not Gemini)');
  }

  const savedC = opts.saved?.carb_g;
  const proposedC = opts.proposed.carb_g;
  if (savedC != null && savedC > 0) {
    const dAbs = Math.abs(proposedC - savedC);
    const dPct = dAbs / savedC;
    if (dAbs >= CARB_AUTO_APPLY_ABS_DELTA_G) {
      reasons.push(`carb Δ ${dAbs}g vs saved (${savedC}→${proposedC})`);
    }
    if (dPct >= CARB_AUTO_APPLY_PCT_DELTA) {
      reasons.push(`carb Δ ${Math.round(dPct * 100)}% vs saved`);
    }
  }

  const band = computeCarbGuidanceBand(opts.avgEatenCarb7d, opts.userRules, {
    lipidActionable: opts.lipidActionable,
  });
  if (band && (proposedC < band.min || proposedC > band.max)) {
    reasons.push(`carb ${proposedC}g outside ${band.label} (${band.min}–${band.max})`);
  }

  const medianC = medianRecentGeminiCarbs(opts.recentLog);
  if (medianC != null && Math.abs(proposedC - medianC) >= CARB_AUTO_APPLY_ABS_DELTA_G) {
    reasons.push(`carb ${proposedC}g vs recent median ${Math.round(medianC)}g`);
  }

  return { blocked: reasons.length > 0, reasons };
}
