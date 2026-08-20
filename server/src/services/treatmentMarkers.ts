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
import {
  DIET_MARKER_CATALOG_SEED,
  type DietMarkerDirection,
  type DietMarkerLabels,
  type DietMarkerUnit,
} from '../data/dietMarkerCatalogSeed.js';

export type { DietMarkerDirection, DietMarkerLabels, DietMarkerUnit };

/** Canonical code — catalog row, not a git enum. */
export type DietMarkerCode = string;

export const MAX_TREATMENT_MARKERS = 3;

const MARKER_CODE_RE = /^[A-Z][A-Z0-9_]{1,46}$/;

export type DietMarkerCatalogRow = {
  code: DietMarkerCode;
  unit: DietMarkerUnit;
  defaultDirection: DietMarkerDirection;
  linkedLabCodes: string[];
  labels: DietMarkerLabels;
  estimateGuidance: string | null;
  sortOrder: number;
  seeded: boolean;
};

export type TreatmentMarker = {
  marker: DietMarkerCode;
  direction: DietMarkerDirection;
  dailyTarget: number;
  unit: DietMarkerUnit;
  linkedLabCodes: string[];
  note?: string;
  setAt: string;
  setBy: string;
  labels?: DietMarkerLabels;
  estimateGuidance?: string;
};

type CatalogDbRow = {
  code: string;
  unit: DietMarkerUnit;
  default_direction: DietMarkerDirection;
  linked_lab_codes: unknown;
  labels: unknown;
  estimate_guidance: string | null;
  sort_order: number;
  seeded: boolean;
};

let catalogSeedPromise: Promise<void> | null = null;

export function isDietMarkerCode(raw: string): raw is DietMarkerCode {
  return MARKER_CODE_RE.test(String(raw || '').trim());
}

export function unitFromMarkerCode(code: string): DietMarkerUnit | null {
  if (code.endsWith('_MCG')) return 'mcg';
  if (code.endsWith('_MG')) return 'mg';
  if (code.endsWith('_G')) return 'g';
  return null;
}

function parseLabels(raw: unknown): DietMarkerLabels {
  if (!raw || typeof raw !== 'object') return {};
  const out: DietMarkerLabels = {};
  for (const [loc, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const short = String((val as { short?: string }).short || '').trim();
    const full = String((val as { full?: string }).full || '').trim();
    if (!short && !full) continue;
    out[loc.slice(0, 8)] = { short: short || full, full: full || short };
  }
  return out;
}

function parseLabCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
}

function rowToCatalog(row: CatalogDbRow): DietMarkerCatalogRow {
  return {
    code: row.code,
    unit: row.unit,
    defaultDirection: row.default_direction,
    linkedLabCodes: parseLabCodes(row.linked_lab_codes),
    labels: parseLabels(row.labels),
    estimateGuidance: row.estimate_guidance?.trim() || null,
    sortOrder: row.sort_order,
    seeded: row.seeded,
  };
}

export async function ensureDietMarkerCatalogSeeded(): Promise<void> {
  if (!catalogSeedPromise) {
    catalogSeedPromise = seedDietMarkerCatalogOnce().catch((err) => {
      catalogSeedPromise = null;
      throw err;
    });
  }
  await catalogSeedPromise;
}

async function seedDietMarkerCatalogOnce(): Promise<void> {
  for (const s of DIET_MARKER_CATALOG_SEED) {
    await query(
      `INSERT INTO diet_marker_catalog
         (code, unit, default_direction, linked_lab_codes, labels, estimate_guidance, sort_order, enabled, seeded, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, TRUE, TRUE, NOW())
       ON CONFLICT (code) DO UPDATE SET
         unit = EXCLUDED.unit,
         default_direction = EXCLUDED.default_direction,
         linked_lab_codes = EXCLUDED.linked_lab_codes,
         labels = EXCLUDED.labels,
         estimate_guidance = EXCLUDED.estimate_guidance,
         sort_order = EXCLUDED.sort_order,
         enabled = TRUE,
         seeded = TRUE,
         updated_at = NOW()
       WHERE diet_marker_catalog.seeded = TRUE`,
      [
        s.code,
        s.unit,
        s.defaultDirection,
        JSON.stringify(s.linkedLabCodes),
        JSON.stringify(s.labels),
        s.estimateGuidance ?? null,
        s.sortOrder,
      ],
    );
  }
}

export async function listDietMarkerCatalog(): Promise<DietMarkerCatalogRow[]> {
  await ensureDietMarkerCatalogSeeded();
  const { rows } = await query<CatalogDbRow>(
    `SELECT code, unit, default_direction, linked_lab_codes, labels, estimate_guidance, sort_order, seeded
     FROM diet_marker_catalog
     WHERE enabled = TRUE
     ORDER BY sort_order ASC, code ASC`,
  );
  return rows.map(rowToCatalog);
}

async function loadCatalogMap(): Promise<Map<string, DietMarkerCatalogRow>> {
  const list = await listDietMarkerCatalog();
  return new Map(list.map((r) => [r.code, r]));
}

