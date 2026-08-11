/**
 * Clinic treatment markers — structured diet caps/floors (be-41).
 * Exact code match only; no keyword/name parsing.
 */

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

export type TreatmentMarkersPayload = {
  markers: TreatmentMarker[];
  updatedAt: string;
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

export async function saveMarkersForPatient(
  mentor: PublicUser,
  patientId: string,
  input: MarkerInput[],
): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);
  const setAt = new Date().toISOString();
  const markers = normalizeTreatmentMarkers(input, mentor.id, setAt);
  const payload: TreatmentMarkersPayload = { markers, updatedAt: setAt };

  await query(
    `INSERT INTO clinic_org_overlays (patient_id, org_id, markers_json, updated_at, updated_by)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (patient_id, org_id) DO UPDATE
       SET markers_json = EXCLUDED.markers_json,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
    [patientId, orgId, payload, mentor.id],
  );

  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'markers.write',
  });

  return getOverlayForMentor(mentor, patientId);
}
