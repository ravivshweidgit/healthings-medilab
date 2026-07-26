/**
 * Clinic access resolution and append-only access audit (be-23).
 *
 * Consent is to the clinic (org): a clinician may act when they belong to an
 * org that holds an approved share for the patient. Logging happens at the
 * sites that hand over data or accept a write — never inside the permission
 * probe itself, or list-building would drown the real reads.
 */
import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';

export type AccessAction =
  | 'snapshot.read'
  | 'rules.read'
  | 'rules.write'
  | 'chat.read'
  | 'chat.write'
  | 'refresh.request';

type StatusError = new (message: string, status: number) => Error;

/**
 * One helper for every clinician path. Callers pass their own error class so
 * ClinicError / SyncError / SyncRequestError stay distinct at the HTTP edge.
 */
export async function assertMentorPatientAccess(
  mentor: PublicUser,
  patientId: string,
  ErrorType: StatusError,
): Promise<void> {
  if (mentor.role !== 'mentor') {
    throw new ErrorType('Requires mentor role', 403);
  }
  const ok = await hasApprovedShare(patientId, mentor.id);
  if (!ok) {
    throw new ErrorType('No approved share with this patient', 403);
  }
}

/** Org-aware: actor belongs to an org with an approved share for this patient. */
export async function hasApprovedShare(patientId: string, mentorId: string): Promise<boolean> {
  const { rows } = await query<{ id: string }>(
    `SELECT s.id FROM account_shares s
     INNER JOIN org_members m ON m.org_id = s.org_id AND m.user_id = $2
     WHERE s.patient_id = $1 AND s.status = 'approved' AND s.org_id IS NOT NULL
     LIMIT 1`,
    [patientId, mentorId],
  );
  return rows.length > 0;
}

export async function getMentorOrgId(mentorId: string): Promise<string | null> {
  const { rows } = await query<{ org_id: string }>(
    `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
    [mentorId],
  );
  return rows[0]?.org_id ?? null;
}

/**
 * Ensures a mentor has a one-person org. Called when creating mentors and when
 * writing shares so org_id is never null on new rows.
 */
export async function ensureMentorOrg(
  mentorId: string,
  displayName: string | null,
  email: string,
): Promise<string> {
  const existing = await getMentorOrgId(mentorId);
  if (existing) return existing;

  const name = (displayName && displayName.trim()) || email;
  const { rows } = await query<{ id: string }>(
    `WITH created AS (
       INSERT INTO organizations (name) VALUES ($1) RETURNING id
     )
     INSERT INTO org_members (org_id, user_id, role)
     SELECT id, $2, 'owner' FROM created
     RETURNING org_id AS id`,
    [name, mentorId],
  );
  return rows[0]!.id;
}

/** Append-only. There is no update or delete path for this table. */
export async function recordPatientAccess(input: {
  patientId: string;
  actorUserId: string | null;
  orgId: string | null;
  action: AccessAction;
}): Promise<void> {
  await query(
    `INSERT INTO patient_access_log (patient_id, actor_user_id, org_id, action)
     VALUES ($1, $2, $3, $4)`,
    [input.patientId, input.actorUserId, input.orgId, input.action],
  );
}
