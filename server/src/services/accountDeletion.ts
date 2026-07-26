/**
 * Permanent account deletion.
 *
 * Two reasons this is not `DELETE FROM users` and done:
 *
 * 1. **Two places are keyed by email, not by user id.** `otp_requests` has no
 *    foreign key at all, and `account_shares.patient_id` is nullable while
 *    `patient_email` is NOT NULL — a clinic can invite someone before they ever
 *    sign up. Neither is reachable by cascade, so both would survive: the code
 *    hashes and the email address, and a live invitation a clinic could still
 *    approve for an account that no longer exists.
 *
 * 2. **A departing mentor can strand their patients' data.** The cascade removes
 *    the share row but cannot run the be-17 purge, so every patient whose last
 *    clinic link was this mentor would keep an overlay and a snapshot on the
 *    server with nothing left to read them. `revokeShare` gets this right; a
 *    cascade cannot, because the database does not know the rule.
 */

import { query, withTransaction } from '../db/pool.js';
import {
  purgeClinicDataIfNoConsumers,
  purgeClinicOrgWorkspaceIfOrphaned,
} from './consent.js';
import type { PublicUser, UserRole } from './jwt.js';
import { verifyOtpAndGetEmail } from './otp.js';

export type DeletionOutcome = {
  email: string;
  role: UserRole;
  /** Patients whose clinic workspace or snapshot was purged with this mentor's departure. */
  patientsPurged: number;
  /** Pending invitations addressed to this email that no cascade would have reached. */
  orphanedInvitesRemoved: number;
  /** Sign-in / deletion codes for this email, in a table with no foreign key. */
  otpRequestsRemoved: number;
};

/**
 * Deletes the account and everything the server holds for it.
 *
 * The caller must have proven possession of the account's email in this request
 * — see `deleteAccountWithCode`. Nothing here re-checks that, so do not call it
 * from a route directly.
 */
async function deleteAccountUnchecked(user: PublicUser): Promise<DeletionOutcome> {
  const { patientsToReview, orphanedInvitesRemoved, otpRequestsRemoved } = await withTransaction(
    async (q) => {
      // Read before the delete: once the user row is gone the shares have
      // cascaded and there is no way left to learn who was affected.
      const { rows: affected } = await q<{ patient_id: string; org_id: string | null }>(
        `SELECT DISTINCT patient_id, org_id FROM account_shares
         WHERE mentor_id = $1 AND status = 'approved' AND patient_id IS NOT NULL`,
        [user.id],
      );

      // Same reason: org_members cascades with the user row, so the orgs this
      // person belonged to have to be identified before the delete.
      const { rows: orgs } = await q<{ org_id: string }>(
        `SELECT org_id FROM org_members WHERE user_id = $1`,
        [user.id],
      );

      // Cascades cover the tables keyed by user id.
      await q(`DELETE FROM users WHERE id = $1`, [user.id]);

      // `organizations` has no FK to users, so nothing above reaches it — and a
      // one-person org created at signup is named from `display_name || email`,
      // which for an OTP signup is the email. Blanking the name rather than
      // deleting the row follows the same choice as `ai_usage_events.sponsor_id`
      // and `wallet_ledger.payer_user_id`: drop the identity, keep the skeleton,
      // so `patient_access_log.org_id` still resolves and no overlay cascades
      // out from under `purgeClinicOrgWorkspaceIfOrphaned` below.
      for (const { org_id } of orgs) {
        await q(
          `UPDATE organizations SET name = NULL
           WHERE id = $1
             AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = $1)`,
          [org_id],
        );
      }

      // Deliberately not relying on verifyOtpAndGetEmail having cleared these.
      // That function deletes by email as a side effect of a successful verify;
      // making deletion complete only because of an unrelated function's cleanup
      // is the kind of coupling that breaks silently.
      const otp = await q(`DELETE FROM otp_requests WHERE email = $1`, [user.email]);

      // patient_id IS NULL means the invitation predates the account, so the
      // cascade never touched it. Not conditioned on role: an email leaving the
      // system should take invitations addressed to it either way.
      const invites = await q(
        `DELETE FROM account_shares WHERE patient_email = $1 AND patient_id IS NULL`,
        [user.email],
      );

      return {
        patientsToReview: affected.map((r) => ({
          patientId: r.patient_id,
          orgId: r.org_id,
        })),
        orphanedInvitesRemoved: invites.rowCount ?? 0,
        otpRequestsRemoved: otp.rowCount ?? 0,
      };
    },
  );

  // After the commit, so each purge reads the state that now applies. Safe
  // outside the transaction because the purge is idempotent by design and
  // derives everything from current state, not from what the caller just did —
  // if one fails, any later revoke or toggle re-runs it.
  let patientsPurged = 0;
  for (const { patientId, orgId } of patientsToReview) {
    try {
      if (orgId) {
        await purgeClinicOrgWorkspaceIfOrphaned(patientId, orgId);
      }
      const outcome = await purgeClinicDataIfNoConsumers(patientId);
      if (outcome.clinicWorkspace || outcome.snapshot) patientsPurged++;
    } catch (err) {
      console.error('[account deletion] purge failed for patient', { patientId, err });
    }
  }

  return {
    email: user.email,
    role: user.role,
    patientsPurged,
    orphanedInvitesRemoved,
    otpRequestsRemoved,
  };
}

