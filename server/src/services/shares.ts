import { query } from '../db/pool.js';
import type { PublicUser, UserRole } from './jwt.js';
import { findUserByEmail } from './users.js';
import { removeSponsorshipForMentor } from './sponsorships.js';
import { purgeClinicDataIfNoConsumers, purgeClinicLinkData } from './consent.js';
import { sendClinicInviteEmail } from './email.js';
import { ensureMentorOrg, hasApprovedShare } from './clinicAccess.js';

export { hasApprovedShare };

export type ShareStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type ShareInitiator = 'patient' | 'mentor';

export type PublicShare = {
  id: string;
  patientId: string | null;
  patientEmail: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  mentorId: string;
  mentorEmail: string;
  mentorDisplayName: string | null;
  status: ShareStatus;
  initiatedBy: ShareInitiator;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  /** Latest sync_blobs.created_at for this patient, if any. */
  lastSyncAt: string | null;
};

type ShareRow = {
  id: string;
  patient_id: string | null;
  patient_email: string;
  mentor_id: string;
  status: ShareStatus;
  initiated_by: ShareInitiator;
  created_at: Date;
  updated_at: Date;
  approved_at: Date | null;
  mentor_email: string;
  mentor_display_name: string | null;
  patient_first_name: string | null;
  patient_last_name: string | null;
  last_sync_at: Date | null;
};

export class ShareError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ShareError';
    this.status = status;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicShare(row: ShareRow): PublicShare {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientEmail: row.patient_email,
    patientFirstName: row.patient_first_name,
    patientLastName: row.patient_last_name,
    mentorId: row.mentor_id,
    mentorEmail: row.mentor_email,
    mentorDisplayName: row.mentor_display_name,
    status: row.status,
    initiatedBy: row.initiated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    approvedAt: row.approved_at?.toISOString() ?? null,
    lastSyncAt: row.last_sync_at?.toISOString() ?? null,
  };
}

const shareSelect = `
  SELECT s.*,
         m.email AS mentor_email,
         m.display_name AS mentor_display_name,
         p.first_name AS patient_first_name,
         p.last_name AS patient_last_name,
         snap.created_at AS last_sync_at
  FROM account_shares s
  JOIN users m ON m.id = s.mentor_id
  LEFT JOIN users p ON p.id = s.patient_id
  LEFT JOIN LATERAL (
    SELECT b.created_at
    FROM sync_blobs b
    WHERE b.patient_id = s.patient_id
    ORDER BY b.version DESC
    LIMIT 1
  ) snap ON s.patient_id IS NOT NULL
`;

async function getShareRow(id: string): Promise<ShareRow | null> {
  const { rows } = await query<ShareRow>(`${shareSelect} WHERE s.id = $1`, [id]);
  return rows[0] ?? null;
}

function assertRole(user: PublicUser, role: UserRole) {
  if (user.role !== role) {
    throw new ShareError(`Requires ${role} role`, 403);
  }
}

function isShareParty(user: PublicUser, row: ShareRow): boolean {
  if (user.role === 'mentor' && row.mentor_id === user.id) return true;
  if (user.role === 'patient') {
    if (row.patient_id === user.id) return true;
    if (!row.patient_id && normalizeEmail(row.patient_email) === normalizeEmail(user.email)) {
      return true;
    }
  }
  return false;
}

function isCounterparty(user: PublicUser, row: ShareRow): boolean {
  if (row.initiated_by === 'mentor') {
    return user.role === 'patient' && isShareParty(user, row);
  }
  return user.role === 'mentor' && row.mentor_id === user.id;
}

