/**
 * Snapshot uploads to the server.
 *
 * Two things read that snapshot: a linked clinic, and the patient's own
 * read-only page at healthings.ai/account. The server accepts an upload when
 * either exists, so the checks here have to match — gating on clinic links
 * alone would mean the web view could be on and never receive anything.
 */

import { fetchCurrentUser } from './AuthApiService';
import { listShares } from './ShareApiService';
import { fetchSyncUpdateRequests } from './SyncApiService';
import { shareClinicExport, type ShareExportResult } from './ShareExportService';

/** Poll while dashboard is mounted so clinic refresh works if app was already open. */
export const CLINIC_SYNC_POLL_MS = 10_000;

/**
 * The clinic can press Refresh snapshot; the patient's own page has no such
 * button, so the app pushes on launch and on foreground instead. Throttled so
 * that switching apps repeatedly does not re-upload each time.
 */
const WEB_VIEW_PUSH_MIN_INTERVAL_MS = 10 * 60_000;

let inFlight: Promise<boolean> | null = null;
let lastWebViewPushAt = 0;

async function webViewIsOn(): Promise<boolean> {
  const me = await fetchCurrentUser().catch(() => null);
  return me?.webViewEnabled === true;
}

/** Whether anything on the server would read a snapshot we upload. */
async function hasSnapshotConsumer(): Promise<boolean> {
  const [approved, webView] = await Promise.all([
    listShares('approved').catch(() => []),
    webViewIsOn(),
  ]);
  return approved.length > 0 || webView;
}

/**
 * Upload latest snapshot if any clinic has a pending sync request.
 *
 * Stays clinic-only on purpose: only a clinic can create a request, and the
 * approved-share check guards the case where the link was revoked after asking.
 */
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

/** First consumer — push a snapshot so the clinic portal or /account/ is not empty. */
export async function shareSnapshotIfAnyConsumer(): Promise<boolean> {
  try {
    if (!(await hasSnapshotConsumer())) return false;
    await shareClinicExport('90d');
    return true;
  } catch {
    return false;
  }
}

/** Patient taps Share — upload snapshot for a clinic or their own web view to read. */
export async function shareSnapshotNow(): Promise<ShareExportResult> {
  if (!(await hasSnapshotConsumer())) {
    throw new Error('Nothing reads your data yet — link a clinic or turn on your web view');
  }
  return shareClinicExport('90d');
}

/**
 * Keep /account/ reasonably fresh. Called on launch and when the app comes back
 * to the foreground; does nothing unless the patient turned the view on.
 */
export async function pushSnapshotForWebView(): Promise<boolean> {
  const now = Date.now();
  if (now - lastWebViewPushAt < WEB_VIEW_PUSH_MIN_INTERVAL_MS) return false;
  try {
    if (!(await webViewIsOn())) return false;
    // Set only once we know the view is on, so an off state does not consume
    // the throttle window and delay the first push after enabling.
    lastWebViewPushAt = now;
    await shareClinicExport('90d');
    return true;
  } catch (err) {
    console.warn('[ClinicSync] web view push failed:', err);
    return false;
  }
}

/** Enabling the web view should show data immediately, not after the next launch. */
export function resetWebViewPushThrottle(): void {
  lastWebViewPushAt = 0;
}