/**
 * Deletes the account after re-proving control of its email address.
 *
 * A valid session is not enough. Deletion is irreversible and there is no undo,
 * so it asks for a fresh code the same way signing in does — a borrowed or
 * left-open session cannot destroy someone's data, and the code email doubles as
 * the warning to the real owner that someone tried.
 */
export async function deleteAccountWithCode(
  user: PublicUser,
  code: string,
): Promise<DeletionOutcome> {
  // Throws OtpInvalidError on a wrong, expired or over-attempted code, and
  // consumes it on success so it cannot be replayed.
  await verifyOtpAndGetEmail(user.email, code);
  return deleteAccountUnchecked(user);
}

/**
 * Whether any row anywhere still references this email or id. Exists for the
 * verification harness and for support questions after a deletion — not routed.
 */
export async function findResidue(email: string, userId: string): Promise<string[]> {
  const checks: Array<[string, string, unknown[]]> = [
    ['users', `SELECT 1 FROM users WHERE id = $1 OR email = $2`, [userId, email]],
    ['otp_requests', `SELECT 1 FROM otp_requests WHERE email = $1`, [email]],
    [
      'account_shares',
      `SELECT 1 FROM account_shares
       WHERE patient_id = $1 OR mentor_id = $1 OR patient_email = $2`,
      [userId, email],
    ],
    ['refresh_tokens', `SELECT 1 FROM refresh_tokens WHERE user_id = $1`, [userId]],
    ['sync_blobs', `SELECT 1 FROM sync_blobs WHERE patient_id = $1`, [userId]],
    ['user_cloud_backups', `SELECT 1 FROM user_cloud_backups WHERE user_id = $1`, [userId]],
    ['wallets', `SELECT 1 FROM wallets WHERE user_id = $1`, [userId]],
    ['payment_methods', `SELECT 1 FROM payment_methods WHERE user_id = $1`, [userId]],
    [
      'clinic_org_overlays',
      `SELECT 1 FROM clinic_org_overlays WHERE patient_id = $1`,
      [userId],
    ],
    [
      'clinic_clinician_chats',
      `SELECT 1 FROM clinic_clinician_chats WHERE patient_id = $1 OR clinician_id = $1`,
      [userId],
    ],
    ['org_members', `SELECT 1 FROM org_members WHERE user_id = $1`, [userId]],
    // Keyed by name, not by id: a one-person org is named from the mentor's
    // display name or, for an OTP signup, their email address.
    ['organizations', `SELECT 1 FROM organizations WHERE name = $1`, [email]],
    // patient_access_log deliberately excluded — audit rows survive deletion (be-23).
  ];

  const found: string[] = [];
  for (const [table, sql, params] of checks) {
    const { rows } = await query(sql, params);
    if (rows.length) found.push(table);
  }
  return found;
}