async function findDuplicatePending(mentorId: string, patientEmail: string): Promise<boolean> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM account_shares
     WHERE mentor_id = $1 AND patient_email = $2 AND status = 'pending'
     LIMIT 1`,
    [mentorId, patientEmail],
  );
  return rows.length > 0;
}

async function findApprovedShare(patientId: string, mentorId: string): Promise<PublicShare | null> {
  const { rows } = await query<ShareRow>(
    `${shareSelect} WHERE s.patient_id = $1 AND s.mentor_id = $2 AND s.status = 'approved' LIMIT 1`,
    [patientId, mentorId],
  );
  return rows[0] ? toPublicShare(rows[0]) : null;
}

export async function attachPendingShares(patientEmail: string, patientId: string): Promise<number> {
  const { rowCount } = await query(
    `UPDATE account_shares
     SET patient_id = $1, updated_at = NOW()
     WHERE patient_email = $2 AND patient_id IS NULL AND status = 'pending'`,
    [patientId, normalizeEmail(patientEmail)],
  );
  return rowCount ?? 0;
}

export async function invitePatient(
  mentor: PublicUser,
  patientEmailRaw: string,
): Promise<{ share: PublicShare; emailSent: boolean }> {
  assertRole(mentor, 'mentor');
  const patientEmail = normalizeEmail(patientEmailRaw);
  if (normalizeEmail(mentor.email) === patientEmail) {
    throw new ShareError('Cannot link to yourself', 400);
  }

  const patient = await findUserByEmail(patientEmail);
  if (patient?.role === 'mentor') {
    throw new ShareError('Target email is a mentor account', 400);
  }

  if (await findDuplicatePending(mentor.id, patientEmail)) {
    throw new ShareError('A pending invite already exists for this patient', 409);
  }

  const orgId = await ensureMentorOrg(mentor.id, mentor.displayName, mentor.email);

  const { rows } = await query<{ id: string }>(
    `INSERT INTO account_shares (
       patient_id, patient_email, mentor_id, org_id, status, initiated_by
     ) VALUES ($1, $2, $3, $4, 'pending', 'mentor')
     RETURNING id`,
    [patient?.id ?? null, patientEmail, mentor.id, orgId],
  );

  const inserted = await getShareRow(rows[0].id);
  if (!inserted) throw new ShareError('Failed to create share', 500);
  const share = toPublicShare(inserted);

  // Invite is already on the server. Email is a courtesy — SMTP must not undo it,
  // or a brief mail outage would leave the clinic thinking the invite failed while
  // a pending row (and orphaned email address) already exists.
  let emailSent = false;
  try {
    await sendClinicInviteEmail(patientEmail, {
      clinicLabel: mentor.displayName?.trim() || mentor.email,
      clinicEmail: mentor.email,
    });
    emailSent = true;
  } catch (err) {
    console.error('[shares] invite email failed after insert', {
      shareId: share.id,
      patientEmail,
      err,
    });
  }

  return { share, emailSent };
}

export async function requestMentor(patient: PublicUser, mentorEmailRaw: string): Promise<PublicShare> {
  assertRole(patient, 'patient');
  const mentorEmail = normalizeEmail(mentorEmailRaw);
  if (normalizeEmail(patient.email) === mentorEmail) {
    throw new ShareError('Cannot link to yourself', 400);
  }

  const mentor = await findUserByEmail(mentorEmail);
  if (!mentor || mentor.role !== 'mentor') {
    throw new ShareError('No clinic account found for that email', 404);
  }

  const existing = await findApprovedShare(patient.id, mentor.id);
  if (existing) return existing;

  if (await findDuplicatePending(mentor.id, normalizeEmail(patient.email))) {
    throw new ShareError('A pending request already exists for this clinic', 409);
  }

  const orgId = await ensureMentorOrg(mentor.id, mentor.displayName, mentor.email);

  const { rows } = await query<{ id: string }>(
    `INSERT INTO account_shares (
       patient_id, patient_email, mentor_id, org_id, status, initiated_by
     ) VALUES ($1, $2, $3, $4, 'pending', 'patient')
     RETURNING id`,
    [patient.id, normalizeEmail(patient.email), mentor.id, orgId],
  );

  const inserted = await getShareRow(rows[0].id);
  if (!inserted) throw new ShareError('Failed to create share', 500);
  return toPublicShare(inserted);
}

export async function listShares(
  user: PublicUser,
  status?: ShareStatus,
): Promise<PublicShare[]> {
  let sql = `${shareSelect} WHERE `;
  const params: unknown[] = [];

  if (user.role === 'mentor') {
    sql += `s.mentor_id = $1`;
    params.push(user.id);
  } else {
    sql += `(s.patient_id = $1 OR (s.patient_id IS NULL AND s.patient_email = $2))`;
    params.push(user.id, normalizeEmail(user.email));
  }

  if (status) {
    params.push(status);
    sql += ` AND s.status = $${params.length}`;
  }

  sql += ` ORDER BY s.updated_at DESC`;

  const { rows } = await query<ShareRow>(sql, params);
  return rows.map(toPublicShare);
}

export async function listPendingForMe(user: PublicUser): Promise<PublicShare[]> {
  if (user.role === 'patient') {
    const { rows } = await query<ShareRow>(
      `${shareSelect}
       WHERE s.status = 'pending' AND s.initiated_by = 'mentor'
         AND (s.patient_id = $1 OR (s.patient_id IS NULL AND s.patient_email = $2))
       ORDER BY s.created_at DESC`,
      [user.id, normalizeEmail(user.email)],
    );
    return rows.map(toPublicShare);
  }

  const { rows } = await query<ShareRow>(
    `${shareSelect}
     WHERE s.status = 'pending' AND s.initiated_by = 'patient' AND s.mentor_id = $1
     ORDER BY s.created_at DESC`,
    [user.id],
  );
  return rows.map(toPublicShare);
}

export async function approveShare(user: PublicUser, shareId: string): Promise<PublicShare> {
  const row = await getShareRow(shareId);
  if (!row || !isShareParty(user, row)) {
    throw new ShareError('Share not found', 404);
  }
  if (row.status !== 'pending') {
    throw new ShareError('Share is not pending', 422);
  }
  if (!isCounterparty(user, row)) {
    throw new ShareError('Only the counterparty can approve', 403);
  }

  let patientId = row.patient_id;
  if (!patientId && user.role === 'patient') {
    patientId = user.id;
    await query(
      `UPDATE account_shares SET patient_id = $1, updated_at = NOW() WHERE id = $2`,
      [patientId, shareId],
    );
  }
  if (!patientId) {
    throw new ShareError('Patient must register before approval', 422);
  }

  await query(
    `UPDATE account_shares
     SET status = 'approved', approved_at = NOW(), updated_at = NOW(), patient_id = COALESCE(patient_id, $2)
     WHERE id = $1`,
    [shareId, patientId],
  );

  const updated = await getShareRow(shareId);
  if (!updated) throw new ShareError('Share not found', 404);
  return toPublicShare(updated);
}

export async function rejectShare(user: PublicUser, shareId: string): Promise<PublicShare> {
  const row = await getShareRow(shareId);
  if (!row || !isShareParty(user, row)) {
    throw new ShareError('Share not found', 404);
  }
  if (row.status !== 'pending') {
    throw new ShareError('Share is not pending', 422);
  }
  if (!isCounterparty(user, row)) {
    throw new ShareError('Only the counterparty can reject', 403);
  }

  await query(
    `UPDATE account_shares SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
    [shareId],
  );

  const updated = await getShareRow(shareId);
  if (!updated) throw new ShareError('Share not found', 404);
  return toPublicShare(updated);
}

