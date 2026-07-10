/**
 * Mifflin–St Jeor BMR and default body composition when no Withings scale.
 */

import type { Gender } from '../services/TargetService';

export function mifflinStJeorKcal(
  gender: Gender,
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  if (gender === 'female') return Math.round(base - 161);
  if (gender === 'male') return Math.round(base + 5);
  return Math.round(base - 78);
}

/** Mid healthy range defaults for onboarding AI fallback. */
export function defaultFatPctForGender(gender: Gender | null): number {
  if (gender === 'female') return 25;
  if (gender === 'male') return 18;
  return 22;
}

export function estimateMuscleMassKg(weightKg: number, fatPct: number): number {
  const fatMass = (weightKg * fatPct) / 100;
  return Math.round((weightKg - fatMass) * 10) / 10;
}

export function fatKgFromPct(weightKg: number, fatPct: number): number {
  return Math.round((weightKg * fatPct) / 100 * 10) / 10;
}

export function fatPctFromKg(weightKg: number, fatKg: number): number | null {
  if (!(weightKg > 0) || !(fatKg > 0)) return null;
  const pct = (fatKg / weightKg) * 100;
  if (pct < 3 || pct > 65) return null;
  return Math.round(pct * 10) / 10;
}

export function fatPctFromMuscleKg(weightKg: number, muscleKg: number): number | null {
  if (!(weightKg > 0) || !(muscleKg > 0) || muscleKg >= weightKg) return null;
  return fatPctFromKg(weightKg, weightKg - muscleKg);
}

/** Lean-mass model: fat + muscle should be close to total weight (bone/water not modeled). */
export function compositionSumRatio(weightKg: number, fatKg: number, muscleKg: number): number {
  if (!(weightKg > 0)) return 0;
  return (fatKg + muscleKg) / weightKg;
}

export type ManualFatInput =
  | { mode: 'pct'; value: number }
  | { mode: 'kg'; value: number }
  | { mode: 'muscle'; value: number };

export function resolveFatPctFromInput(weightKg: number, input: ManualFatInput): number | null {
  if (input.mode === 'pct') {
    return input.value >= 3 && input.value <= 65 ? input.value : null;
  }
  if (input.mode === 'kg') {
    return fatPctFromKg(weightKg, input.value);
  }
  return fatPctFromMuscleKg(weightKg, input.value);
}

export function estimateBodyFromProfile(input: {
  gender: Gender;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  fatPct?: number;
}): { fat_pct: number; muscle_mass_kg: number; bmr_kcal: number } {
  const fat_pct = input.fatPct ?? defaultFatPctForGender(input.gender);
  return {
    fat_pct,
    muscle_mass_kg: estimateMuscleMassKg(input.weightKg, fat_pct),
    bmr_kcal: mifflinStJeorKcal(input.gender, input.weightKg, input.heightCm, input.ageYears),
  };
}
