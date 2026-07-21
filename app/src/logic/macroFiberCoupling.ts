/**
 * Fiber ↔ carb coupling — fiber is counted inside total carbs on food labels.
 * Numeric floors/caps from My Rules / nutritionist text are Gemini judgment only
 * (see .cursor/rules/ai-judgment-not-regex.mdc) — no regex parse of rules here.
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
 * Derive daily fiber target from carb target (generic math default only).
 * Explicit fiber from directive / My Rules is set by Gemini, not code.
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

export type MacroPcf = {
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fiber_g: number;
  /** Net carbs (C − Fi). Always derived when sanitizing; optional on raw AI output. */
  net_carb_g?: number;
  kcal: number;
};

/** Net carbs on labels: total carb minus fiber (fiber ⊆ carbs). */
export function deriveNetCarb_g(carb_g: number, fiber_g: number): number {
  return Math.max(0, Math.round(carb_g - fiber_g));
}

/** Clamp fiber to carbs and set net_carb_g = C − Fi. */
export function withDerivedNetCarb<T extends MacroPcf>(macros: T): T {
  const carb_g = Math.max(0, macros.carb_g);
  const fiber_g = clampFiberToCarbs(macros.fiber_g, carb_g);
  const net_carb_g = deriveNetCarb_g(carb_g, fiber_g);
  return { ...macros, carb_g, fiber_g, net_carb_g };
}

/**
 * Ensure fiber is present (derive if missing), then net carbs.
 * Pure math — does not read My Rules text.
 */
export function ensureCarbFiberNet<T extends MacroPcf>(macros: T): T {
  const carb_g = Math.max(0, macros.carb_g);
  const fiberRaw = macros.fiber_g;
  const fiber_g =
    fiberRaw != null && Number.isFinite(fiberRaw)
      ? clampFiberToCarbs(fiberRaw, carb_g)
      : deriveFiberTargetFromCarbs(carb_g);
  return withDerivedNetCarb({ ...macros, carb_g, fiber_g });
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

function kidneyRulesAdviceText(capG: number, markersSummary: string, langCode: string): string {
  if (langCode === 'he') {
    return `בבדיקות דם: ${markersSummary}. מומלץ להוסיף לכללים שלי: "כשקריאאטינין או אוריאה גבוהים — להגביל חלבון לכ-${capG} ג ליום (עד ${KIDNEY_PROTEIN_G_PER_KG_LEAN} ג/ק"ג מסת רזה)."`;
  }
  return `Lab results: ${markersSummary}. Consider adding to My Rules: "When creatinine or urea is high, cap daily protein at ~${capG}g (≤${KIDNEY_PROTEIN_G_PER_KG_LEAN} g/kg lean mass)."`;
}

/** Lower protein when latest labs flag creatinine/urea high; nudge My Rules from lab math (not rules regex). */
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

  if (opts.markersSummary) {
    const advice = kidneyRulesAdviceText(cap, opts.markersSummary, opts.langCode ?? 'en');
    m.rules_advice = m.rules_advice ? `${m.rules_advice}\n\n${advice}` : advice;
  }
  return m;
}

/** Sanitize AI / manual macros: Fi ≤ C, net = C − Fi. Prefer stated `kcal` (fat fills); never overwrite kcal from high fat leftover. */
export function postProcessMacroSuggestion<T extends MacroPcf & { diet_label?: string; reasoning?: string }>(
  raw: T,
  _rules?: { summary?: string; aiContext?: string; constraints?: string[]; rawText?: string } | null,
): T {
  let m = ensureCarbFiberNet({ ...raw });
  if (m.kcal > 0) {
    const fat_g = Math.max(
      40,
      Math.round((m.kcal - 4 * m.protein_g - 4 * m.carb_g) / 9),
    );
    return {
      ...m,
      fat_g,
      kcal: macroKcalFromPcf(m.protein_g, m.carb_g, fat_g),
    };
  }
  m.kcal = macroKcalFromPcf(m.protein_g, m.carb_g, m.fat_g);
  return m;
}
