/**
 * Clinic live macro bounds (prompt114 / be-45).
 * Canonical store — Food Log reads here after overlay pull.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLINIC_MACRO_BOUNDS_KEY = 'healthings:clinicMacroBounds';

export type MacroAxis = 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g' | 'net_carb_g';
export type MacroDirection = 'floor' | 'ceiling';
export type MacroStrength = 'hard' | 'flex';
export type MacroBoundKind = 'constant' | 'percent';
export type MacroPercentOf = 'kcal_order' | 'kcal_eaten';

export type MacroActivityAddBack = {
  thresholdKcal: number;
  capValue: number;
  ratio?: number;
};

export type MacroBound = {
  axis: MacroAxis;
  direction: MacroDirection;
  kind: MacroBoundKind;
  /** Omitted = FLEX unlocked (no guide number). */
  value?: number;
  of?: MacroPercentOf;
  resolvedValue?: number;
  strength: MacroStrength;
  activityAddBack?: MacroActivityAddBack;
  followsActivity?: boolean;
};

export type ClinicMacroBoundsStore = {
  bounds: MacroBound[];
  updatedAt: string;
  source: 'clinic';
  rulesHash?: string;
  reasoning?: string;
  needsClinician?: Array<{ axis: string; question: string }>;
};

const AXES = new Set<MacroAxis>([
  'kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fiber_g',
  'net_carb_g',
]);

function parseBound(raw: unknown): MacroBound | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const axis = String(o.axis || '') as MacroAxis;
  if (!AXES.has(axis)) return null;
  const direction = o.direction === 'floor' || o.direction === 'ceiling' ? o.direction : null;
  if (!direction) return null;
  const strength = o.strength === 'flex' ? 'flex' : 'hard';
  const kind = o.kind === 'percent' ? 'percent' : 'constant';
  const value = Number(o.value);
  const hasNum = Number.isFinite(value) && value > 0;
  // FLEX unlocked (no number) — keep for store completeness; meters ignore it.
  if (!hasNum) {
    if (strength !== 'flex') return null;
    return { axis, direction, kind: 'constant', strength: 'flex' };
  }
  const bound: MacroBound = { axis, direction, kind, value, strength };
  if (kind === 'percent') {
    if (o.of === 'kcal_order' || o.of === 'kcal_eaten') bound.of = o.of;
    const rv = Number(o.resolvedValue);
    if (Number.isFinite(rv) && rv > 0) bound.resolvedValue = rv;
  }
  if (o.activityAddBack && typeof o.activityAddBack === 'object') {
    const a = o.activityAddBack as Record<string, unknown>;
    const thr = Number(a.thresholdKcal);
    const cap = Number(a.capValue);
    if (Number.isFinite(thr) && Number.isFinite(cap) && cap > value) {
      bound.activityAddBack = {
        thresholdKcal: thr,
        capValue: cap,
        ...(Number.isFinite(Number(a.ratio)) ? { ratio: Number(a.ratio) } : {}),
      };
    }
  }
  if (o.followsActivity === true) bound.followsActivity = true;
  return bound;
}

