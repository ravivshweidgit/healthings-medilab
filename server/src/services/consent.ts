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

/** A snapshot may be held for an approved clinic share. be-15 adds the patient's own web view here. */
async function countConsumers(patientId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND status = 'approved'`,
    [patientId],
  );
  return parseInt(rows[0]?.n ?? '0', 10);
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

/**
 * Deletes everything the server holds about a patient's clinic sharing once
 * nothing is left to read it: the snapshot, the workspace overlay and the rules
 * history. A patient linked to two clinics who revokes one keeps all of it for
 * the other. Does not touch `user_cloud_backups`, which is the patient's own
 * backup and not clinic data. Returns whether a purge ran.
 */
export async function purgeClinicDataIfNoConsumers(patientId: string): Promise<boolean> {
  if (!patientId) return false;
  if ((await countConsumers(patientId)) > 0) return false;

  await query(`DELETE FROM sync_blobs WHERE patient_id = $1`, [patientId]);
  await query(`DELETE FROM clinic_patient_overlays WHERE patient_id = $1`, [patientId]);
  await query(`DELETE FROM clinic_patient_rules_history WHERE patient_id = $1`, [patientId]);
  return true;
}
