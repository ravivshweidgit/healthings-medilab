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
 * Two scopes, and the difference matters. `clinic_patient_overlays` is keyed by
 * `patient_id` alone and `clinic_patient_rules_history.mentor_id` is nullable, so
 * both are effectively shared by every clinic linked to that patient. Deleting
 * them when one of two links is revoked would corrupt the surviving clinic's
 * workspace. Only `sync_update_requests` is genuinely per-link.
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
 * Per-link cleanup, safe to run while other clinics are still linked: drops any
 * refresh this clinic had pending against the patient.
 */
export async function purgeClinicLinkData(patientId: string, mentorId: string): Promise<void> {
  if (!patientId || !mentorId) return;
  await query(`DELETE FROM sync_update_requests WHERE patient_id = $1 AND mentor_id = $2`, [
    patientId,
    mentorId,
  ]);
}

export type PurgeOutcome = {
  /** Overlay + rules history dropped (no clinic left to read them). */
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
 * - **Clinic workspace** (overlay, rules history) is clinic-authored, and the
 *   patient's own read-only view never renders it. It dies with the last clinic
 *   link whether or not the web view is on.
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

  await query(`DELETE FROM clinic_patient_overlays WHERE patient_id = $1`, [patientId]);
  await query(`DELETE FROM clinic_patient_rules_history WHERE patient_id = $1`, [patientId]);
  outcome.clinicWorkspace = true;

  if (await webViewEnabled(patientId)) return outcome;

  await query(`DELETE FROM sync_blobs WHERE patient_id = $1`, [patientId]);
  outcome.snapshot = true;
  return outcome;
}
