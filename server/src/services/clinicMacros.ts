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
import { ClinicError, getOverlayForMentor, getOverlayForPatient, type ClinicOverlay } from './clinicOverlay.js';
import { proposeClinicMacroOrder } from './geminiClinic.js';
import { normalizePlateCollection, type PlateCollection } from './plateCollections.js';
import { markerKcalPerGram, saveMarkersForPatient, type TreatmentMarker } from './treatmentMarkers.js';
import { stripLegacyMacroTargetFromLatestBlob } from './sync.js';
import { createHash } from 'crypto';

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
  /** Omitted when strength is flex and there is no guide number (unlocked axis). */
  value?: number;
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
  /** Example plates the clinic picked for this patient (prompt118). */
  plateCollection?: PlateCollection;
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
      : bound.value ?? 0;
  }
  const base = bound.value ?? 0;
  const add = bound.activityAddBack;
  if (!add || !boundHasNumber(bound)) return base;
  const activity = activityKcal == null || !Number.isFinite(activityKcal) ? 0 : activityKcal;
  const ratio = add.ratio == null || !Number.isFinite(add.ratio) ? 1 : add.ratio;
  const extra = Math.max(0, activity - add.thresholdKcal) * ratio;
  return Math.min(base + extra, add.capValue);
}

function kcalOrderAnchor(bounds: MacroBound[]): number | null {
  const kcalBounds = bounds.filter((b) => b.axis === 'kcal' && boundHasNumber(b));
  if (kcalBounds.length === 0) return null;
  // Prefer a ceiling / flex point as the prescription anchor; else floor.
  const ceiling = kcalBounds.find((b) => b.direction === 'ceiling');
  if (ceiling?.value != null) return ceiling.value;
  const floor = kcalBounds.find((b) => b.direction === 'floor');
  return floor?.value != null ? floor.value : null;
}

