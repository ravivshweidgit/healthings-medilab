/**
 * Clinic treatment markers — structured diet caps/floors (be-41).
 * Exact code match only; no keyword/name parsing.
 */

import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import {
  assertMentorPatientAccess,
  getMentorOrgId,
  recordPatientAccess,
} from './clinicAccess.js';
import {
  ClinicError,
  getOverlayForMentor,
  type ClinicOverlay,
} from './clinicOverlay.js';

export const DIET_MARKER_CODES = [
  'SAT_FAT_G',
  'CHOLESTEROL_MG',
  'SOLUBLE_FIBER_G',
  'OMEGA3_G',
  'ADDED_SUGAR_G',
  'SODIUM_MG',
  'POTASSIUM_MG',
  'PHOSPHORUS_MG',
] as const;

export type DietMarkerCode = (typeof DIET_MARKER_CODES)[number];

export const MAX_TREATMENT_MARKERS = 3;

const MARKER_META: Record<
  DietMarkerCode,
  { unit: 'g' | 'mg'; defaultDirection: 'cap' | 'floor'; linkedLabCodes: string[] }
> = {
  SAT_FAT_G: {
    unit: 'g',
    defaultDirection: 'cap',
    linkedLabCodes: ['CHOLESTEROL_LDL', 'CHOLESTEROL'],
  },
  CHOLESTEROL_MG: {
    unit: 'mg',
    defaultDirection: 'cap',
    linkedLabCodes: ['CHOLESTEROL_LDL', 'CHOLESTEROL'],
  },
  SOLUBLE_FIBER_G: {
    unit: 'g',
    defaultDirection: 'floor',
    linkedLabCodes: ['CHOLESTEROL_LDL'],
  },
  OMEGA3_G: {
    unit: 'g',
    defaultDirection: 'floor',
    linkedLabCodes: ['TRIGLYCERIDES'],
  },
  ADDED_SUGAR_G: {
    unit: 'g',
    defaultDirection: 'cap',
    linkedLabCodes: ['HBA1C', 'GLUCOSE', 'TRIGLYCERIDES'],
  },
  SODIUM_MG: { unit: 'mg', defaultDirection: 'cap', linkedLabCodes: [] },
  POTASSIUM_MG: {
    unit: 'mg',
    defaultDirection: 'cap',
    linkedLabCodes: ['CREATININE', 'UREA'],
  },
  PHOSPHORUS_MG: {
    unit: 'mg',
    defaultDirection: 'cap',
    linkedLabCodes: ['CREATININE', 'UREA'],
  },
};

export type TreatmentMarker = {
  marker: DietMarkerCode;
  direction: 'cap' | 'floor';
  dailyTarget: number;
  unit: 'g' | 'mg';
  linkedLabCodes: string[];
  note?: string;
  setAt: string;
  setBy: string;
};

/** Clinic-opt-in past meal marker estimate (phone executes; caps tokens). */
export type MarkersBackfillRequest = {
  id: string;
  days: number;
  requestedAt: string;
  requestedBy: string;
  status: 'pending' | 'done' | 'failed';
  completedAt?: string;
  mealsUpdated?: number;
  error?: string;
};

export const MARKERS_BACKFILL_MIN_DAYS = 1;
export const MARKERS_BACKFILL_MAX_DAYS = 90;
export const MARKERS_BACKFILL_DEFAULT_DAYS = 14;

export type TreatmentMarkersPayload = {
  markers: TreatmentMarker[];
  updatedAt: string;
  /** Optional one-shot past-meal fill — clinic sets, phone runs + acks. */
  backfill?: MarkersBackfillRequest | null;
};

export function isDietMarkerCode(raw: string): raw is DietMarkerCode {
  return (DIET_MARKER_CODES as readonly string[]).includes(raw);
}

export function dietMarkerUnit(code: DietMarkerCode): 'g' | 'mg' {
  return MARKER_META[code].unit;
}

export function dietMarkerDefaultLinkedLabs(code: DietMarkerCode): string[] {
  return [...MARKER_META[code].linkedLabCodes];
}

