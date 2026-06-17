/**
 * Fiber ↔ carb coupling — fiber is counted inside total carbs on food labels.
 */

export const LOW_CARB_FIBER_THRESHOLD_G = 45;
export const STANDARD_FIBER_TARGET_G = 30;

/** Fiber grams cannot exceed total carb grams (fiber ⊆ carbs on labels). */
export function clampFiberToCarbs(fiber_g: number, carb_g: number): number {
  return Math.min(Math.max(0, fiber_g), Math.max(0, carb_g));
}

/**
 * When carbs are very low, aim for ~⅔ of carb grams as fiber.
 * When carbs are higher, cap at standard daily fiber — not ⅔ of high carbs.
 */
export function deriveFiberTargetFromCarbs(carb_g: number): number {
  const c = Math.max(0, carb_g);
  if (c <= LOW_CARB_FIBER_THRESHOLD_G) {
    return clampFiberToCarbs(Math.round((2 / 3) * c), c);
  }
  return clampFiberToCarbs(STANDARD_FIBER_TARGET_G, c);
}

export function macroKcalFromPcf(protein_g: number, carb_g: number, fat_g: number): number {
  return Math.round(4 * protein_g + 4 * carb_g + 9 * fat_g);
}

/** Parse a hard carb cap from My Rules text (keto, "< Ng carbs", etc.). */
export function parseCarbCapFromRules(rules: { aiContext?: string; constraints?: string[]; rawText?: string } | null): number | null {
  if (!rules) return null;
  const blob = [
    rules.aiContext ?? '',
    ...(rules.constraints ?? []),
    rules.rawText ?? '',
  ].join('\n').toLowerCase();

  if (/\bketo\b|קטו|כeto/.test(blob)) return 20;

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