export async function loadClinicMacroBounds(): Promise<ClinicMacroBoundsStore | null> {
  try {
    const raw = await AsyncStorage.getItem(CLINIC_MACRO_BOUNDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClinicMacroBoundsStore;
    if (!parsed || !Array.isArray(parsed.bounds)) return null;
    const bounds = parsed.bounds.map(parseBound).filter((b): b is MacroBound => !!b);
    return {
      bounds,
      updatedAt: String(parsed.updatedAt || ''),
      source: 'clinic',
      ...(parsed.rulesHash ? { rulesHash: parsed.rulesHash } : {}),
      ...(parsed.reasoning ? { reasoning: parsed.reasoning } : {}),
      ...(parsed.needsClinician ? { needsClinician: parsed.needsClinician } : {}),
    };
  } catch {
    return null;
  }
}

export async function clearClinicMacroBounds(): Promise<void> {
  await AsyncStorage.removeItem(CLINIC_MACRO_BOUNDS_KEY);
}

/** Apply overlay.macros from clinic pull. Empty/null clears. */
export async function applyClinicMacrosFromOverlay(
  macros: { bounds?: unknown[]; updatedAt?: string; rulesHash?: string; reasoning?: string; needsClinician?: unknown } | null,
  overlayUpdatedAt: string,
): Promise<ClinicMacroBoundsStore | null> {
  if (!macros || !Array.isArray(macros.bounds) || macros.bounds.length === 0) {
    await clearClinicMacroBounds();
    return null;
  }
  const bounds = macros.bounds.map(parseBound).filter((b): b is MacroBound => !!b);
  if (!bounds.length) {
    await clearClinicMacroBounds();
    return null;
  }
  const store: ClinicMacroBoundsStore = {
    bounds,
    updatedAt: String(macros.updatedAt || overlayUpdatedAt),
    source: 'clinic',
    ...(typeof macros.rulesHash === 'string' ? { rulesHash: macros.rulesHash } : {}),
    ...(typeof macros.reasoning === 'string' ? { reasoning: macros.reasoning } : {}),
  };
  await AsyncStorage.setItem(CLINIC_MACRO_BOUNDS_KEY, JSON.stringify(store));
  return store;
}

/** Local calendar day of the clinic order (YYYY-MM-DD), or null if unknown. */
export function clinicMacroOrderEffectiveDayKey(
  store: ClinicMacroBoundsStore | null,
): string | null {
  if (!store?.updatedAt) return null;
  const ms = Date.parse(store.updatedAt);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Keep Food Log history honest: clinic HARD meters only on/after the order's local day.
 * Earlier days keep phone `macro_target_by_day` / point targets only.
 */
export function clinicMacroMetersApplyToDay(
  store: ClinicMacroBoundsStore | null,
  dayKey: string,
): boolean {
  const from = clinicMacroOrderEffectiveDayKey(store);
  if (!from || !dayKey) return false;
  return dayKey >= from;
}

export function resolvePercentGrams(
  percent: number,
  kcalBase: number,
  axis: MacroAxis,
): number {
  if (axis === 'kcal') return Math.round((percent / 100) * kcalBase);
  const denom = axis === 'fat_g' ? 9 : 4;
  return Math.round((percent / 100) * kcalBase / denom * 10) / 10;
}

/** Resolve a kcal ceiling for a day given measured activity kcal (not BMR). */
export function resolveKcalCeilingForDay(
  bound: MacroBound,
  activityKcal: number | null | undefined,
): number {
  if (bound.axis !== 'kcal' || bound.direction !== 'ceiling') {
    return bound.resolvedValue ?? bound.value ?? 0;
  }
  const base = bound.value ?? 0;
  const add = bound.activityAddBack;
  if (!add || !(bound.value != null && bound.value > 0)) return base;
  const activity = activityKcal == null || !Number.isFinite(activityKcal) ? 0 : activityKcal;
  const ratio = add.ratio == null || !Number.isFinite(add.ratio) ? 1 : add.ratio;
  const extra = Math.max(0, activity - add.thresholdKcal) * ratio;
  return Math.min(base + extra, add.capValue);
}

export type ResolvedAxisMeter = {
  axis: MacroAxis;
  strength: MacroStrength;
  floor?: number;
  ceiling?: number;
  caption?: string;
};

/**
 * Per-axis resolved meters for the Food Log. HARD only gets ≤ ≥.
 * Percent of kcal_order uses base kcal (not boosted) unless followsActivity.
 */
export function resolveClinicMacroMeters(
  store: ClinicMacroBoundsStore | null,
  opts: { activityKcal?: number | null } = {},
): ResolvedAxisMeter[] {
  if (!store?.bounds?.length) return [];
  const byAxis = new Map<MacroAxis, { floor?: MacroBound; ceiling?: MacroBound }>();
  for (const b of store.bounds) {
    if (!(b.value != null && b.value > 0) && !(b.resolvedValue != null && b.resolvedValue > 0)) {
      continue;
    }
    const slot = byAxis.get(b.axis) || {};
    if (b.direction === 'floor') slot.floor = b;
    else slot.ceiling = b;
    byAxis.set(b.axis, slot);
  }

  const kcalCeiling = byAxis.get('kcal')?.ceiling;
  const kcalBase = kcalCeiling?.value ?? null;
  const boosted =
    kcalCeiling != null
      ? resolveKcalCeilingForDay(kcalCeiling, opts.activityKcal)
      : null;

  const out: ResolvedAxisMeter[] = [];
  for (const [axis, pair] of byAxis) {
    const strength: MacroStrength =
      (pair.floor?.strength === 'hard' || pair.ceiling?.strength === 'hard') ? 'hard' : 'flex';

    const resolveOne = (b: MacroBound | undefined): number | undefined => {
      if (!b) return undefined;
      if (b.axis === 'kcal' && b.direction === 'ceiling') {
        return resolveKcalCeilingForDay(b, opts.activityKcal);
      }
      if (b.kind === 'percent' && b.of === 'kcal_order') {
        const base =
          b.followsActivity && boosted != null
            ? boosted
            : kcalBase != null
              ? kcalBase
              : b.resolvedValue ?? null;
        if (base == null) return b.resolvedValue;
        return resolvePercentGrams(b.value, base, axis);
      }
      return b.resolvedValue ?? b.value;
    };

    const floor = resolveOne(pair.floor);
    const ceiling = resolveOne(pair.ceiling);
    let caption: string | undefined;
    if (axis === 'kcal' && kcalCeiling?.activityAddBack && boosted != null && kcalBase != null && boosted > kcalBase) {
      caption = `${kcalBase} + ${Math.round(boosted - kcalBase)} activity`;
    } else if (pair.ceiling?.kind === 'percent' && pair.ceiling.of === 'kcal_order' && kcalBase != null) {
      caption = `${pair.ceiling.value}% of ${kcalBase}`;
    }

    out.push({
      axis,
      strength,
      ...(floor != null ? { floor } : {}),
      ...(ceiling != null ? { ceiling } : {}),
      ...(caption ? { caption } : {}),
    });
  }
  return out;
}

export function clinicMacrosHardBlock(store: ClinicMacroBoundsStore | null): string | null {
  const meters = resolveClinicMacroMeters(store).filter((m) => m.strength === 'hard');
  if (!meters.length) return null;
  const parts = meters.map((m) => {
    if (m.floor != null && m.ceiling != null) return `${m.axis} ${m.floor}–${m.ceiling}`;
    if (m.ceiling != null) return `${m.axis} ceiling ${m.ceiling}`;
    if (m.floor != null) return `${m.axis} floor ${m.floor}`;
    return m.axis;
  });
  return `HARD from clinic: ${parts.join('; ')}`;
}