function assertFeasibility(bounds: MacroBound[]): void {
  const byAxis = new Map<MacroAxis, { floor?: MacroBound; ceiling?: MacroBound }>();
  for (const b of bounds) {
    if (!boundHasNumber(b)) continue;
    const slot = byAxis.get(b.axis) ?? {};
    if (b.direction === 'floor') slot.floor = b;
    else slot.ceiling = b;
    byAxis.set(b.axis, slot);
  }

  for (const [axis, pair] of byAxis) {
    if (pair.floor && pair.ceiling) {
      const flo = pair.floor.resolvedValue ?? pair.floor.value!;
      const cei = pair.ceiling.resolvedValue ?? pair.ceiling.value!;
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
    const F = carb.floor.resolvedValue ?? carb.floor.value!;
    const N = net.ceiling.resolvedValue ?? net.ceiling.value!;
    if (F > N) {
      const impliedFi = F - N;
      if (
        fiber?.ceiling?.strength === 'hard' &&
        (fiber.ceiling.resolvedValue ?? fiber.ceiling.value!) < impliedFi
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
  value?: number | null;
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

/** Food Log meter order — Propose should cover every axis (FLEX = no number when unlocked). */
export const FOOD_LOG_MACRO_AXES: MacroAxis[] = [
  'kcal',
  'protein_g',
  'carb_g',
  'fat_g',
  'fiber_g',
  'net_carb_g',
];

/** True when this bound locks or guides a number on the phone. */
export function boundHasNumber(b: MacroBound): boolean {
  return b.value != null && Number.isFinite(b.value) && b.value > 0;
}

/**
 * Ensure every Food Log axis appears. Missing axes → FLEX with no value (not invented).
 */
export function ensureFoodLogFlexPlaceholders(bounds: MacroBound[]): MacroBound[] {
  const present = new Set(bounds.map((b) => b.axis));
  const out = [...bounds];
  for (const axis of FOOD_LOG_MACRO_AXES) {
    if (present.has(axis)) continue;
    out.push({
      axis,
      direction: 'ceiling',
      kind: 'constant',
      strength: 'flex',
    });
  }
  return out;
}

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
      if (opts.skipUnknown) continue;
      throw new ClinicError(`Invalid direction for ${axis}`, 400);
    }
    const strength = String(row?.strength || '').trim() as MacroStrength;
    if (strength !== 'hard' && strength !== 'flex') {
      if (opts.skipUnknown) continue;
      throw new ClinicError(`Invalid strength for ${axis}`, 400);
    }
    const kindRaw = row?.kind == null || row.kind === '' ? 'constant' : String(row.kind);
    if (kindRaw !== 'constant' && kindRaw !== 'percent') {
      if (opts.skipUnknown) continue;
      throw new ClinicError(`Invalid kind for ${axis}`, 400);
    }
    const kind = kindRaw as MacroBoundKind;
    const valueRaw = row.value;
    const value =
      valueRaw == null || valueRaw === ('' as unknown) ? NaN : Number(valueRaw);
    const hasNumber = Number.isFinite(value) && value > 0;

    // FLEX with no number = unlocked Food Log axis (no invent). One slot per axis.
    if (strength === 'flex' && !hasNumber) {
      const key = `${axis}:flex_open`;
      if (seen.has(key) || [...seen].some((k) => k.startsWith(`${axis}:`))) {
        if (opts.skipUnknown) continue;
        throw new ClinicError(`Duplicate bound on ${axis}`, 400);
      }
      seen.add(key);
      out.push({
        axis,
        direction: direction || 'ceiling',
        kind: 'constant',
        strength: 'flex',
      });
      continue;
    }

    if (!hasNumber) {
      if (opts.skipUnknown) continue;
      throw new ClinicError(`value must be > 0 for ${axis}`, 400);
    }
    if (kind === 'percent' && (value > 100 || value <= 0)) {
      if (opts.skipUnknown) continue;
      throw new ClinicError(`percent value must be 0 < n ≤ 100 for ${axis}`, 400);
    }

    const key = `${axis}:${direction}`;
    if (seen.has(key)) {
      if (opts.skipUnknown) continue;
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
        if (opts.skipUnknown) continue;
        throw new ClinicError(`percent bound on ${axis} requires of: kcal_order | kcal_eaten`, 400);
      }
      // Macro card: only kcal_order for P/C/F (eaten is for markers).
      if (of === 'kcal_eaten') {
        if (opts.skipUnknown) continue;
        throw new ClinicError(
          `${axis}: of kcal_eaten is for treatment markers, not macro bounds`,
          400,
        );
      }
      bound.of = of;
      const resolved = Number(row.resolvedValue);
      if (!Number.isFinite(resolved) || resolved <= 0) {
        if (opts.skipUnknown) continue;
        throw new ClinicError(`resolvedValue required for percent ${axis}`, 400);
      }
      bound.resolvedValue = axis === 'kcal' ? Math.round(resolved) : round1(resolved);
    }

    if (row.activityAddBack != null) {
      const addOk =
        axis === 'kcal' && direction === 'ceiling' && strength === 'hard';
      const thr = Number(row.activityAddBack.thresholdKcal);
      const cap = Number(row.activityAddBack.capValue);
      if (
        addOk &&
        Number.isFinite(thr) &&
        thr >= 0 &&
        Number.isFinite(cap) &&
        cap > (bound.value ?? 0)
      ) {
        const add: MacroActivityAddBack = {
          thresholdKcal: Math.round(thr),
          capValue: Math.round(cap),
        };
        if (row.activityAddBack.ratio != null) {
          const r = Number(row.activityAddBack.ratio);
          if (Number.isFinite(r) && r > 0) add.ratio = r;
        }
        bound.activityAddBack = add;
      } else if (!opts.skipUnknown) {
        if (axis !== 'kcal' || direction !== 'ceiling' || strength !== 'hard') {
          throw new ClinicError(
            'activityAddBack only allowed on HARD kcal ceiling',
            400,
          );
        }
        if (!Number.isFinite(thr) || thr < 0) {
          throw new ClinicError('activityAddBack.thresholdKcal must be ≥ 0', 400);
        }
        throw new ClinicError('activityAddBack.capValue must be > base kcal value', 400);
      }
    }

    if (row.followsActivity === true) {
      if (kind === 'percent' && bound.of === 'kcal_order') {
        bound.followsActivity = true;
      } else if (!opts.skipUnknown) {
        throw new ClinicError('followsActivity requires percent of kcal_order', 400);
      }
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
    /** `undefined` keeps the clinic's current pick; `null` clears it. */
    plateCollection?: PlateCollection | null;
  } = {},
): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);
  const setAt = new Date().toISOString();
  const bounds = normalizeClinicMacroBounds(input);
  // A rules rebuild must not wipe a profile the clinic chose by hand.
  const plateCollection =
    meta.plateCollection === undefined
      ? ((await getOverlayForMentor(mentor, patientId)).macros?.plateCollection ?? null)
      : meta.plateCollection;
  const payload: ClinicMacrosPayload =
    bounds.length === 0
      ? {
          bounds: [],
          updatedAt: setAt,
          ...(meta.source ? { source: meta.source } : {}),
          ...(plateCollection ? { plateCollection } : {}),
        }
      : {
          bounds,
          updatedAt: setAt,
          ...(meta.rulesHash ? { rulesHash: meta.rulesHash } : {}),
          ...(meta.reasoning ? { reasoning: meta.reasoning } : {}),
          ...(meta.needsClinician?.length ? { needsClinician: meta.needsClinician } : {}),
          ...(plateCollection ? { plateCollection } : {}),
          source: meta.source ?? 'clinic_override',
        };

  // Empty bounds → store null so patient pull can fall through cleanly? Spec: empty [] clears.
  // Keep { bounds: [], updatedAt } so clinic sees “cleared” vs never set.
  await writeMacrosPayload(
    patientId,
    orgId,
    bounds.length === 0 && !meta.rulesHash
      ? { bounds: [], updatedAt: setAt, ...(plateCollection ? { plateCollection } : {}) }
      : payload,
    mentor.id,
  );

  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'macros.write',
  });

  if (bounds.some((b) => b.strength === 'hard')) {
    try {
      await stripLegacyMacroTargetFromLatestBlob(patientId);
    } catch (err) {
      console.warn(
        '[clinicMacros] strip leftover daily_macro_target failed',
        patientId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return getOverlayForMentor(mentor, patientId);
}

/**
 * Set (or clear) the example-plate collection the clinic picked for this patient.
 *
 * Deliberately independent of the macro bounds: the clinic chooses a profile once
 * and it survives every later bounds edit or rules rebuild. An unknown slug lands
 * as null rather than 400 — the app treats null as "no plates link".
 */
export async function setPlateCollectionForPatient(
  mentor: PublicUser,
  patientId: string,
  raw: unknown,
): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);
  const collection = normalizePlateCollection(raw);
  const current = (await getOverlayForMentor(mentor, patientId)).macros;

  const next: ClinicMacrosPayload = {
    ...(current ?? { bounds: [] }),
    updatedAt: new Date().toISOString(),
    ...(collection ? { plateCollection: collection } : {}),
  };
  if (!collection) delete next.plateCollection;

  await writeMacrosPayload(patientId, orgId, next, mentor.id);
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
  const plateCollection = normalizePlateCollection(obj.plateCollection);
  if (obj.bounds.length === 0) {
    return {
      bounds: [],
      updatedAt,
      ...(obj.rulesHash ? { rulesHash: obj.rulesHash } : {}),
      ...(obj.reasoning ? { reasoning: obj.reasoning } : {}),
      ...(obj.needsClinician ? { needsClinician: obj.needsClinician } : {}),
      ...(obj.source ? { source: obj.source } : {}),
      ...(plateCollection ? { plateCollection } : {}),
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
      ...(plateCollection ? { plateCollection } : {}),
    };
  } catch {
    return null;
  }
}

