/**
 * Guards against unstable auto-apply of macro revisions (esp. carb whiplash on weigh-in).
 */

import type { DailyMacroTarget, UserRules } from '../services/TargetService';
import type { MacroSuggestion } from '../services/GeminiService';
import { parseCarbCapFromRules, parseCarbMinFromRules } from './macroFiberCoupling';
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

/** Mirrors CARB GUIDANCE block logic in macroAutoAdjust — for post-Gemini sanity checks. */
export function computeCarbGuidanceBand(
  avgEatenCarb7d: number | null,
  userRules: UserRules | null,
): CarbGuidanceBand | null {
  const rulesFloor = parseCarbMinFromRules(userRules);
  const cap = parseCarbCapFromRules(userRules);

  if (rulesFloor != null) {
    const max = cap != null ? Math.max(rulesFloor, cap) : rulesFloor + 25;
    return { min: rulesFloor, max, label: 'rules floor' };
  }

  if (cap != null) {
    return { min: Math.max(0, cap - 10), max: cap, label: 'rules cap' };
  }
  if (avgEatenCarb7d == null) return null;

  if (avgEatenCarb7d >= 50) {
    return {
      min: avgEatenCarb7d - 10,
      max: avgEatenCarb7d + 10,
      label: '7d habit anchor',
    };
  }

  if (isCholesterolPrimaryGoal(userRules) && !hasExplicitLowCarbIntent(userRules)) {
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
  manualLock: boolean;
}): AutoApplyBlockAssessment {
  const reasons: string[] = [];

  if (opts.manualLock) {
    reasons.push('manual lock (confirmed targets)');
  }
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

  const band = computeCarbGuidanceBand(opts.avgEatenCarb7d, opts.userRules);
  if (band && (proposedC < band.min || proposedC > band.max)) {
    reasons.push(`carb ${proposedC}g outside ${band.label} (${band.min}–${band.max})`);
  }

  const medianC = medianRecentGeminiCarbs(opts.recentLog);
  if (medianC != null && Math.abs(proposedC - medianC) >= CARB_AUTO_APPLY_ABS_DELTA_G) {
    reasons.push(`carb ${proposedC}g vs recent median ${Math.round(medianC)}g`);
  }

  return { blocked: reasons.length > 0, reasons };
}