export function dietMarkerCatalog(): Array<{
  code: DietMarkerCode;
  unit: 'g' | 'mg';
  defaultDirection: 'cap' | 'floor';
  linkedLabCodes: string[];
}> {
  return DIET_MARKER_CODES.map((code) => ({
    code,
    unit: MARKER_META[code].unit,
    defaultDirection: MARKER_META[code].defaultDirection,
    linkedLabCodes: [...MARKER_META[code].linkedLabCodes],
  }));
}

type MarkerInput = {
  marker: string;
  direction: 'cap' | 'floor';
  dailyTarget: number;
  note?: string;
  linkedLabCodes?: string[];
};

/**
 * Validate and normalize clinician-submitted markers.
 * Throws ClinicError(400) on bad input.
 */
export function normalizeTreatmentMarkers(
  input: MarkerInput[],
  setBy: string,
  setAt: string = new Date().toISOString(),
): TreatmentMarker[] {
  if (!Array.isArray(input)) {
    throw new ClinicError('markers must be an array', 400);
  }
  if (input.length > MAX_TREATMENT_MARKERS) {
    throw new ClinicError(`At most ${MAX_TREATMENT_MARKERS} markers`, 400);
  }
  const seen = new Set<string>();
  const out: TreatmentMarker[] = [];
  for (const row of input) {
    const code = String(row?.marker || '').trim().toUpperCase();
    if (!isDietMarkerCode(code)) {
      throw new ClinicError(`Unknown marker code: ${row?.marker}`, 400);
    }
    if (seen.has(code)) {
      throw new ClinicError(`Duplicate marker: ${code}`, 400);
    }
    seen.add(code);
    if (row.direction !== 'cap' && row.direction !== 'floor') {
      throw new ClinicError(`Invalid direction for ${code}`, 400);
    }
    const dailyTarget = Number(row.dailyTarget);
    if (!Number.isFinite(dailyTarget) || dailyTarget <= 0) {
      throw new ClinicError(`dailyTarget must be > 0 for ${code}`, 400);
    }
    const unit = dietMarkerUnit(code);
    const linked =
      Array.isArray(row.linkedLabCodes) && row.linkedLabCodes.length > 0
        ? row.linkedLabCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
        : dietMarkerDefaultLinkedLabs(code);
    const note = typeof row.note === 'string' ? row.note.trim().slice(0, 500) : '';
    out.push({
      marker: code,
      direction: row.direction,
      dailyTarget: Math.round(dailyTarget * 10) / 10,
      unit,
      linkedLabCodes: linked,
      ...(note ? { note } : {}),
      setAt,
      setBy,
    });
  }
  return out;
}

async function requireMentorOrg(mentorId: string): Promise<string> {
  const orgId = await getMentorOrgId(mentorId);
  if (!orgId) {
    throw new ClinicError('Clinic organization missing for this account', 500);
  }
  return orgId;
}

async function loadMarkersPayload(
  patientId: string,
  orgId: string,
): Promise<TreatmentMarkersPayload | null> {
  const { rows } = await query<{ markers_json: TreatmentMarkersPayload | null }>(
    `SELECT markers_json FROM clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`,
    [patientId, orgId],
  );
  return rows[0]?.markers_json ?? null;
}

