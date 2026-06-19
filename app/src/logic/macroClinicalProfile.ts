/**
 * Deterministic clinical profile for macro revision — computed from labs, rules, energy plan.
 * User-facing profile: professional medical English (international clinical notation).
 */

import type { UserRules } from '../services/TargetService';
import type {
  GlycemicLabStatus,
  KidneyLabStatus,
  LipidLabStatus,
} from '../services/LabLogService';
import { parseCarbCapFromRules } from './macroFiberCoupling';

export type ClinicalProfileEnergyInput = {
  direction: 'loss' | 'gain' | 'maintain';
  observedWeeklyLossKg: number | null;
  targetWeeklyLossKg: number;
};

export type ClinicalProfilePrimary = 'lipid' | 'glycemic' | 'weight' | 'explicit_low_carb';

export type ClinicalProfileSummary = {
  primary: ClinicalProfilePrimary;
  /** Clinical profile line for JSON / UI, e.g. "Lipid-primary + renal protein cap". */
  profileLine: string;
  macroOrder: string;
  pcfPriority: string;
  primaryLabel: string;
  constraintKeys: Array<'kidney' | 'energy_cautious'>;
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

function isEnergyCautious(plan: ClinicalProfileEnergyInput | null): boolean {
  if (!plan || plan.direction !== 'loss') return false;
  if (plan.observedWeeklyLossKg == null || plan.targetWeeklyLossKg <= 0) return false;
  return plan.observedWeeklyLossKg > plan.targetWeeklyLossKg * 1.05;
}

function primaryClinicalLabel(primary: ClinicalProfilePrimary): string {
  switch (primary) {
    case 'lipid':
      return 'Lipid-primary';
    case 'glycemic':
      return 'Glycemic-primary';
    case 'explicit_low_carb':
      return 'Explicit low-carb';
    default:
      return 'Body-composition-primary';
  }
}

function constraintClinicalLabel(key: 'kidney' | 'energy_cautious'): string {
  return key === 'kidney' ? 'renal protein cap' : 'adaptive deficit caution';
}

function macroOrderForProfile(primary: ClinicalProfilePrimary, hasKidney: boolean): string {
  if (primary === 'explicit_low_carb') {
    return 'kcal → carb cap → protein → fat remainder';
  }
  if (primary === 'glycemic') {
    return 'kcal → carbs/fiber → protein → fat remainder';
  }
  if (hasKidney && primary === 'lipid') {
    return 'kcal → protein cap → carbs/fiber → fat remainder';
  }
  return 'kcal → protein → carbs/fiber → fat remainder';
}

function pcfPriorityForProfile(primary: ClinicalProfilePrimary, hasKidney: boolean): string {
  if (primary === 'explicit_low_carb') {
    return 'C (cap) → P → F (remainder)';
  }
  if (primary === 'glycemic') {
    return 'C+Fi → P → F (remainder)';
  }
  if (hasKidney && primary === 'lipid') {
    return 'P (cap) → C+Fi → F (remainder)';
  }
  return 'P → C+Fi → F (remainder)';
}

/** Plain-language expansion of pcfPriority for UI. */
export function expandPcfPriority(pcfPriority: string): string {
  const map: Record<string, string> = {
    'P (cap) → C+Fi → F (remainder)':
      'Protein (cap) → Carbohydrate + fiber → Fat (fills remaining kcal)',
    'P → C+Fi → F (remainder)':
      'Protein → Carbohydrate + fiber → Fat (fills remaining kcal)',
    'C+Fi → P → F (remainder)':
      'Carbohydrate + fiber → Protein → Fat (fills remaining kcal)',
    'C (cap) → P → F (remainder)':
      'Carbohydrate (cap) → Protein → Fat (fills remaining kcal)',
    // Legacy strings — saved targets / older builds
    'P (cap) → C+Fi → F (fill)':
      'Protein (cap) → Carbohydrate + fiber → Fat (fills remaining kcal)',
    'P → C+Fi → F (fill)':
      'Protein → Carbohydrate + fiber → Fat (fills remaining kcal)',
    'C+Fi → P → F (fill)':
      'Carbohydrate + fiber → Protein → Fat (fills remaining kcal)',
    'C (cap) → P → F (fill)':
      'Carbohydrate (cap) → Protein → Fat (fills remaining kcal)',
    'P (cap) → C+Fi → F (suppl.)':
      'Protein (cap) → Carbohydrate + fiber → Fat (fills remaining kcal)',
    'P → C+Fi → F (suppl.)':
      'Protein → Carbohydrate + fiber → Fat (fills remaining kcal)',
    'C+Fi → P → F (suppl.)':
      'Carbohydrate + fiber → Protein → Fat (fills remaining kcal)',
    'C (cap) → P → F (suppl.)':
      'Carbohydrate (cap) → Protein → Fat (fills remaining kcal)',
  };
  return map[pcfPriority] ?? pcfPriority;
}

export function computeClinicalProfile(opts: {
  userRules: UserRules | null;
  kidney: KidneyLabStatus | null;
  lipid: LipidLabStatus | null;
  glycemic: GlycemicLabStatus | null;
  energyPlan: ClinicalProfileEnergyInput | null;
}): ClinicalProfileSummary {
  const { userRules, kidney, lipid, glycemic, energyPlan } = opts;
  const hasKidney = Boolean(kidney?.hasHighMarker);
  const constraints: ClinicalProfileSummary['constraintKeys'] = [];
  if (hasKidney) constraints.push('kidney');
  if (isEnergyCautious(energyPlan)) constraints.push('energy_cautious');

  let primary: ClinicalProfilePrimary = 'weight';
  if (hasExplicitLowCarbIntent(userRules)) {
    primary = 'explicit_low_carb';
  } else if (glycemic?.hasHighMarker) {
    primary = 'glycemic';
  } else if (lipid?.hasActionableMarker || isCholesterolPrimaryGoal(userRules)) {
    primary = 'lipid';
  }

  const constraintSuffix = constraints.map(constraintClinicalLabel).join(' + ');
  const profileLine = constraintSuffix
    ? `${primaryClinicalLabel(primary)} + ${constraintSuffix}`
    : primaryClinicalLabel(primary);

  return {
    primary,
    profileLine,
    macroOrder: macroOrderForProfile(primary, hasKidney),
    pcfPriority: pcfPriorityForProfile(primary, hasKidney),
    primaryLabel: primaryClinicalLabel(primary),
    constraintKeys: constraints,
  };
}

export function formatClinicalProfileBlock(summary: ClinicalProfileSummary): string {
  const constraintLine =
    summary.constraintKeys.length > 0
      ? summary.constraintKeys
          .map((c) =>
            c === 'kidney' ? 'renal (protein cap)' : 'adaptive deficit (do not deepen cut)',
          )
          .join(', ')
      : 'none';

  return [
    '## CLINICAL PROFILE (computed — echo in JSON `clinical_profile`, `macro_order`, `pcf_priority`)',
    'Language: **professional medical English only** in these fields (never Hebrew).',
    `Profile: **${summary.profileLine}**`,
    `P/C/F priority (after kcal): **${summary.pcfPriority}** → ${expandPcfPriority(summary.pcfPriority)}`,
    `Full sequence: **${summary.macroOrder}**`,
    `Primary driver: ${summary.primaryLabel}`,
    `Secondary constraints: ${constraintLine}`,
    'Use this profile before setting P/C/F/Fi; expand lab synthesis in `reasoning` (user language OK there).',
  ].join('\n');
}
