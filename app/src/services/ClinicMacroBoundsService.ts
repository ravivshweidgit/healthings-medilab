/**
 * Clinic live macro bounds (prompt114 / be-45).
 * Canonical store — Food Log reads here after overlay pull.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLegacyPhoneMacroTarget } from './TargetService';

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
  /** First local calendar day this order applied. Rebuild must not advance it. */
  effectiveFrom?: string;
  /** 2 = locked after 2-day rebuild recovery (do not re-infer from food log). */
  effectiveFromRev?: number;
  source: 'clinic';
  rulesHash?: string;
  reasoning?: string;
  needsClinician?: Array<{ axis: string; question: string }>;
  /** Server-validated slug from Propose (prompt118). */
  plateCollection?: string;
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

function isDayKey(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function localDayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyFromIso(iso: string | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return localDayKeyFromMs(ms);
}

function lookbackFloorDayKey(fromDay: string, days: number): string {
  const [y, m, d] = fromDay.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  return localDayKeyFromMs(dt.getTime());
}

/**
 * Rebuild bumps updatedAt to today. Recover the previous 2 local days (21–22 after
 * an Aug 23 rebuild) but do not paint Aug 20 and older — leftover point meters stay.
 */
const EFFECTIVE_FROM_REV = 2;
const REBUILD_RECOVERY_DAYS = 2;

async function resolveEffectiveFrom(
  store: { updatedAt?: string; effectiveFrom?: string; effectiveFromRev?: number } | null,
  incomingIso?: string,
): Promise<string | null> {
  if (store?.effectiveFromRev === EFFECTIVE_FROM_REV && isDayKey(store.effectiveFrom)) {
    return store.effectiveFrom;
  }
  const updatedDay = dayKeyFromIso(incomingIso || store?.updatedAt);
  const today = localDayKeyFromMs(Date.now());
  const anchor = updatedDay || today;
  return lookbackFloorDayKey(anchor, REBUILD_RECOVERY_DAYS);
}

function parsePlateCollection(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  return s.length > 0 ? s : undefined;
}

function storeFromParsed(parsed: ClinicMacroBoundsStore, bounds: MacroBound[]): ClinicMacroBoundsStore {
  const plateCollection = parsePlateCollection(parsed.plateCollection);
  return {
    bounds,
    updatedAt: String(parsed.updatedAt || ''),
    source: 'clinic',
    ...(isDayKey(parsed.effectiveFrom) ? { effectiveFrom: parsed.effectiveFrom } : {}),
    ...(typeof parsed.effectiveFromRev === 'number' ? { effectiveFromRev: parsed.effectiveFromRev } : {}),
    ...(parsed.rulesHash ? { rulesHash: parsed.rulesHash } : {}),
    ...(parsed.reasoning ? { reasoning: parsed.reasoning } : {}),
    ...(parsed.needsClinician ? { needsClinician: parsed.needsClinician } : {}),
    ...(plateCollection ? { plateCollection } : {}),
  };
}

export async function loadClinicMacroBounds(): Promise<ClinicMacroBoundsStore | null> {
  try {
    const raw = await AsyncStorage.getItem(CLINIC_MACRO_BOUNDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClinicMacroBoundsStore;
    if (!parsed || !Array.isArray(parsed.bounds)) return null;
    const bounds = parsed.bounds.map(parseBound).filter((b): b is MacroBound => !!b);
    const store = storeFromParsed(parsed, bounds);
    if (!bounds.length) return store;
    if (store.effectiveFromRev === EFFECTIVE_FROM_REV && isDayKey(store.effectiveFrom)) return store;
    const effectiveFrom = await resolveEffectiveFrom(store);
    if (!effectiveFrom) return store;
    const next = { ...store, effectiveFrom, effectiveFromRev: EFFECTIVE_FROM_REV };
    await AsyncStorage.setItem(CLINIC_MACRO_BOUNDS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export async function clearClinicMacroBounds(): Promise<void> {
  await AsyncStorage.removeItem(CLINIC_MACRO_BOUNDS_KEY);
}

/** Apply overlay.macros from clinic pull.
 * Explicit empty `bounds: []` clears local (clinic cleared the order).
 * Omitted/null macros keep the local store — a rules-only overlay row must not
 * wipe a live order the phone already has (self-rebuild / other org).
 */
export async function applyClinicMacrosFromOverlay(
  macros: {
    bounds?: unknown[];
    updatedAt?: string;
    rulesHash?: string;
    reasoning?: string;
    needsClinician?: unknown;
    plateCollection?: unknown;
  } | null,
  overlayUpdatedAt: string,
): Promise<ClinicMacroBoundsStore | null> {
  if (macros == null || !Array.isArray(macros.bounds)) {
    return loadClinicMacroBounds();
  }
  if (macros.bounds.length === 0) {
    await clearClinicMacroBounds();
    return null;
  }
  const bounds = macros.bounds.map(parseBound).filter((b): b is MacroBound => !!b);
  if (!bounds.length) {
    return loadClinicMacroBounds();
  }
  const prev = await loadClinicMacroBounds();
  const incomingIso = String(macros.updatedAt || overlayUpdatedAt);
  const effectiveFrom =
    (await resolveEffectiveFrom(
      prev,
      incomingIso,
    )) ||
    dayKeyFromIso(incomingIso) ||
    localDayKeyFromMs(Date.now());
  const plateCollection = parsePlateCollection(macros.plateCollection);
  const store: ClinicMacroBoundsStore = {
    bounds,
    updatedAt: incomingIso,
    effectiveFrom,
    effectiveFromRev: EFFECTIVE_FROM_REV,
    source: 'clinic',
    ...(typeof macros.rulesHash === 'string' ? { rulesHash: macros.rulesHash } : {}),
    ...(typeof macros.reasoning === 'string' ? { reasoning: macros.reasoning } : {}),
    ...(plateCollection ? { plateCollection } : {}),
  };
  await AsyncStorage.setItem(CLINIC_MACRO_BOUNDS_KEY, JSON.stringify(store));
  if (bounds.some((b) => b.strength === 'hard')) {
    await clearLegacyPhoneMacroTarget(clinicMacroOrderEffectiveDayKey(store));
  }
  return store;
}

/** Local calendar day the order first applied (YYYY-MM-DD), or null if unknown. */
export function clinicMacroOrderEffectiveDayKey(
  store: ClinicMacroBoundsStore | null,
): string | null {
  if (isDayKey(store?.effectiveFrom)) return store!.effectiveFrom;
  return dayKeyFromIso(store?.updatedAt);
}

/**
 * Clinic ≤ ≥ meters on/after effectiveFrom. Days before keep leftover point UI.
 */
export function clinicMacroMetersApplyToDay(
  store: ClinicMacroBoundsStore | null,
  dayKey: string,
): boolean {
  if (!store?.bounds?.length || !dayKey) return false;
  const from = clinicMacroOrderEffectiveDayKey(store);
  // Unparseable updatedAt must not hide a live order.
  if (!from) return true;
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

export function hardAxis(
  meters: ResolvedAxisMeter[],
  axis: MacroAxis,
): ResolvedAxisMeter | undefined {
  return meters.find((m) => m.axis === axis && m.strength === 'hard');
}

/**
 * Number used as a carb *cap* (stay-under).
 * Once clinic live macros exist for the day, the leftover phone point (e.g. C 80)
 * is never a cap — only a HARD carb ceiling is.
 */
export function effectiveCarbCeilingG(
  meters: ResolvedAxisMeter[],
  pointCarb_g: number | null | undefined,
): number | null {
  if (clinicMacroRedesignActive(meters)) {
    return hardAxis(meters, 'carb_g')?.ceiling ?? null;
  }
  return pointCarb_g != null && Number.isFinite(pointCarb_g) ? pointCarb_g : null;
}

export function clinicMacroRedesignActive(
  meters: ResolvedAxisMeter[] | null | undefined,
): boolean {
  return Array.isArray(meters) && meters.some((m) => m.strength === 'hard');
}

/** True when today's Food Log is owned by clinic HARD live macros. */
export async function clinicHardMacrosApplyToday(): Promise<boolean> {
  const store = await loadClinicMacroBounds();
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!clinicMacroMetersApplyToDay(store, today)) return false;
  return resolveClinicMacroMeters(store).some((m) => m.strength === 'hard');
}

function axisUnit(axis: MacroAxis): string {
  return axis === 'kcal' ? '' : 'g';
}

const PROMPT_AXES: MacroAxis[] = [
  'kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fiber_g',
  'net_carb_g',
];

function formatHardSlot(m: ResolvedAxisMeter): string {
  const u = axisUnit(m.axis);
  if (m.floor != null && m.ceiling != null) {
    return `${axisShort(m.axis)} ${m.floor}–${m.ceiling}${u}`;
  }
  if (m.ceiling != null) return `${axisShort(m.axis)} ≤ ${m.ceiling}${u}`;
  if (m.floor != null) return `${axisShort(m.axis)} ≥ ${m.floor}${u}`;
  return axisShort(m.axis);
}

/**
 * Daily macro line for coach/chat/period review.
 * Clinic live macros for the day → clinic HARD axes only (no leftover daily_macro_target).
 * No clinic order → phone point, same as before the redesign.
 */
export function formatEffectiveDailyMacroTargetLine(
  point: {
    kcal?: number;
    protein_g?: number;
    carb_g?: number;
    fat_g?: number;
    fiber_g?: number;
    net_carb_g?: number;
  } | null,
  meters: ResolvedAxisMeter[],
): string {
  if (clinicMacroRedesignActive(meters)) {
    const parts = PROMPT_AXES.map((axis) => {
      const hard = hardAxis(meters, axis);
      return hard ? formatHardSlot(hard) : null;
    }).filter((s): s is string => Boolean(s));
    return parts.length ? `Clinic live macros: ${parts.join(' | ')}` : '';
  }
  const kcal = formatAxisSlot(meters, 'kcal', point?.kcal, '');
  const p = formatAxisSlot(meters, 'protein_g', point?.protein_g, 'g');
  const c = formatAxisSlot(meters, 'carb_g', point?.carb_g, 'g');
  const f = formatAxisSlot(meters, 'fat_g', point?.fat_g, 'g');
  const fi = formatAxisSlot(meters, 'fiber_g', point?.fiber_g, 'g');
  const net = formatAxisSlot(meters, 'net_carb_g', point?.net_carb_g, 'g');
  const showNet = point?.net_carb_g != null;
  return `Daily macro target: ${kcal} | ${p} | ${c} | ${f} | ${fi}${showNet ? ` | ${net}` : ''}`;
}

function axisShort(axis: MacroAxis): string {
  switch (axis) {
    case 'kcal': return 'kcal';
    case 'protein_g': return 'P';
    case 'carb_g': return 'C';
    case 'fat_g': return 'F';
    case 'fiber_g': return 'Fi';
    case 'net_carb_g': return 'C−Fi';
  }
}

function formatAxisSlot(
  meters: ResolvedAxisMeter[],
  axis: MacroAxis,
  point: number | null | undefined,
  unit: string,
): string {
  const hard = hardAxis(meters, axis);
  const u = unit ? unit : '';
  if (hard) {
    if (hard.floor != null && hard.ceiling != null) {
      return `${axisShort(axis)} ${hard.floor}–${hard.ceiling}${u}`;
    }
    if (hard.ceiling != null) return `${axisShort(axis)} ≤ ${hard.ceiling}${u}`;
    if (hard.floor != null) return `${axisShort(axis)} ≥ ${hard.floor}${u}`;
  }
  if (point != null && Number.isFinite(point)) return `${axisShort(axis)} ${point}${u}`;
  return `${axisShort(axis)} —`;
}