export function hashRulesText(rawText: string): string {
  return createHash('sha256').update(String(rawText || '').trim(), 'utf8').digest('hex').slice(0, 32);
}

function markersSummaryLine(markers: TreatmentMarker[] | null | undefined): string {
  if (!markers?.length) return '(none)';
  return markers
    .map((m) => {
      const pct =
        m.percentOfEnergy != null ? ` ${m.percentOfEnergy}% energy` : '';
      return `${m.marker} ${m.direction} ${m.dailyTarget}${m.unit}${pct}`;
    })
    .join('; ');
}

export type ProposedClinicMacros = {
  bounds: MacroBound[];
  markers: Array<{
    marker: string;
    direction: 'cap' | 'floor';
    dailyTarget: number;
    percentOfEnergy?: number;
    ofEnergy?: 'kcal_eaten';
    note?: string;
  }>;
  reasoning: string;
  impliedNotes: string[];
  needsClinician: MacroNeedsClinician[];
  rulesHash: string;
};

/** One engine — same Propose as clinic Rules Save. */
export async function proposeMacrosFromRulesText(
  rulesText: string,
  markersSummary: string,
): Promise<ProposedClinicMacros> {
  const draft = await proposeClinicMacroOrder({
    rulesRawText: rulesText,
    markersSummary,
  });
  const bounds = ensureFoodLogFlexPlaceholders(
    normalizeClinicMacroBounds(draft.bounds as MacroBoundInput[], {
      skipUnknown: true,
    }),
  );
  const needsClinician: MacroNeedsClinician[] = draft.needsClinician
    .map((n) => {
      const axis = n.axis as MacroNeedsClinician['axis'];
      return { axis, question: n.question };
    })
    .filter((n) => n.question);
  return {
    bounds,
    markers: draft.markers,
    reasoning: draft.reasoning,
    impliedNotes: draft.impliedNotes,
    needsClinician,
    rulesHash: hashRulesText(rulesText),
  };
}