export async function markerShortLabelMap(): Promise<Record<string, string>> {
  const list = await listDietMarkerCatalog();
  const out: Record<string, string> = {};
  for (const r of list) {
    out[r.code] = r.labels.en?.short || r.labels.en?.full || r.code;
  }
  return out;
}

type CatalogInsertInput = {
  code: string;
  unit: DietMarkerUnit;
  defaultDirection: DietMarkerDirection;
  linkedLabCodes?: string[];
  labels: DietMarkerLabels;
  estimateGuidance?: string;
};

export async function addDietMarkerCatalogRow(input: CatalogInsertInput): Promise<DietMarkerCatalogRow> {
  await ensureDietMarkerCatalogSeeded();
  const code = String(input.code || '').trim().toUpperCase();
  if (!isDietMarkerCode(code)) {
    throw new ClinicError('Invalid marker code', 400);
  }
  const suffixUnit = unitFromMarkerCode(code);
  if (!suffixUnit || suffixUnit !== input.unit) {
    throw new ClinicError('Code unit suffix must match unit (_G, _MG, or _MCG)', 400);
  }
  const enFull = input.labels?.en?.full?.trim() || input.labels?.en?.short?.trim() || '';
  if (!enFull) {
    throw new ClinicError('English label required', 400);
  }
  const labels: DietMarkerLabels = { ...parseLabels(input.labels) };
  if (!labels.en) labels.en = { short: enFull, full: enFull };
  if (!labels.en.short) labels.en.short = labels.en.full;
  const linked = parseLabCodes(input.linkedLabCodes);
  const guidance = typeof input.estimateGuidance === 'string' ? input.estimateGuidance.trim().slice(0, 2000) : '';
  try {
    const { rows } = await query<CatalogDbRow>(
      `INSERT INTO diet_marker_catalog
         (code, unit, default_direction, linked_lab_codes, labels, estimate_guidance, sort_order, enabled, seeded, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, 500, TRUE, FALSE, NOW())
       RETURNING code, unit, default_direction, linked_lab_codes, labels, estimate_guidance, sort_order, seeded`,
      [
        code,
        input.unit,
        input.defaultDirection,
        JSON.stringify(linked),
        JSON.stringify(labels),
        guidance || null,
      ],
    );
    catalogSeedPromise = null;
    return rowToCatalog(rows[0]);
  } catch (err) {
    const codeName = (err as { code?: string })?.code;
    if (codeName === '23505') {
      throw new ClinicError(`Marker already in catalog: ${code}`, 409);
    }
    throw err;
  }
}

function attachCatalogMeta(marker: TreatmentMarker, meta: DietMarkerCatalogRow): TreatmentMarker {
  return {
    ...marker,
    unit: meta.unit,
    linkedLabCodes: marker.linkedLabCodes?.length ? marker.linkedLabCodes : meta.linkedLabCodes,
    labels: meta.labels,
    ...(meta.estimateGuidance ? { estimateGuidance: meta.estimateGuidance } : {}),
  };
}

/** Overlay GET: attach current catalog labels + AI hint so the phone stays generic. */
export async function hydrateTreatmentMarkers(
  markers: TreatmentMarker[] | null | undefined,
): Promise<TreatmentMarker[] | null> {
  if (!markers?.length) return markers ?? null;
  const map = await loadCatalogMap();
  return markers.map((m) => {
    const meta = map.get(m.marker);
    return meta ? attachCatalogMeta(m, meta) : m;
  });
}

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

type MarkerInput = {
  marker: string;
  direction: 'cap' | 'floor';
  dailyTarget: number;
  note?: string;
  linkedLabCodes?: string[];
};

/**
 * Validate and normalize clinician-submitted markers against the catalog table.
 * Throws ClinicError(400) on bad input.
 */
export async function normalizeTreatmentMarkers(
  input: MarkerInput[],
  setBy: string,
  setAt: string = new Date().toISOString(),
): Promise<TreatmentMarker[]> {
  if (!Array.isArray(input)) {
    throw new ClinicError('markers must be an array', 400);
  }
  if (input.length > MAX_TREATMENT_MARKERS) {
    throw new ClinicError(`At most ${MAX_TREATMENT_MARKERS} markers`, 400);
  }
  const catalog = await loadCatalogMap();
  const seen = new Set<string>();
  const out: TreatmentMarker[] = [];
  for (const row of input) {
    const code = String(row?.marker || '').trim().toUpperCase();
    const meta = catalog.get(code);
    if (!meta) {
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
    const linked =
      Array.isArray(row.linkedLabCodes) && row.linkedLabCodes.length > 0
        ? parseLabCodes(row.linkedLabCodes)
        : meta.linkedLabCodes;
    const note = typeof row.note === 'string' ? row.note.trim().slice(0, 500) : '';
    out.push(
      attachCatalogMeta(
        {
          marker: code,
          direction: row.direction,
          dailyTarget: Math.round(dailyTarget * 10) / 10,
          unit: meta.unit,
          linkedLabCodes: linked,
          ...(note ? { note } : {}),
          setAt,
          setBy,
        },
        meta,
      ),
    );
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
  const markers = await normalizeTreatmentMarkers(input, mentor.id, setAt);
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