async function writeMarkersPayload(
  patientId: string,
  orgId: string,
  payload: TreatmentMarkersPayload,
  updatedBy: string,
): Promise<void> {
  await query(
    `INSERT INTO clinic_org_overlays (patient_id, org_id, markers_json, updated_at, updated_by)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (patient_id, org_id) DO UPDATE
       SET markers_json = EXCLUDED.markers_json,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
    [patientId, orgId, payload, updatedBy],
  );
}

export async function saveMarkersForPatient(
  mentor: PublicUser,
  patientId: string,
  input: MarkerInput[],
): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);
  const setAt = new Date().toISOString();
  const markers = normalizeTreatmentMarkers(input, mentor.id, setAt);
  const prev = await loadMarkersPayload(patientId, orgId);
  const payload: TreatmentMarkersPayload = {
    markers,
    updatedAt: setAt,
    // Preserve an in-flight / last backfill job when only the marker list changes.
    ...(prev?.backfill ? { backfill: prev.backfill } : {}),
  };

  await writeMarkersPayload(patientId, orgId, payload, mentor.id);

  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'markers.write',
  });

  return getOverlayForMentor(mentor, patientId);
}

/** Clinic requests phone to re-estimate markers on past meals (token-gated). */
export async function requestMarkersBackfill(
  mentor: PublicUser,
  patientId: string,
  daysRaw: number,
): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);
  const days = Math.round(Number(daysRaw));
  if (
    !Number.isFinite(days) ||
    days < MARKERS_BACKFILL_MIN_DAYS ||
    days > MARKERS_BACKFILL_MAX_DAYS
  ) {
    throw new ClinicError(
      `days must be ${MARKERS_BACKFILL_MIN_DAYS}–${MARKERS_BACKFILL_MAX_DAYS}`,
      400,
    );
  }

  const prev = await loadMarkersPayload(patientId, orgId);
  const markers = prev?.markers ?? [];
  if (!markers.length) {
    throw new ClinicError('Save treatment markers before requesting a past fill', 400);
  }
  if (prev?.backfill?.status === 'pending') {
    throw new ClinicError('A past-meal fill is already pending on the phone', 409);
  }

  const setAt = new Date().toISOString();
  const backfill: MarkersBackfillRequest = {
    id: randomUUID(),
    days,
    requestedAt: setAt,
    requestedBy: mentor.id,
    status: 'pending',
  };
  const payload: TreatmentMarkersPayload = {
    markers,
    updatedAt: setAt,
    backfill,
  };
  await writeMarkersPayload(patientId, orgId, payload, mentor.id);

  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'markers.backfill.request',
  });

  return getOverlayForMentor(mentor, patientId);
}

/** Patient phone reports backfill finished (or failed). */
export async function ackMarkersBackfill(
  patient: PublicUser,
  body: {
    id: string;
    status: 'done' | 'failed';
    mealsUpdated?: number;
    error?: string;
  },
): Promise<{ backfill: MarkersBackfillRequest | null }> {
  if (patient.role !== 'patient') {
    throw new ClinicError('Requires patient role', 403);
  }
  const id = String(body.id || '').trim();
  if (!id) throw new ClinicError('backfill id required', 400);
  if (body.status !== 'done' && body.status !== 'failed') {
    throw new ClinicError('status must be done or failed', 400);
  }

  const { rows } = await query<
    { org_id: string; markers_json: TreatmentMarkersPayload | null }
  >(
    `SELECT org_id, markers_json FROM clinic_org_overlays
     WHERE patient_id = $1 AND markers_json IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [patient.id],
  );
  const row = rows[0];
  if (!row?.markers_json) {
    throw new ClinicError('No markers overlay', 404);
  }
  const prev = row.markers_json;
  if (!prev.backfill || prev.backfill.id !== id) {
    throw new ClinicError('No matching pending backfill', 404);
  }
  if (prev.backfill.status !== 'pending') {
    return { backfill: prev.backfill };
  }

  const completedAt = new Date().toISOString();
  const mealsUpdated =
    body.mealsUpdated != null && Number.isFinite(Number(body.mealsUpdated))
      ? Math.max(0, Math.round(Number(body.mealsUpdated)))
      : undefined;
  const errText =
    typeof body.error === 'string' ? body.error.trim().slice(0, 500) : '';
  const backfill: MarkersBackfillRequest = {
    ...prev.backfill,
    status: body.status,
    completedAt,
    ...(mealsUpdated != null ? { mealsUpdated } : {}),
    ...(errText ? { error: errText } : {}),
  };
  const payload: TreatmentMarkersPayload = {
    markers: prev.markers ?? [],
    updatedAt: completedAt,
    backfill,
  };
  await writeMarkersPayload(patient.id, row.org_id, payload, patient.id);

  await recordPatientAccess({
    patientId: patient.id,
    actorUserId: patient.id,
    orgId: row.org_id,
    action: 'markers.backfill.ack',
  });

  return { backfill };
}
