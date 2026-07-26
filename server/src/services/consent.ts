/**
 * Snapshot and clinic-data retention.
 *
 * `website/privacy.html` promises that revoking a clinic link "immediately purges"
 * the shared copy. These functions are what make that true, so they run on every
 * path that can remove a snapshot's last consumer.
 *
 * This module imports only the pool. `shares.ts` sits below `sync.ts` and
 * `clinicOverlay.ts` in the import graph, so reaching into either from
 * `revokeShare` would invert the layering and create a cycle. Keeping the purge
 * as plain SQL in a leaf module lets it live inside `revokeShare`, where it
 * cannot be forgotten by a future caller.
 *
 * be-23: clinic workspace is scoped per org. Revoking one clinic deletes that
 * org's overlay and its clinicians' chats for the patient, and leaves every other
 * clinic's workspace alone. Rules history is kept — it holds versions the patient
 * superseded too, and its `org_id` already hides it from other clinics. The
 * snapshot still dies only when no approved share (any org) and no patient web
 * view remain; history dies with the last link.
 */
import { query } from '../db/pool.js';

async function countApprovedShares(patientId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND status = 'approved'`,
    [patientId],
  );
  return parseInt(rows[0]?.n ?? '0', 10);
}

async function countApprovedSharesForOrg(patientId: string, orgId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND org_id = $2 AND status = 'approved'`,
    [patientId, orgId],
  );
  return parseInt(rows[0]?.n ?? '0', 10);
}

async function webViewEnabled(patientId: string): Promise<boolean> {
  const { rows } = await query<{ on: boolean }>(
    `SELECT web_view_enabled AS on FROM users WHERE id = $1`,
    [patientId],
  );
  return rows[0]?.on === true;
}

/**
 * Anything that may still read the snapshot: an approved clinic, or the patient
 * reading their own data at /account/. The upload gate and the purge must agree
 * on this definition or one of them is wrong.
 */
export async function hasAnySnapshotConsumer(patientId: string): Promise<boolean> {
  if (!patientId) return false;
  if (await webViewEnabled(patientId)) return true;
  return (await countApprovedShares(patientId)) > 0;
}

/**
 * Per-link cleanup. Drops this clinic's pending refresh request, and — when the
 * clinic org has no remaining approved share with the patient — deletes that
 * org's workspace only.
 */
export async function purgeClinicLinkData(patientId: string, mentorId: string): Promise<void> {
  if (!patientId || !mentorId) return;
  await query(`DELETE FROM sync_update_requests WHERE patient_id = $1 AND mentor_id = $2`, [
    patientId,
    mentorId,
  ]);

  const { rows: orgRows } = await query<{ org_id: string }>(
    `SELECT org_id FROM org_members WHERE user_id = $1 LIMIT 1`,
    [mentorId],
  );
  const orgId = orgRows[0]?.org_id;
  if (!orgId) return;

  await purgeClinicOrgWorkspaceIfOrphaned(patientId, orgId);
}

/**
 * Deletes one clinic's workspace for a patient when that org no longer holds an
 * approved share. Safe while other clinics remain linked.
 *
 * Scope is the org's overlay and its clinicians' private chats. Rules history
 * survives — see the note inside.
 */
export async function purgeClinicOrgWorkspaceIfOrphaned(
  patientId: string,
  orgId: string,
): Promise<boolean> {
  if (!patientId || !orgId) return false;
  if ((await countApprovedSharesForOrg(patientId, orgId)) > 0) return false;

  await query(`DELETE FROM clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`, [
    patientId,
    orgId,
  ]);
  // Rules history is deliberately *not* deleted per link. It is an archive of
  // prior My Rules text, including versions the patient themselves superseded
  // (`superseded_by = 'patient'`), so it is not purely clinic workspace. It keeps
  // its `org_id`, which is what hides it from every other clinic, and it dies
  // with the last link in purgeClinicDataIfNoConsumers below.
  await query(
    `DELETE FROM clinic_clinician_chats
     WHERE patient_id = $1
       AND clinician_id IN (SELECT user_id FROM org_members WHERE org_id = $2)`,
    [patientId, orgId],
  );
  return true;
}

export type PurgeOutcome = {
  /** Overlay + rules history + chats dropped (no clinic left to read them). */
  clinicWorkspace: boolean;
  /** Snapshot dropped (no clinic *and* no patient web view left to read it). */
  snapshot: boolean;
};

/**
 * Deletes whatever no longer has a reader. Derives everything from current state
 * rather than from what the caller just did, so it is idempotent and safe to run
 * from any path that can remove a consumer — revoking a share, or the patient
 * turning their web view off.
 *
 * The two scopes have different readers, which is why this is not one condition:
 *
 * - **Clinic workspace** (org overlays, clinician chats, rules history) is
 *   clinic-authored, and the patient's own read-only view never renders it. It
 *   dies with the last clinic link whether or not the web view is on.
 * - **The snapshot** has two possible readers. A patient using the web view with
 *   no clinic linked must keep it, or their own page breaks the moment they
 *   discharge from a clinic.
 *
 * Does not touch `user_cloud_backups` — that is the patient's own backup, kept or
 * dropped by its own toggle, and never clinic data.
 */
export async function purgeClinicDataIfNoConsumers(patientId: string): Promise<PurgeOutcome> {
  const outcome: PurgeOutcome = { clinicWorkspace: false, snapshot: false };
  if (!patientId) return outcome;

  if ((await countApprovedShares(patientId)) > 0) return outcome;

  await query(`DELETE FROM clinic_org_overlays WHERE patient_id = $1`, [patientId]);
  await query(`DELETE FROM clinic_clinician_chats WHERE patient_id = $1`, [patientId]);
  await query(`DELETE FROM clinic_patient_rules_history WHERE patient_id = $1`, [patientId]);
  outcome.clinicWorkspace = true;

  if (await webViewEnabled(patientId)) return outcome;

  await query(`DELETE FROM sync_blobs WHERE patient_id = $1`, [patientId]);
  outcome.snapshot = true;
  return outcome;
}
