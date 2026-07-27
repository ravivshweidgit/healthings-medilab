import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import {
  assertMentorPatientAccess,
  getMentorOrgId,
  recordPatientAccess,
} from './clinicAccess.js';
import type { PublicSyncBlob, SyncSummary } from './sync.js';

export type SyncUpdateRequest = {
  id: string;
  patientId: string;
  mentorId: string;
  mentorEmail: string;
  mentorDisplayName: string | null;
  requestedAt: string;
};

export type PatientSyncStatus = {
  latestBlob: PublicSyncBlob | null;
  updateRequest: { requestedAt: string } | null;
  waitingOnPatient: boolean;
};

type RequestRow = {
  id: string;
  patient_id: string;
  mentor_id: string;
  requested_at: Date;
  mentor_email: string;
  mentor_display_name: string | null;
};

export class SyncRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SyncRequestError';
    this.status = status;
  }
}

function toPublicRequest(row: RequestRow): SyncUpdateRequest {
  return {
    id: row.id,
    patientId: row.patient_id,
    mentorId: row.mentor_id,
    mentorEmail: row.mentor_email,
    mentorDisplayName: row.mentor_display_name,
    requestedAt: row.requested_at.toISOString(),
  };
}

export async function requestPatientSyncUpdate(mentor: PublicUser, patientId: string): Promise<SyncUpdateRequest> {
  await assertMentorPatientAccess(mentor, patientId, SyncRequestError);

  const { rows } = await query<RequestRow>(
    `WITH upsert AS (
       INSERT INTO sync_update_requests (patient_id, mentor_id)
       VALUES ($1, $2)
       ON CONFLICT (patient_id, mentor_id)
       DO UPDATE SET requested_at = NOW()
       RETURNING id, patient_id, mentor_id, requested_at
     )
     SELECT u.id, u.patient_id, u.mentor_id, u.requested_at,
            m.email AS mentor_email, m.display_name AS mentor_display_name
     FROM upsert u
     JOIN users m ON m.id = u.mentor_id`,
    [patientId, mentor.id],
  );

  const orgId = await getMentorOrgId(mentor.id);
  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'refresh.request',
  });

  return toPublicRequest(rows[0]!);
}

/**
 * Clinic mentor or patient self — same table/row shape.
 * Self-request uses mentor_id = patient_id (allowed; UNIQUE is per pair).
 */
export async function requestSyncUpdate(
  actor: PublicUser,
  patientId: string,
): Promise<SyncUpdateRequest> {
  if (actor.role === 'patient') {
    if (actor.id !== patientId) {
      throw new SyncRequestError('Patients can only refresh their own snapshot', 403);
    }
    const { rows: flag } = await query<{ on: boolean }>(
      `SELECT web_view_enabled AS on FROM users WHERE id = $1`,
      [actor.id],
    );
    if (flag[0]?.on !== true) {
      throw new SyncRequestError('Turn on your web view to refresh your snapshot', 403);
    }

    const { rows } = await query<RequestRow>(
      `WITH upsert AS (
         INSERT INTO sync_update_requests (patient_id, mentor_id)
         VALUES ($1, $2)
         ON CONFLICT (patient_id, mentor_id)
         DO UPDATE SET requested_at = NOW()
         RETURNING id, patient_id, mentor_id, requested_at
       )
       SELECT u.id, u.patient_id, u.mentor_id, u.requested_at,
              m.email AS mentor_email, m.display_name AS mentor_display_name
       FROM upsert u
       JOIN users m ON m.id = u.mentor_id`,
      [patientId, patientId],
    );
    return toPublicRequest(rows[0]!);
  }

  return requestPatientSyncUpdate(actor, patientId);
}

export async function listSyncUpdateRequestsForPatient(patient: PublicUser): Promise<SyncUpdateRequest[]> {
  if (patient.role !== 'patient') {
    throw new SyncRequestError('Only patients can list sync requests', 403);
  }

  const { rows } = await query<RequestRow>(
    `SELECT r.id, r.patient_id, r.mentor_id, r.requested_at,
            m.email AS mentor_email, m.display_name AS mentor_display_name
     FROM sync_update_requests r
     JOIN users m ON m.id = r.mentor_id
     WHERE r.patient_id = $1
     ORDER BY r.requested_at DESC`,
    [patient.id],
  );

  return rows.map(toPublicRequest);
}

export async function clearSyncUpdateRequestsForPatient(patientId: string): Promise<void> {
  await query(`DELETE FROM sync_update_requests WHERE patient_id = $1`, [patientId]);
}

function isWaitingOnPatient(
  latestBlob: PublicSyncBlob | null,
  requestedAt: string | null,
): boolean {
  if (!requestedAt) return false;
  if (!latestBlob) return true;
  return Date.parse(latestBlob.createdAt) < Date.parse(requestedAt);
}

export async function getPatientSyncStatusForMentor(
  mentor: PublicUser,
  patientId: string,
): Promise<PatientSyncStatus> {
  await assertMentorPatientAccess(mentor, patientId, SyncRequestError);
  return loadSyncStatus(patientId, mentor.id);
}

/** Clinic mentor or patient self — same waitingOnPatient semantics. */
export async function getSyncStatusForActor(
  actor: PublicUser,
  patientId: string,
): Promise<PatientSyncStatus> {
  if (actor.role === 'patient') {
    if (actor.id !== patientId) {
      throw new SyncRequestError('Patients can only read their own sync status', 403);
    }
    return loadSyncStatus(patientId, patientId);
  }
  return getPatientSyncStatusForMentor(actor, patientId);
}

async function loadSyncStatus(patientId: string, requesterId: string): Promise<PatientSyncStatus> {
  const { rows } = await query<{ requested_at: Date }>(
    `SELECT requested_at FROM sync_update_requests
     WHERE patient_id = $1 AND mentor_id = $2`,
    [patientId, requesterId],
  );

  const { rows: fullRows } = await query<{
    id: string;
    patient_id: string;
    version: number;
    byte_size: number;
    payload_hash: string;
    summary: SyncSummary;
    created_at: Date;
  }>(
    `SELECT id, patient_id, version, byte_size, payload_hash, summary, created_at
     FROM sync_blobs WHERE patient_id = $1 ORDER BY version DESC LIMIT 1`,
    [patientId],
  );

  const full = fullRows[0];
  const latestBlob: PublicSyncBlob | null = full
    ? {
        id: full.id,
        patientId: full.patient_id,
        version: full.version,
        byteSize: full.byte_size,
        payloadHash: full.payload_hash,
        summary: full.summary,
        createdAt: full.created_at.toISOString(),
      }
    : null;

  const requestRow = rows[0];
  const requestedAt = requestRow?.requested_at.toISOString() ?? null;

  return {
    latestBlob,
    updateRequest: requestedAt ? { requestedAt } : null,
    waitingOnPatient: isWaitingOnPatient(latestBlob, requestedAt),
  };
}
