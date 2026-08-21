/**
 * Clinic live macro bounds (be-45) — validate, save, resolve helpers.
 * Phone meters / propose auto-apply are later phases.
 */
import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import {
  assertMentorPatientAccess,
  getMentorOrgId,
  recordPatientAccess,
} from './clinicAccess.js';
import { ClinicError, getOverlayForMentor, type ClinicOverlay } from './clinicOverlay.js';

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
  value: number;
  of?: MacroPercentOf;
  resolvedValue?: number;
  strength: MacroStrength;
  activityAddBack?: MacroActivityAddBack;
  followsActivity?: boolean;
};

export type MacroNeedsClinician = {
  axis: MacroAxis | 'kcal_target';
  question: string;
};

export type ClinicMacrosPayload = {
  bounds: MacroBound[];
  updatedAt: string;
  rulesHash?: string;
  reasoning?: string;
  needsClinician?: MacroNeedsClinician[];
  /** Present after a manual override that diverges from last rules-built order. */
  source?: 'rules' | 'clinic_override';
};

const AXES = new Set<MacroAxis>([
  'kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fiber_g',
  'net_carb_g',
]);

const FAT_AXES = new Set<MacroAxis>(['fat_g']);

async function requireMentorOrg(mentorId: string): Promise<string> {
  const orgId = await getMentorOrgId(mentorId);
  if (!orgId) {
    throw new ClinicError('Clinic organization missing for this account', 500);
  }
  return orgId;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Grams (or kcal) from a percent of an energy base. */
export function resolvePercentToGrams(
  percent: number,
  kcalBase: number,
  axis: MacroAxis,
): number {
  const denom = FAT_AXES.has(axis) ? 9 : 4;
  if (axis === 'kcal') {
    return Math.round((percent / 100) * kcalBase);
  }
  return round1((percent / 100) * kcalBase / denom);
}

/**
 * kcal ceiling with optional activity add-back.
 * activityKcal = measured activity only (not BMR). Missing/zero → base value.
 */
export function resolveKcalCeiling(
  bound: MacroBound,
  activityKcal: number | null | undefined,
): number {
  if (bound.axis !== 'kcal' || bound.direction !== 'ceiling') {
    return bound.kind === 'percent' && bound.resolvedValue != null
      ? bound.resolvedValue
      : bound.value;
  }
  const base = bound.value;
  const add = bound.activityAddBack;
  if (!add) return base;
  const activity = activityKcal == null || !Number.isFinite(activityKcal) ? 0 : activityKcal;
  const ratio = add.ratio == null || !Number.isFinite(add.ratio) ? 1 : add.ratio;
  const extra = Math.max(0, activity - add.thresholdKcal) * ratio;
  return Math.min(base + extra, add.capValue);
}

function kcalOrderAnchor(bounds: MacroBound[]): number | null {
  const kcalBounds = bounds.filter((b) => b.axis === 'kcal');
  if (kcalBounds.length === 0) return null;
  // Prefer a ceiling / flex point as the prescription anchor; else floor.
  const ceiling = kcalBounds.find((b) => b.direction === 'ceiling');
  if (ceiling) return ceiling.value;
  const floor = kcalBounds.find((b) => b.direction === 'floor');
  return floor ? floor.value : null;
}

function assertFeasibility(bounds: MacroBound[]): void {
  const byAxis = new Map<MacroAxis, { floor?: MacroBound; ceiling?: MacroBound }>();
  for (const b of bounds) {
    const slot = byAxis.get(b.axis) ?? {};
    if (b.direction === 'floor') slot.floor = b;
    else slot.ceiling = b;
    byAxis.set(b.axis, slot);
  }

  for (const [axis, pair] of byAxis) {
    if (pair.floor && pair.ceiling) {
      const flo = pair.floor.resolvedValue ?? pair.floor.value;
      const cei = pair.ceiling.resolvedValue ?? pair.ceiling.value;
      if (!(flo < cei)) {
        throw new ClinicError(`${axis}: floor must be < ceiling`, 400);
      }
    }
  }

  const carb = byAxis.get('carb_g');
  const net = byAxis.get('net_carb_g');
  const fiber = byAxis.get('fiber_g');
  if (
    carb?.floor?.strength === 'hard' &&
    net?.ceiling?.strength === 'hard'
  ) {
    const F = carb.floor.resolvedValue ?? carb.floor.value;
    const N = net.ceiling.resolvedValue ?? net.ceiling.value;
    if (F > N) {
      const impliedFi = F - N;
      if (
        fiber?.ceiling?.strength === 'hard' &&
        (fiber.ceiling.resolvedValue ?? fiber.ceiling.value) < impliedFi
      ) {
        throw new ClinicError(
          `Impossible: C floor ${F} + net ceiling ${N} needs Fi ≥ ${impliedFi}, but Fi ceiling is lower`,
          400,
        );
      }
    }
  }
}

export type MacroBoundInput = {
  axis: string;
  direction: string;
  kind?: string;
  value: number;
  of?: string;
  resolvedValue?: number;
  strength: string;
  activityAddBack?: {
    thresholdKcal: number;
    capValue: number;
    ratio?: number;
  };
  followsActivity?: boolean;
};

/**
 * Validate clinician / Propose bounds. Throws ClinicError(400).
 * Unknown axes are skipped (compat) when skipUnknown is true — PUT rejects them.
 */
export function normalizeClinicMacroBounds(
  input: MacroBoundInput[],
  opts: { skipUnknown?: boolean } = {},
): MacroBound[] {
  if (!Array.isArray(input)) {
    throw new ClinicError('bounds must be an array', 400);
  }

  const out: MacroBound[] = [];
  const seen = new Set<string>();

  for (const row of input) {
    const axis = String(row?.axis || '').trim() as MacroAxis;
    if (!AXES.has(axis)) {
      if (opts.skipUnknown) continue;
      throw new ClinicError(`Unknown macro axis: ${row?.axis}`, 400);
    }
    const direction = String(row?.direction || '').trim() as MacroDirection;
    if (direction !== 'floor' && direction !== 'ceiling') {
      throw new ClinicError(`Invalid direction for ${axis}`, 400);
    }
    const strength = String(row?.strength || '').trim() as MacroStrength;
    if (strength !== 'hard' && strength !== 'flex') {
      throw new ClinicError(`Invalid strength for ${axis}`, 400);
    }
    const kindRaw = row?.kind == null || row.kind === '' ? 'constant' : String(row.kind);
    if (kindRaw !== 'constant' && kindRaw !== 'percent') {
      throw new ClinicError(`Invalid kind for ${axis}`, 400);
    }
    const kind = kindRaw as MacroBoundKind;
    const value = Number(row.value);
    if (!Number.isFinite(value) || value <= 0) {
      throw new ClinicError(`value must be > 0 for ${axis}`, 400);
    }
    if (kind === 'percent' && (value > 100 || value <= 0)) {
      throw new ClinicError(`percent value must be 0 < n ≤ 100 for ${axis}`, 400);
    }

    const key = `${axis}:${direction}`;
    if (seen.has(key)) {
      throw new ClinicError(`Duplicate ${direction} on ${axis}`, 400);
    }
    seen.add(key);

    const bound: MacroBound = {
      axis,
      direction,
      kind,
      value: kind === 'percent' ? round1(value) : axis === 'kcal' ? Math.round(value) : round1(value),
      strength,
    };

    if (kind === 'percent') {
      const of = String(row?.of || '').trim() as MacroPercentOf;
      if (of !== 'kcal_order' && of !== 'kcal_eaten') {
        throw new ClinicError(`percent bound on ${axis} requires of: kcal_order | kcal_eaten`, 400);
      }
      // Macro card: only kcal_order for P/C/F (eaten is for markers).
      if (of === 'kcal_eaten') {
        throw new ClinicError(
          `${axis}: of kcal_eaten is for treatment markers, not macro bounds`,
          400,
        );
      }
      bound.of = of;
      const resolved = Number(row.resolvedValue);
      if (!Number.isFinite(resolved) || resolved <= 0) {
        throw new ClinicError(`resolvedValue required for percent ${axis}`, 400);
      }
      bound.resolvedValue = axis === 'kcal' ? Math.round(resolved) : round1(resolved);
    }

    if (row.activityAddBack != null) {
      if (axis !== 'kcal' || direction !== 'ceiling' || strength !== 'hard') {
        throw new ClinicError(
          'activityAddBack only allowed on HARD kcal ceiling',
          400,
        );
      }
      const thr = Number(row.activityAddBack.thresholdKcal);
      const cap = Number(row.activityAddBack.capValue);
      if (!Number.isFinite(thr) || thr < 0) {
        throw new ClinicError('activityAddBack.thresholdKcal must be ≥ 0', 400);
      }
      if (!Number.isFinite(cap) || cap <= bound.value) {
        throw new ClinicError('activityAddBack.capValue must be > base kcal value', 400);
      }
      const add: MacroActivityAddBack = {
        thresholdKcal: Math.round(thr),
        capValue: Math.round(cap),
      };
      if (row.activityAddBack.ratio != null) {
        const r = Number(row.activityAddBack.ratio);
        if (!Number.isFinite(r) || r <= 0) {
          throw new ClinicError('activityAddBack.ratio must be > 0', 400);
        }
        add.ratio = r;
      }
      bound.activityAddBack = add;
    }

    if (row.followsActivity === true) {
      if (kind !== 'percent' || bound.of !== 'kcal_order') {
        throw new ClinicError('followsActivity requires percent of kcal_order', 400);
      }
      bound.followsActivity = true;
    }

    out.push(bound);
  }

  // followsActivity requires a kcal ceiling with activityAddBack in the same payload.
  const hasAddBack = out.some(
    (b) => b.axis === 'kcal' && b.direction === 'ceiling' && b.activityAddBack,
  );
  for (const b of out) {
    if (b.followsActivity && !hasAddBack) {
      throw new ClinicError(
        'followsActivity requires a kcal ceiling with activityAddBack',
        400,
      );
    }
  }

  // Percent of kcal_order needs a kcal line in the order.
  const anchor = kcalOrderAnchor(out);
  for (const b of out) {
    if (b.kind === 'percent' && b.of === 'kcal_order' && anchor == null) {
      throw new ClinicError(
        `${b.axis}: percent of kcal_order requires a kcal bound on the order`,
        400,
      );
    }
  }

  assertFeasibility(out);
  return out;
}

async function writeMacrosPayload(
  patientId: string,
  orgId: string,
  payload: ClinicMacrosPayload | null,
  updatedBy: string,
): Promise<void> {
  await query(
    `INSERT INTO clinic_org_overlays (patient_id, org_id, macros_json, updated_at, updated_by)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (patient_id, org_id) DO UPDATE
       SET macros_json = EXCLUDED.macros_json,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
    [patientId, orgId, payload, updatedBy],
  );
}

export async function saveMacrosForPatient(
  mentor: PublicUser,
  patientId: string,
  input: MacroBoundInput[],
  meta: {
    rulesHash?: string;
    reasoning?: string;
    needsClinician?: MacroNeedsClinician[];
    source?: 'rules' | 'clinic_override';
  } = {},
): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);
  const setAt = new Date().toISOString();
  const bounds = normalizeClinicMacroBounds(input);
  const payload: ClinicMacrosPayload =
    bounds.length === 0
      ? { bounds: [], updatedAt: setAt, ...(meta.source ? { source: meta.source } : {}) }
      : {
          bounds,
          updatedAt: setAt,
          ...(meta.rulesHash ? { rulesHash: meta.rulesHash } : {}),
          ...(meta.reasoning ? { reasoning: meta.reasoning } : {}),
          ...(meta.needsClinician?.length ? { needsClinician: meta.needsClinician } : {}),
          source: meta.source ?? 'clinic_override',
        };

  // Empty bounds → store null so patient pull can fall through cleanly? Spec: empty [] clears.
  // Keep { bounds: [], updatedAt } so clinic sees “cleared” vs never set.
  await writeMacrosPayload(
    patientId,
    orgId,
    bounds.length === 0 && !meta.rulesHash ? { bounds: [], updatedAt: setAt } : payload,
    mentor.id,
  );

  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'macros.write',
  });

  return getOverlayForMentor(mentor, patientId);
}

/** Read-side helper for mergeOverlay — skip unknown, keep rest. */
export function macrosPayloadFromUnknown(raw: unknown): ClinicMacrosPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as ClinicMacrosPayload;
  if (!Array.isArray(obj.bounds)) return null;
  const updatedAt =
    typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date(0).toISOString();
  if (obj.bounds.length === 0) {
    return {
      bounds: [],
      updatedAt,
      ...(obj.rulesHash ? { rulesHash: obj.rulesHash } : {}),
      ...(obj.reasoning ? { reasoning: obj.reasoning } : {}),
      ...(obj.needsClinician ? { needsClinician: obj.needsClinician } : {}),
      ...(obj.source ? { source: obj.source } : {}),
    };
  }
  try {
    const bounds = normalizeClinicMacroBounds(obj.bounds as MacroBoundInput[], {
      skipUnknown: true,
    });
    if (bounds.length === 0) return null;
    return {
      bounds,
      updatedAt,
      ...(obj.rulesHash ? { rulesHash: obj.rulesHash } : {}),
      ...(obj.reasoning ? { reasoning: obj.reasoning } : {}),
      ...(obj.needsClinician ? { needsClinician: obj.needsClinician } : {}),
      ...(obj.source ? { source: obj.source } : {}),
    };
  } catch {
    return null;
  }
}
