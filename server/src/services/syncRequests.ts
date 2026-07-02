import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import { hasApprovedShare } from './shares.js';
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

async function assertMentorPatientAccess(mentor: PublicUser, patientId: string): Promise<void> {
  if (mentor.role !== 'mentor') {
    throw new SyncRequestError('Requires mentor role', 403);
  }
  const ok = await hasApprovedShare(patientId, mentor.id);
  if (!ok) {
    throw new SyncRequestError('No approved share with this patient', 403);
  }
}

export async function requestPatientSyncUpdate(mentor: PublicUser, patientId: string): Promise<SyncUpdateRequest> {
  await assertMentorPatientAccess(mentor, patientId);

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

  return toPublicRequest(rows[0]!);
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
  await assertMentorPatientAccess(mentor, patientId);

  const { rows } = await query<{ requested_at: Date }>(
    `SELECT requested_at FROM sync_update_requests
     WHERE patient_id = $1 AND mentor_id = $2`,
    [patientId, mentor.id],
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
