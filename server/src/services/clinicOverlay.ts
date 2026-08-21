import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import {
  assertMentorPatientAccess,
  getMentorOrgId,
  recordPatientAccess,
} from './clinicAccess.js';
import type {
  TreatmentMarker,
  TreatmentMarkersPayload,
  MarkersBackfillRequest,
} from './treatmentMarkers.js';
import { hydrateTreatmentMarkers } from './treatmentMarkers.js';
import type { ClinicMacrosPayload } from './clinicMacros.js';
import { macrosPayloadFromUnknown } from './clinicMacros.js';

export type ClinicChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  sentAt: string;
  fromClinic?: boolean;
};

export type ClinicUserRules = {
  rawText: string;
  summary: string;
  constraints: string[];
  aiContext?: string;
  analyzedAt: string;
  updatedByClinic?: boolean;
};

export type ClinicOverlay = {
  patientId: string;
  rules: ClinicUserRules | null;
  /** Clinic-set treatment markers (be-41). Null when unset. */
  markers: TreatmentMarker[] | null;
  /** Clinic-opt-in past meal marker fill — phone executes when pending. */
  markersBackfill: MarkersBackfillRequest | null;
  /** Clinic live macro order (be-45). Null when unset. */
  macros: ClinicMacrosPayload | null;
  chat: Record<string, ClinicChatMessage[]>;
  updatedAt: string;
  updatedBy: string | null;
};

export type ClinicRulesHistoryEntry = {
  id: string;
  rules: ClinicUserRules;
  savedAt: string;
  mentorId: string | null;
  mentorLabel: string;
  supersededBy: string;
};

const MAX_SERVER_HISTORY = 50;

type OrgOverlayRow = {
  patient_id: string;
  org_id: string;
  rules_json: ClinicUserRules | null;
  markers_json: TreatmentMarkersPayload | null;
  macros_json: ClinicMacrosPayload | null;
  updated_at: Date;
  updated_by: string | null;
};

type ChatRow = {
  patient_id: string;
  clinician_id: string;
  chat_json: Record<string, ClinicChatMessage[]>;
  updated_at: Date;
};

export class ClinicError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ClinicError';
    this.status = status;
  }
}

const MENTOR_TYPES = new Set(['doctor', 'nutritionist', 'coach']);

export function assertMentorType(v: string): asserts v is 'doctor' | 'nutritionist' | 'coach' {
  if (!MENTOR_TYPES.has(v)) {
    throw new ClinicError('Invalid mentor type', 400);
  }
}

async function requireMentorOrg(mentorId: string): Promise<string> {
  const orgId = await getMentorOrgId(mentorId);
  if (!orgId) {
    throw new ClinicError('Clinic organization missing for this account', 500);
  }
  return orgId;
}

function markersFromRow(row: OrgOverlayRow | null | undefined): TreatmentMarker[] | null {
  const payload = row?.markers_json;
  if (!payload || !Array.isArray(payload.markers) || payload.markers.length === 0) return null;
  return payload.markers;
}

function macrosFromRow(row: OrgOverlayRow | null | undefined): ClinicMacrosPayload | null {
  return macrosPayloadFromUnknown(row?.macros_json ?? null);
}

function backfillFromRow(
  row: OrgOverlayRow | null | undefined,
  forPatient: boolean,
): MarkersBackfillRequest | null {
  const b = row?.markers_json?.backfill;
  if (!b || typeof b !== 'object' || !b.id) return null;
  if (forPatient && b.status !== 'pending') return null;
  return b;
}

function mergeOverlay(
  patientId: string,
  rulesRow: OrgOverlayRow | null | undefined,
  chatRow: ChatRow | null | undefined,
  forPatient = false,
): ClinicOverlay {
  const rulesAt = rulesRow?.updated_at?.getTime() ?? 0;
  const chatAt = chatRow?.updated_at?.getTime() ?? 0;
  const latest = Math.max(rulesAt, chatAt);
  return {
    patientId,
    rules: rulesRow?.rules_json ?? null,
    markers: markersFromRow(rulesRow),
    markersBackfill: backfillFromRow(rulesRow, forPatient),
    macros: macrosFromRow(rulesRow),
    chat: chatRow?.chat_json ?? {},
    updatedAt: latest > 0 ? new Date(latest).toISOString() : new Date(0).toISOString(),
    updatedBy: rulesRow?.updated_by ?? null,
  };
}

