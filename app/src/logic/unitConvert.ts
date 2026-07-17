/**
 * Pure unit conversion / format / parse for display prefs.
 * Canonical storage: glucose mg/dL, mass kg, height cm, water ml, energy kcal.
 */

export type GlucoseUnit = 'mgdl' | 'mmol';
export type MassUnit = 'kg' | 'lb';
export type HeightUnit = 'cm' | 'ftin';
export type WaterUnit = 'ml' | 'floz';
export type EnergyUnit = 'kcal' | 'kj';

const MGDL_PER_MMOL = 18.0182;
const LB_PER_KG = 2.2046226218;
const CM_PER_INCH = 2.54;
const ML_PER_FLOZ = 29.5735295625; // US fl oz
const KJ_PER_KCAL = 4.184;

export function mgdlToDisplay(mgdl: number, unit: GlucoseUnit): number {
  if (unit === 'mmol') return mgdl / MGDL_PER_MMOL;
  return mgdl;
}

export function displayToMgdl(value: number, unit: GlucoseUnit): number {
  if (unit === 'mmol') return value * MGDL_PER_MMOL;
  return value;
}

export function glucoseUnitLabel(unit: GlucoseUnit): string {
  return unit === 'mmol' ? 'mmol/L' : 'mg/dL';
}

export function formatGlucose(mgdl: number | null | undefined, unit: GlucoseUnit, digits?: number): string {
  if (mgdl == null || !Number.isFinite(mgdl)) return '—';
  const v = mgdlToDisplay(mgdl, unit);
  const d = digits ?? (unit === 'mmol' ? 1 : 0);
  return `${v.toFixed(d)} ${glucoseUnitLabel(unit)}`;
}

export function kgToDisplay(kg: number, unit: MassUnit): number {
  if (unit === 'lb') return kg * LB_PER_KG;
  return kg;
}

export function displayToKg(value: number, unit: MassUnit): number {
  if (unit === 'lb') return value / LB_PER_KG;
  return value;
}

export function massUnitLabel(unit: MassUnit): string {
  return unit === 'lb' ? 'lb' : 'kg';
}

export function formatMass(kg: number | null | undefined, unit: MassUnit, digits = 1): string {
  if (kg == null || !Number.isFinite(kg)) return '—';
  return `${kgToDisplay(kg, unit).toFixed(digits)} ${massUnitLabel(unit)}`;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cm / CM_PER_INCH;
  let feet = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export function parseLocaleNumber(raw: string): number | null {
  const n = parseFloat(raw.replace(',', '.').replace(/\s/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

export function formatHeight(cm: number | null | undefined, unit: HeightUnit): string {
  if (cm == null || !Number.isFinite(cm)) return '—';
  if (unit === 'ftin') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}

/** Editable field value from canonical cm. */
export function heightCmToInput(cm: number, unit: HeightUnit): string {
  if (unit === 'ftin') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return String(Math.round(cm));
}

/** Parse height field → cm. Returns null if unparseable. */
export function parseHeightInputToCm(raw: string, unit: HeightUnit): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // If the string still looks like ft'in", parse as imperial even when prefs say cm
  // (avoids parseFloat("5'9\"") → 5 and mounting a bad height into Manual Body).
  const looksImperial = /['′"″]|ft/i.test(trimmed) || /^\d+\s+\d+/.test(trimmed);
  const effective: HeightUnit = looksImperial ? 'ftin' : unit;

  if (effective === 'cm') {
    const n = parseLocaleNumber(trimmed);
    if (n == null || !(n > 0)) return null;
    // Reject absurd cm (often a partial imperial parse).
    if (n < 90 || n > 272) return null;
    return n;
  }
  const m =
    trimmed.match(/(\d+)\s*['′]\s*(\d+)/) ||
    trimmed.match(/(\d+)\s+(\d+)/) ||
    trimmed.match(/(\d+)\s*ft\s*(\d+)/i);
  if (m) {
    const cm = feetInchesToCm(Number(m[1]), Number(m[2]));
    return cm > 0 ? cm : null;
  }
  const onlyFeet = parseLocaleNumber(trimmed.replace(/['"′″ftin\s]/gi, ''));
  if (onlyFeet != null && onlyFeet > 0 && onlyFeet < 9) {
    return feetInchesToCm(onlyFeet, 0);
  }
  return null;
}

/**
 * Height field string safe for the current unit (never leave ft'in" in the box when unit is cm).
 * Use for TextInput `value` so the first paint cannot mount an illegal combination on iOS.
 */
export function coerceHeightInputForUnit(
  raw: string,
  unit: HeightUnit,
  heightCm: number | null | undefined,
): string {
  if (unit === 'cm') {
    if (/^\d{1,3}$/.test(raw.trim())) return raw.trim();
    const cm =
      (heightCm != null && heightCm > 0 ? heightCm : null) ??
      parseHeightInputToCm(raw, 'ftin') ??
      parseHeightInputToCm(raw, 'cm');
    return cm != null && cm > 0 ? heightCmToInput(cm, 'cm') : '';
  }
  if (/['′]/.test(raw) || /^\d+\s+\d+/.test(raw.trim()) || /\d+\s*ft/i.test(raw)) {
    return raw;
  }
  const cm =
    (heightCm != null && heightCm > 0 ? heightCm : null) ?? parseHeightInputToCm(raw, 'cm');
  return cm != null && cm > 0 ? heightCmToInput(cm, 'ftin') : raw;
}

export function mlToDisplay(ml: number, unit: WaterUnit): number {
  if (unit === 'floz') return ml / ML_PER_FLOZ;
  return ml;
}

export function displayToMl(value: number, unit: WaterUnit): number {
  if (unit === 'floz') return value * ML_PER_FLOZ;
  return value;
}

export function waterUnitLabel(unit: WaterUnit): string {
  return unit === 'floz' ? 'fl oz' : 'ml';
}

export function formatWaterMl(ml: number | null | undefined, unit: WaterUnit): string {
  if (ml == null || !Number.isFinite(ml)) return '—';
  if (unit === 'floz') return `${mlToDisplay(ml, unit).toFixed(1)} fl oz`;
  return `${Math.round(ml)} ml`;
}

export function kcalToDisplay(kcal: number, unit: EnergyUnit): number {
  if (unit === 'kj') return kcal * KJ_PER_KCAL;
  return kcal;
}

export function displayToKcal(value: number, unit: EnergyUnit): number {
  if (unit === 'kj') return value / KJ_PER_KCAL;
  return value;
}

export function energyUnitLabel(unit: EnergyUnit): string {
  return unit === 'kj' ? 'kJ' : 'kcal';
}

export function formatEnergy(kcal: number | null | undefined, unit: EnergyUnit, digits?: number): string {
  if (kcal == null || !Number.isFinite(kcal)) return '—';
  const v = kcalToDisplay(kcal, unit);
  const d = digits ?? (unit === 'kj' ? 0 : 0);
  return `${Math.round(v)} ${energyUnitLabel(unit)}`;
}
