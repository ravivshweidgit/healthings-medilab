/**
 * Fiber ↔ carb coupling — fiber is counted inside total carbs on food labels.
 */

import type { KidneyLabStatus } from '../services/LabLogService';

export const KIDNEY_PROTEIN_G_PER_KG_LEAN = 2.2;
export const KIDNEY_PROTEIN_G_PER_KG_BODY_FALLBACK = 2.0;
export const STANDARD_FIBER_TARGET_G = 30;
/** Default fiber as fraction of total carb grams (fiber ⊆ carbs). ~55% ≈ whole-food + psyllium days (e.g. 66g C → 36g Fi). */
export const FIBER_TO_CARB_RATIO = 0.55;
/** Apply 30g absolute floor when carbs support it (30 ≈ 55% × 55g). */
export const FIBER_FLOOR_CARB_THRESHOLD_G = 55;

/** Fiber grams cannot exceed total carb grams (fiber ⊆ carbs on labels). */
export function clampFiberToCarbs(fiber_g: number, carb_g: number): number {
  return Math.min(Math.max(0, fiber_g), Math.max(0, carb_g));
}

/**
 * Derive daily fiber target from carb target (generic default only).
 * Uses ~55%×carbs, min 30g when carbs ≥ 55g, always ≤ carb_g.
 * My Rules explicit floors win via applyMacroFloorsFromRules (post-process).
 */
export function deriveFiberTargetFromCarbs(carb_g: number): number {
  const c = Math.max(0, carb_g);
  if (c === 0) return 0;
  const fromRatio = Math.round(FIBER_TO_CARB_RATIO * c);
  const withFloor =
    c >= FIBER_FLOOR_CARB_THRESHOLD_G ? Math.max(STANDARD_FIBER_TARGET_G, fromRatio) : fromRatio;
  return clampFiberToCarbs(withFloor, c);
}

export function macroKcalFromPcf(protein_g: number, carb_g: number, fat_g: number): number {
  return Math.round(4 * protein_g + 4 * carb_g + 9 * fat_g);
}

function rulesTextBlob(
  rules: {
    summary?: string;
    aiContext?: string;
    constraints?: string[];
    rawText?: string;
  } | null,
): string {
  if (!rules) return '';
  return [
    rules.summary ?? '',
    rules.aiContext ?? '',
    ...(rules.constraints ?? []),
    rules.rawText ?? '',
  ].join('\n');
}

function parseGramMinFromRules(
  rules: Parameters<typeof rulesTextBlob>[0],
  nutrientPattern: RegExp,
): number | null {
  const blob = rulesTextBlob(rules).toLowerCase();
  const minWord =
    /(?:at\s*least|minimum|min(?:imum)?|≥|>=|לפחות|מינימום)/i;
  const patterns = [
    new RegExp(`${minWord.source}\\s*(\\d+)\\s*g?(?:r)?\\s*${nutrientPattern.source}`, 'gi'),
    new RegExp(`${nutrientPattern.source}[^\\d\\n]{0,30}${minWord.source}\\s*(\\d+)`, 'gi'),
    new RegExp(`(\\d+)\\s*g?(?:r)?\\s*${nutrientPattern.source}[^\\n]{0,30}${minWord.source}`, 'gi'),
  ];
  let best: number | null = null;
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(blob)) !== null) {
      const n = parseInt(m[1]!, 10);
      if (Number.isFinite(n) && n > 0) best = best == null ? n : Math.max(best, n);
    }
  }
  return best;
}

/** Parse a hard carb floor ("at least 65g carbs", "פחמימות לפחות 65", etc.). */
export function parseCarbMinFromRules(
  rules: { summary?: string; aiContext?: string; constraints?: string[]; rawText?: string } | null,
): number | null {
  return parseGramMinFromRules(rules, /(?:carb|carbs|carbohydrate|פחמימ)/i);
}

/** Parse a hard fiber floor ("fiber at least 35g", "סיבים לפחות 35", etc.). */
export function parseFiberMinFromRules(
  rules: { summary?: string; aiContext?: string; constraints?: string[]; rawText?: string } | null,
): number | null {
  return parseGramMinFromRules(rules, /(?:fiber|fibre|סיב|סיבים)/i);
}

/** Parse a hard carb cap from My Rules text ("< 50g carbs", "עד 30g פחמימות", etc.). */
export function parseCarbCapFromRules(
  rules: { summary?: string; aiContext?: string; constraints?: string[]; rawText?: string } | null,
): number | null {
  if (!rules) return null;
  const blob = rulesTextBlob(rules).toLowerCase();

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
  rules: { summary?: string; aiContext?: string; constraints?: string[]; rawText?: string } | null,
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

/** Raise carb_g / fiber_g to explicit My Rules floors; fiber never exceeds carb_g. */
export function applyMacroFloorsFromRules<T extends MacroPcf>(
  macros: T,
  rules: { summary?: string; aiContext?: string; constraints?: string[]; rawText?: string } | null,
): T {
  const carbMin = parseCarbMinFromRules(rules);
  const fiberMin = parseFiberMinFromRules(rules);
  if (carbMin == null && fiberMin == null) return macros;

  let carb_g = macros.carb_g;
  if (carbMin != null && carb_g < carbMin) carb_g = carbMin;

  let fiber_g = deriveFiberTargetFromCarbs(carb_g);
  if (fiberMin != null && fiber_g < fiberMin) {
    fiber_g = clampFiberToCarbs(fiberMin, carb_g);
  }

  const changed = carb_g !== macros.carb_g || fiber_g !== macros.fiber_g;
  if (!changed) return macros;

  return {
    ...macros,
    carb_g,
    fiber_g,
    kcal: macroKcalFromPcf(macros.protein_g, carb_g, macros.fat_g),
  };
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
  rules: { summary?: string; aiContext?: string; constraints?: string[]; rawText?: string } | null,
): T {
  let m = clampMacrosToRules({ ...raw }, rules);
  m = applyMacroFloorsFromRules(m, rules);
  const computed = macroKcalFromPcf(m.protein_g, m.carb_g, m.fat_g);
  if (Math.abs(computed - m.kcal) > 50) {
    m.kcal = computed;
  }
  return m;
}