export async function getOverlayForMentor(mentor: PublicUser, patientId: string): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);

  const { rows: ruleRows } = await query<OrgOverlayRow>(
    `SELECT * FROM clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`,
    [patientId, orgId],
  );
  const { rows: chatRows } = await query<ChatRow>(
    `SELECT * FROM clinic_clinician_chats WHERE patient_id = $1 AND clinician_id = $2`,
    [patientId, mentor.id],
  );

  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'rules.read',
  });
  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'markers.read',
  });
  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'macros.read',
  });
  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'chat.read',
  });

  const overlay = mergeOverlay(patientId, ruleRows[0], chatRows[0], false);
  overlay.markers = await hydrateTreatmentMarkers(overlay.markers);
  return overlay;
}

/**
 * Patient pull: most recently updated org rules win (deferred product decision
 * for multi-clinic acknowledgment). Chat is clinician-private and never sent
 * to the patient app.
 */
export async function getOverlayForPatient(patient: PublicUser): Promise<ClinicOverlay | null> {
  if (patient.role !== 'patient') {
    throw new ClinicError('Requires patient role', 403);
  }
  const { rows } = await query<OrgOverlayRow>(
    `SELECT * FROM clinic_org_overlays
     WHERE patient_id = $1
       AND (rules_json IS NOT NULL OR markers_json IS NOT NULL OR macros_json IS NOT NULL)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [patient.id],
  );
  if (!rows[0]) return null;
  const overlay = mergeOverlay(patient.id, rows[0], null, true);
  overlay.markers = await hydrateTreatmentMarkers(overlay.markers);
  return overlay;
}

async function archiveRulesHistory(
  patientId: string,
  mentorId: string | null,
  orgId: string | null,
  rules: ClinicUserRules,
  supersededBy: 'clinic' | 'patient' = 'clinic',
): Promise<void> {
  await query(
    `INSERT INTO clinic_patient_rules_history (patient_id, mentor_id, org_id, rules_json, superseded_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [patientId, mentorId, orgId, rules, supersededBy],
  );
  await query(
    `DELETE FROM clinic_patient_rules_history
     WHERE id IN (
       SELECT id FROM clinic_patient_rules_history
       WHERE patient_id = $1
       ORDER BY saved_at DESC
       OFFSET $2
     )`,
    [patientId, MAX_SERVER_HISTORY],
  );
}

export async function getRulesHistoryForMentor(
  mentor: PublicUser,
  patientId: string,
): Promise<ClinicRulesHistoryEntry[]> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);
  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'rules.read',
  });

  const { rows } = await query<{
    id: string;
    rules_json: ClinicUserRules;
    saved_at: Date;
    mentor_id: string | null;
    superseded_by: string;
    mentor_email: string | null;
    mentor_display_name: string | null;
  }>(
    `SELECT h.id, h.rules_json, h.saved_at, h.mentor_id, h.superseded_by,
            u.email AS mentor_email, u.display_name AS mentor_display_name
     FROM clinic_patient_rules_history h
     LEFT JOIN users u ON u.id = h.mentor_id
     WHERE h.patient_id = $1 AND (h.org_id = $2 OR h.org_id IS NULL)
     ORDER BY h.saved_at DESC
     LIMIT $3`,
    [patientId, orgId, MAX_SERVER_HISTORY],
  );
  return rows.map((r) => ({
    id: r.id,
    rules: r.rules_json,
    savedAt: r.saved_at.toISOString(),
    mentorId: r.mentor_id,
    mentorLabel: r.mentor_display_name?.trim() || r.mentor_email || 'Clinic',
    supersededBy: r.superseded_by,
  }));
}

export async function saveRulesForPatient(
  mentor: PublicUser,
  patientId: string,
  rules: ClinicUserRules,
): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  const orgId = await requireMentorOrg(mentor.id);

  const { rows: existingRows } = await query<OrgOverlayRow>(
    `SELECT * FROM clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`,
    [patientId, orgId],
  );
  const existingRules = existingRows[0]?.rules_json ?? null;
  if (existingRules?.rawText?.trim() && existingRules.rawText.trim() !== rules.rawText.trim()) {
    await archiveRulesHistory(patientId, mentor.id, orgId, existingRules, 'clinic');
  }
  const { rows } = await query<OrgOverlayRow>(
    `INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_at, updated_by)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (patient_id, org_id) DO UPDATE
       SET rules_json = EXCLUDED.rules_json,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by
     RETURNING *`,
    [patientId, orgId, { ...rules, updatedByClinic: true }, mentor.id],
  );

  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'rules.write',
  });

  const { rows: chatRows } = await query<ChatRow>(
    `SELECT * FROM clinic_clinician_chats WHERE patient_id = $1 AND clinician_id = $2`,
    [patientId, mentor.id],
  );
  return mergeOverlay(patientId, rows[0], chatRows[0]);
}