/** Initiator withdraws a pending invite/request (either party). */
export async function cancelShare(user: PublicUser, shareId: string): Promise<PublicShare> {
  const row = await getShareRow(shareId);
  if (!row || !isShareParty(user, row)) {
    throw new ShareError('Share not found', 404);
  }
  if (row.status !== 'pending') {
    throw new ShareError('Share is not pending', 422);
  }
  if (isCounterparty(user, row)) {
    throw new ShareError('Use reject instead of cancel', 403);
  }

  await query(
    `UPDATE account_shares SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
    [shareId],
  );

  const updated = await getShareRow(shareId);
  if (!updated) throw new ShareError('Share not found', 404);
  return toPublicShare(updated);
}

export async function revokeShare(user: PublicUser, shareId: string): Promise<PublicShare> {
  const row = await getShareRow(shareId);
  if (!row || !isShareParty(user, row)) {
    throw new ShareError('Share not found', 404);
  }
  if (row.status !== 'approved') {
    throw new ShareError('Only approved shares can be revoked', 422);
  }

  await query(
    `UPDATE account_shares SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [shareId],
  );

  if (row.patient_id) {
    await removeSponsorshipForMentor(row.patient_id, row.mentor_id);
    // Runs after the status update above, so the revoked link no longer counts
    // as a consumer. privacy.html promises this deletion — see consent.ts.
    await purgeClinicLinkData(row.patient_id, row.mentor_id);
    await purgeClinicDataIfNoConsumers(row.patient_id);
  }

  const updated = await getShareRow(shareId);
  if (!updated) throw new ShareError('Share not found', 404);
  return toPublicShare(updated);
}
