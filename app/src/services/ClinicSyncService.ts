/**
 * When a linked clinic requests a fresh snapshot, upload while the app is open.
 * No patient tap — they already approved data sharing.
 */

import { listShares } from './ShareApiService';
import { fetchSyncUpdateRequests } from './SyncApiService';
import { shareClinicExport } from './ShareExportService';

/** Poll while dashboard is mounted so clinic refresh works if app was already open. */
export const CLINIC_SYNC_POLL_MS = 10_000;

let inFlight: Promise<boolean> | null = null;

/** Upload latest snapshot if any clinic has a pending sync request. */
export async function fulfillPendingClinicSyncRequests(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const [requests, approved] = await Promise.all([
        fetchSyncUpdateRequests().catch((err) => {
          console.warn('[ClinicSync] fetch requests failed:', err);
          return [];
        }),
        listShares('approved').catch((err) => {
          console.warn('[ClinicSync] list shares failed:', err);
          return [];
        }),
      ]);
      if (requests.length === 0 || approved.length === 0) return false;
      await shareClinicExport('90d');
      return true;
    } catch (err) {
      console.warn('[ClinicSync] upload failed:', err);
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** First link — push an initial snapshot so the clinic portal is not empty. */
export async function shareInitialClinicSnapshotIfLinked(): Promise<boolean> {
  try {
    const approved = await listShares('approved');
    if (approved.length === 0) return false;
    await shareClinicExport('90d');
    return true;
  } catch {
    return false;
  }
}