/**
 * Propose from rules (no write). Used by POST /macros/propose and rebuild.
 */
export async function proposeMacrosForPatient(
  mentor: PublicUser,
  patientId: string,
): Promise<ProposedClinicMacros> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const overlay = await getOverlayForMentor(mentor, patientId);
  const rulesText = overlay.rules?.rawText || '';
  return proposeMacrosFromRulesText(rulesText, markersSummaryLine(overlay.markers));
}

function buildMacrosWritePayload(
  bounds: MacroBound[],
  meta: {
    rulesHash?: string;
    reasoning?: string;
    needsClinician?: MacroNeedsClinician[];
    source?: 'rules' | 'clinic_override';
    plateCollection?: PlateCollection | null;
  },
): ClinicMacrosPayload {
  const setAt = new Date().toISOString();
  return bounds.length === 0
    ? { bounds: [], updatedAt: setAt, ...(meta.source ? { source: meta.source } : {}) }
    : {
        bounds,
        updatedAt: setAt,
        ...(meta.rulesHash ? { rulesHash: meta.rulesHash } : {}),
        ...(meta.reasoning ? { reasoning: meta.reasoning } : {}),
        ...(meta.needsClinician?.length ? { needsClinician: meta.needsClinician } : {}),
        ...(meta.plateCollection ? { plateCollection: meta.plateCollection } : {}),
        source: meta.source ?? 'clinic_override',
      };
}

async function patientOrgIds(patientId: string): Promise<string[]> {
  const { rows } = await query<{ org_id: string }>(
    `SELECT org_id FROM clinic_org_overlays WHERE patient_id = $1
     UNION
     SELECT org_id FROM account_shares
     WHERE patient_id = $1 AND status = 'approved' AND org_id IS NOT NULL`,
    [patientId],
  );
  return rows.map((r) => r.org_id).filter(Boolean);
}