/**
 * Account web My Rules save: mirror into every linked org overlay so the phone
 * can pull via GET /v1/clinic/overlays (same path as clinic portal edits).
 * Without this, save only patched the sync blob and cleared overlays — clinic
 * Save reached the phone; account Save did not.
 */
export async function publishPatientWebRulesToOverlays(
  patientId: string,
  rules: ClinicUserRules,
  actorId: string,
): Promise<void> {
  if (!rules.rawText?.trim()) return;

  const { rows: orgRows } = await query<{ org_id: string }>(
    `SELECT org_id FROM clinic_org_overlays WHERE patient_id = $1
     UNION
     SELECT org_id FROM account_shares
     WHERE patient_id = $1 AND status = 'approved' AND org_id IS NOT NULL`,
    [patientId],
  );
  if (orgRows.length === 0) return;

  const payload: ClinicUserRules = { ...rules, updatedByClinic: true };

  for (const { org_id: orgId } of orgRows) {
    const { rows: existingRows } = await query<OrgOverlayRow>(
      `SELECT * FROM clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`,
      [patientId, orgId],
    );
    const existingRules = existingRows[0]?.rules_json ?? null;
    if (
      existingRules?.rawText?.trim() &&
      existingRules.rawText.trim() !== rules.rawText.trim()
    ) {
      await archiveRulesHistory(patientId, actorId, orgId, existingRules, 'patient');
    }
    await query(
      `INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_at, updated_by)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (patient_id, org_id) DO UPDATE
         SET rules_json = EXCLUDED.rules_json,
             updated_at = NOW(),
             updated_by = EXCLUDED.updated_by`,
      [patientId, orgId, payload, actorId],
    );
  }
}

/**
 * When a patient sync blob carries newer My Rules than a clinic overlay,
 * clear that org's overlay rules (archive first) so Refresh / portal show the
 * phone text. Clinician chats are left untouched.
 */
export async function reconcileOverlayRulesFromPatientSnapshot(
  patientId: string,
  patientRules: ClinicUserRules | null | undefined,
): Promise<boolean> {
  if (!patientRules?.rawText?.trim() || !patientRules.analyzedAt) return false;
  const patientAt = Date.parse(patientRules.analyzedAt);
  if (!Number.isFinite(patientAt)) return false;

  const { rows } = await query<OrgOverlayRow>(
    `SELECT * FROM clinic_org_overlays WHERE patient_id = $1 AND rules_json IS NOT NULL`,
    [patientId],
  );
  let cleared = false;
  for (const row of rows) {
    const overlayRules = row.rules_json;
    if (!overlayRules?.rawText?.trim()) continue;

    const overlayRaw = overlayRules.rawText.trim();
    const patientRaw = patientRules.rawText.trim();
    if (overlayRaw === patientRaw) continue;

    const overlayAt = Date.parse(overlayRules.analyzedAt || row.updated_at?.toISOString() || '');
    if (Number.isFinite(overlayAt) && patientAt <= overlayAt) continue;

    await archiveRulesHistory(patientId, row.updated_by, row.org_id, overlayRules, 'patient');
    await query(
      `UPDATE clinic_org_overlays
       SET rules_json = NULL, updated_at = NOW(), updated_by = NULL
       WHERE patient_id = $1 AND org_id = $2`,
      [patientId, row.org_id],
    );
    cleared = true;
  }
  return cleared;
}

export async function appendChatMessages(
  mentor: PublicUser,
  patientId: string,
  mentorType: string,
  userMsg: ClinicChatMessage,
  assistantMsg: ClinicChatMessage,
): Promise<ClinicChatMessage[]> {
  await assertMentorPatientAccess(mentor, patientId, ClinicError);
  assertMentorType(mentorType);
  const orgId = await requireMentorOrg(mentor.id);

  const { rows: existingChat } = await query<ChatRow>(
    `SELECT * FROM clinic_clinician_chats WHERE patient_id = $1 AND clinician_id = $2`,
    [patientId, mentor.id],
  );
  const prev = existingChat[0]?.chat_json ?? {};
  const thread = [...(prev[mentorType] ?? []), userMsg, assistantMsg];
  const chatJson = { ...prev, [mentorType]: thread };

  await query(
    `INSERT INTO clinic_clinician_chats (patient_id, clinician_id, chat_json, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (patient_id, clinician_id) DO UPDATE
       SET chat_json = EXCLUDED.chat_json,
           updated_at = NOW()`,
    [patientId, mentor.id, chatJson],
  );

  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'chat.write',
  });

  return thread;
}
