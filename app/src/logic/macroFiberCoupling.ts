/**
 * Fiber ↔ carb coupling — fiber is counted inside total carbs on food labels.
 */

import type { KidneyLabStatus } from '../services/LabLogService';

export const LOW_CARB_FIBER_THRESHOLD_G = 60;
export const KIDNEY_PROTEIN_G_PER_KG_LEAN = 2.2;
export const KIDNEY_PROTEIN_G_PER_KG_BODY_FALLBACK = 2.0;
export const STANDARD_FIBER_TARGET_G = 30;

/** Fiber grams cannot exceed total carb grams (fiber ⊆ carbs on labels). */
export function clampFiberToCarbs(fiber_g: number, carb_g: number): number {
  return Math.min(Math.max(0, fiber_g), Math.max(0, carb_g));
}

/**
 * When carbs are very low, aim for ~½ of carb grams as fiber.
 * When carbs are higher, cap at standard daily fiber — not ½ of high carbs.
 */
export function deriveFiberTargetFromCarbs(carb_g: number): number {
  const c = Math.max(0, carb_g);
  if (c <= LOW_CARB_FIBER_THRESHOLD_G) {
    return clampFiberToCarbs(Math.round(0.5 * c), c);
  }
  return clampFiberToCarbs(STANDARD_FIBER_TARGET_G, c);
}

export function macroKcalFromPcf(protein_g: number, carb_g: number, fat_g: number): number {
  return Math.round(4 * protein_g + 4 * carb_g + 9 * fat_g);
}

/** Parse a hard carb cap from My Rules text ("< 50g carbs", "עד 30g פחמימות", etc.). */
export function parseCarbCapFromRules(rules: { aiContext?: string; constraints?: string[]; rawText?: string } | null): number | null {
  if (!rules) return null;
  const blob = [
    rules.aiContext ?? '',
    ...(rules.constraints ?? []),
    rules.rawText ?? '',
  ].join('\n').toLowerCase();

  const lt = blob.match(/(?:<|under|max|maximum|up to|עד|מקס(?:ימום)?)\s*(\d+)\s*g?\s*(?:carb|carbs|פחמימ)/i);
  if (lt) {
    const n = parseInt(lt[1]!, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const carbLine = blob.match(/(\d+)\s*g?\s*(?:carb|carbs|פחמימ)/i);
  if (carbLine && /(?:cap|limit|יעד|מקס)/i.test(blob)) {
    const n = parseInt(carbLine[1]!, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

export type MacroPcf = {
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  kcal: number;
};

export function clampMacrosToRules<T extends MacroPcf>(
  macros: T,
  rules: { aiContext?: string; constraints?: string[]; rawText?: string } | null,
): T {
  const cap = parseCarbCapFromRules(rules);
  if (cap != null && macros.carb_g > cap) {
    const carb_g = cap;
    const fiber_g = deriveFiberTargetFromCarbs(carb_g);
    const kcal = macroKcalFromPcf(macros.protein_g, carb_g, macros.fat_g);
    return { ...macros, carb_g, fiber_g, kcal };
  }
  return macros;
}

export function kidneyProteinCapG(
  leanMassKg: number | null | undefined,
  weightKg: number | null | undefined,
): number | null {
  if (leanMassKg != null && leanMassKg > 0) {
    return Math.round(KIDNEY_PROTEIN_G_PER_KG_LEAN * leanMassKg);
  }
  if (weightKg != null && weightKg > 0) {
    return Math.round(KIDNEY_PROTEIN_G_PER_KG_BODY_FALLBACK * weightKg);
  }
  return null;
}

export function rulesMentionKidney(
  rules: { aiContext?: string; constraints?: string[]; rawText?: string; summary?: string } | null,
): boolean {
  if (!rules) return false;
  const blob = [
    rules.summary ?? '',
    rules.aiContext ?? '',
    ...(rules.constraints ?? []),
    rules.rawText ?? '',
  ]
    .join('\n')
    .toLowerCase();
  return /kidney|renal|creatinin|urea|\bbun\b|כליה|קריאאטינין|אוריאה|חלבון.*כליה|protein.*cap/.test(
    blob,
  );
}

function kidneyRulesAdviceText(capG: number, markersSummary: string, langCode: string): string {
  if (langCode === 'he') {
    return `בבדיקות דם: ${markersSummary}. מומלץ להוסיף לכללים שלי: "כשקריאאטינין או אוריאה גבוהים — להגביל חלבון לכ-${capG} ג ליום (עד ${KIDNEY_PROTEIN_G_PER_KG_LEAN} ג/ק"ג מסת רזה)."`;
  }
  return `Lab results: ${markersSummary}. Consider adding to My Rules: "When creatinine or urea is high, cap daily protein at ~${capG}g (≤${KIDNEY_PROTEIN_G_PER_KG_LEAN} g/kg lean mass)."`;
}

/** Lower protein when latest labs flag creatinine/urea high; nudge My Rules if silent on kidney. */
export function applyKidneyMacroGuardrail<
  T extends MacroPcf & { reasoning?: string; rules_advice?: string },
>(
  macros: T,
  opts: {
    kidney: KidneyLabStatus | null;
    leanMassKg: number | null;
    weightKg: number | null;
    userRules: { aiContext?: string; constraints?: string[]; rawText?: string; summary?: string } | null;
    langCode?: string;
    markersSummary?: string;
  },
): T {
  if (!opts.kidney?.hasHighMarker) return macros;
  const cap = kidneyProteinCapG(opts.leanMassKg, opts.weightKg);
  if (cap == null || cap <= 0) return macros;

  let m = { ...macros };
  if (m.protein_g > cap) {
    m.protein_g = cap;
    m.kcal = macroKcalFromPcf(m.protein_g, m.carb_g, m.fat_g);
  }

  if (!rulesMentionKidney(opts.userRules) && opts.markersSummary) {
    const advice = kidneyRulesAdviceText(cap, opts.markersSummary, opts.langCode ?? 'en');
    m.rules_advice = m.rules_advice ? `${m.rules_advice}\n\n${advice}` : advice;
  }
  return m;
}

export function postProcessMacroSuggestion<T extends MacroPcf & { diet_label?: string; reasoning?: string }>(
  raw: T,
  rules: { aiContext?: string; constraints?: string[]; rawText?: string } | null,
): T {
  let m = { ...raw };
  m.fiber_g = deriveFiberTargetFromCarbs(m.carb_g);
  m = clampMacrosToRules(m, rules);
  const computed = macroKcalFromPcf(m.protein_g, m.carb_g, m.fat_g);
  if (Math.abs(computed - m.kcal) > 50) {
    m.kcal = computed;
  }
  return m;
}