/** Phone Analyze / /macros — same Propose + overlay write as clinic Rules Save. */
export async function rebuildMacrosForPatientSelf(
  patient: PublicUser,
  rulesText: string,
): Promise<{ macros: ClinicMacrosPayload }> {
  if (patient.role !== 'patient') {
    throw new ClinicError('Requires patient role', 403);
  }
  const trimmed = rulesText.trim();
  if (!trimmed) {
    throw new ClinicError('My Rules text is required to rebuild live macros', 400);
  }
  const overlay = await getOverlayForPatient(patient);
  const proposed = await proposeMacrosFromRulesText(
    trimmed,
    markersSummaryLine(overlay?.markers ?? null),
  );
  const payload = buildMacrosWritePayload(proposed.bounds, {
    source: 'rules',
    rulesHash: proposed.rulesHash,
    reasoning: proposed.reasoning,
    needsClinician: proposed.needsClinician,
    // Rebuilding from rules must not drop the clinic's picked profile.
    plateCollection: overlay?.macros?.plateCollection ?? null,
  });
  const orgs = await patientOrgIds(patient.id);
  for (const orgId of orgs) {
    await writeMacrosPayload(patient.id, orgId, payload, patient.id);
  }
  if (proposed.bounds.some((b) => b.strength === 'hard')) {
    try {
      await stripLegacyMacroTargetFromLatestBlob(patient.id);
    } catch (err) {
      console.warn(
        '[clinicMacros] strip leftover daily_macro_target failed',
        patient.id,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return { macros: payload };
}

/**
 * Auto-apply path: propose → write macros (source rules) → upsert markers named in proposal.
 * Does not delete existing markers omitted from the proposal.
 * Safe to call after rules Save — failures should be caught by the caller.
 */
export async function rebuildMacrosFromRulesForPatient(
  mentor: PublicUser,
  patientId: string,
): Promise<ClinicOverlay> {
  const proposed = await proposeMacrosForPatient(mentor, patientId);
  const needs = proposed.needsClinician.map((n) => ({
    axis: n.axis,
    question: n.question,
  }));

  await saveMacrosForPatient(mentor, patientId, proposed.bounds as MacroBoundInput[], {
    source: 'rules',
    rulesHash: proposed.rulesHash,
    reasoning: proposed.reasoning,
    needsClinician: needs,
    // plateCollection omitted — saveMacrosForPatient keeps the clinic's current pick.
  });

  if (proposed.markers.length > 0) {
    const overlay = await getOverlayForMentor(mentor, patientId);
    const existing = overlay.markers || [];
    const byCode = new Map(existing.map((m) => [m.marker, m]));
    const kcalCeiling = proposed.bounds.find(
      (b) => b.axis === 'kcal' && b.direction === 'ceiling' && boundHasNumber(b),
    );
    const kcalBase = kcalCeiling?.value ?? 1740;

    for (const m of proposed.markers) {
      const prev = byCode.get(m.marker);
      let dailyTarget = Number(m.dailyTarget);
      if (m.percentOfEnergy != null && m.percentOfEnergy > 0) {
        // Grams fallback at kcal order (compat) — phone resolves live from kcal eaten.
        const kcalPerG = markerKcalPerGram(m.marker) ?? 9;
        const fromPct = round1((m.percentOfEnergy / 100) * kcalBase / kcalPerG);
        if (!Number.isFinite(dailyTarget) || dailyTarget <= 0) dailyTarget = fromPct;
      }
      if (!Number.isFinite(dailyTarget) || dailyTarget <= 0) continue;

      byCode.set(m.marker, {
        marker: m.marker,
        direction: m.direction,
        dailyTarget,
        // Catalog unit wins on save; keep prior labs / notes / labels.
        unit: prev?.unit || 'g',
        linkedLabCodes: Array.isArray(prev?.linkedLabCodes) ? prev.linkedLabCodes : [],
        setAt: new Date().toISOString(),
        setBy: mentor.id,
        ...(prev?.labels ? { labels: prev.labels } : {}),
        ...(prev?.estimateGuidance ? { estimateGuidance: prev.estimateGuidance } : {}),
        ...(m.note?.trim()
          ? { note: m.note.trim() }
          : prev?.note
            ? { note: prev.note }
            : {}),
        ...(m.percentOfEnergy != null
          ? { percentOfEnergy: m.percentOfEnergy, ofEnergy: 'kcal_eaten' as const }
          : {}),
      });
    }
    const merged = [...byCode.values()].slice(0, 3).map((m) => ({
      marker: m.marker,
      direction: m.direction,
      dailyTarget: m.dailyTarget,
      note: m.note,
      linkedLabCodes: m.linkedLabCodes,
      ...(m.percentOfEnergy != null
        ? { percentOfEnergy: m.percentOfEnergy, ofEnergy: 'kcal_eaten' as const }
        : {}),
    }));
    try {
      await saveMarkersForPatient(mentor, patientId, merged);
    } catch (err) {
      // Marker upsert must not undo a successful macros write.
      console.warn(
        '[clinicMacros] marker upsert after rules rebuild failed',
        patientId,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return getOverlayForMentor(mentor, patientId);
}
