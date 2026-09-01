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
import {
  uploadMealPhotosOnShare,
  type MealPhotoUploadResult,
} from './MealPhotoUpload';
import {
  clinicDailySharePending,
  markClinicDailyShareDone,
} from './ClinicDailyShareService';

/** Poll while dashboard is mounted so clinic refresh works if app was already open. */
export const CLINIC_SYNC_POLL_MS = 10_000;

/**
 * The clinic can press Refresh snapshot; the patient's /account/ page uses the
 * same request-sync path. App polls while dashboard is mounted so either works
 * if the app was already open.
 */
const WEB_VIEW_PUSH_MIN_INTERVAL_MS = 10 * 60_000;

/** Retry window within the same day when the daily push fails (offline, token). */
const DAILY_PUSH_RETRY_MS = 10 * 60_000;

let inFlight: Promise<boolean> | null = null;
let lastWebViewPushAt = 0;
let lastDailyPushAttemptAt = 0;

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
 * Snapshot first, then plates on the binary channel.
 * Numbers must land even if a plate fails; missing-check keeps repeats cheap.
 * Pass photoIds from the same export the clinic just received.
 */
async function shareExportThenPlates(): Promise<MealPhotoUploadResult | undefined> {
  const exported = await shareClinicExport('365d');
  try {
    return await uploadMealPhotosOnShare(exported.photoIds);
  } catch (err) {
    console.warn('[ClinicSync] meal photo upload failed:', err);
    return { uploaded: 0, failed: 0, candidates: 0 };
  }
}

/**
 * Upload latest snapshot (+ plates) if any pending sync request exists.
 * Clinic Refresh snapshot and account Refresh both create requests — that is how
 * clinicians usually pull data, so plates must ride along here too (not only the
 * phone Share button). Still gated: approved clinic and/or My web view on.
 */
export async function fulfillPendingClinicSyncRequests(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const [requests, approved, webView] = await Promise.all([
        fetchSyncUpdateRequests().catch((err) => {
          console.warn('[ClinicSync] fetch requests failed:', err);
          return [];
        }),
        listShares('approved').catch((err) => {
          console.warn('[ClinicSync] list shares failed:', err);
          return [];
        }),
        webViewIsOn(),
      ]);
      if (requests.length === 0) return false;
      if (approved.length === 0 && !webView) return false;
      await shareExportThenPlates();
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

/** First consumer — push snapshot + plates so the clinic portal or /account/ is not empty. */
export async function shareSnapshotIfAnyConsumer(): Promise<boolean> {
  try {
    if (!(await hasSnapshotConsumer())) return false;
    await shareExportThenPlates();
    return true;
  } catch {
    return false;
  }
}

export type ShareSnapshotResult = ShareExportResult & {
  mealPhotos?: MealPhotoUploadResult;
};

/** Patient taps Share — upload snapshot + plates for a clinic or their own web view. */
export async function shareSnapshotNow(): Promise<ShareSnapshotResult> {
  if (!(await hasSnapshotConsumer())) {
    throw new Error('Nothing reads your data yet — link a clinic or turn on your web view');
  }
  // Snapshot first. Plates are a separate binary channel — never inside the gzip JSON.
  // Clinic Refresh uses fulfillPendingClinicSyncRequests → same plate path.
  // Background web-view push stays numbers-only (throttled, no user gesture).
  const result = await shareClinicExport('365d');
  let mealPhotos: MealPhotoUploadResult | undefined;
  try {
    mealPhotos = await uploadMealPhotosOnShare(result.photoIds);
  } catch (err) {
    // Numbers already landed; a plate failure must not fail Share.
    console.warn('[ClinicSync] meal photo upload failed:', err);
    mealPhotos = { uploaded: 0, failed: 0, candidates: 0 };
  }
  return { ...result, mealPhotos };
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
    await shareClinicExport('365d');
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

/**
 * One snapshot on the first app open of each local day, so a linked clinic reads
 * the whole week instead of whatever the last pull happened to catch.
 *
 * Numbers only. Plates ride on an explicit Share tap or on clinic Refresh, which
 * are gestures — a background push must not stream image bytes on its own.
 */
export async function pushDailyClinicSnapshot(): Promise<boolean> {
  const now = Date.now();
  if (now - lastDailyPushAttemptAt < DAILY_PUSH_RETRY_MS) return false;
  try {
    if (!(await clinicDailySharePending(now))) return false;
    const approved = await listShares('approved').catch(() => []);
    if (approved.length === 0) return false;
    // Claim the retry window only once we know a push is actually due, so an
    // unlinked patient does not swallow the first attempt after linking.
    lastDailyPushAttemptAt = now;
    await shareClinicExport('365d');
    // Marked after the upload lands: a failed day retries in ten minutes
    // instead of being written off until tomorrow.
    await markClinicDailyShareDone(now);
    return true;
  } catch (err) {
    console.warn('[ClinicSync] daily clinic push failed:', err);
    return false;
  }
}
