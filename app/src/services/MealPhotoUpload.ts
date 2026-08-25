/**
 * Share-only meal photo upload (prompt116 Phase 2).
 *
 * The ONLY module allowed to push plate bytes. `ShareExportService` must not
 * import this — auto sync / web-view push / clinic refresh stay photo-free.
 * Call from `shareSnapshotNow` after the snapshot succeeds.
 *
 * Bytes never enter JS: `uploadAsync` with BINARY_CONTENT streams the file
 * natively. No base64, no gzip of JPEG, no snapshot sidecar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FileSystemUploadType,
  getInfoAsync,
  uploadAsync,
} from 'expo-file-system/legacy';
import { CONFIG } from '../config/env';
import { authFetch, refreshAuthSession } from './AuthApiService';
import { loadAuthTokens } from './AuthTokenStore';
import { clientIdentityHeaders } from './ClientIdentity';
import { listMealPhotoIdsOnDisk, mealPhotoUri } from './MealPhotoService';

/** Failed uploads retry on the next explicit Share — never in a tight loop. */
const QUEUE_KEY = 'healthings:mealPhotoUploadQueue';

/** Same day-key shape ShareExport uses when dumping meals into the snapshot. */
const FOOD_LOG_KEY_RE = /^food_log_\d{4}-\d{2}-\d{2}$/;

function apiBase(): string {
  return CONFIG.healthingsApiUrl.replace(/\/$/, '');
}

async function loadQueue(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

async function saveQueue(ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return;
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(unique));
}

/**
 * Collect every photoId the phone still knows about.
 *
 * Do NOT rely on `food_log_days` alone — ShareExport dumps every `food_log_*`
 * key, and the clinic already sees those photoIds. If the day index is stale,
 * getRecentMeals returns nothing and Share silently skips plates (zero HTTP to
 * /v1/meal-photos). Scan the same keys Share uses, plus files on disk.
 */
async function collectLocalPhotoIds(): Promise<string[]> {
  const ids = new Set<string>();

  try {
    const keys = await AsyncStorage.getAllKeys();
    const foodKeys = keys.filter((k) => FOOD_LOG_KEY_RE.test(k));
    if (foodKeys.length > 0) {
      const rows = await AsyncStorage.multiGet(foodKeys);
      for (const [, raw] of rows) {
        if (!raw) continue;
        try {
          const meals = JSON.parse(raw) as unknown;
          if (!Array.isArray(meals)) continue;
          for (const meal of meals) {
            const photoId = (meal as { photoId?: unknown })?.photoId;
            if (typeof photoId === 'string' && photoId.length > 0) ids.add(photoId);
          }
        } catch {
          /* skip corrupt day */
        }
      }
    }
  } catch (err) {
    console.warn('[MealPhotoUpload] food_log scan failed:', err);
  }

  for (const id of await loadQueue()) ids.add(id);

  try {
    for (const id of await listMealPhotoIdsOnDisk()) ids.add(id);
  } catch (err) {
    console.warn('[MealPhotoUpload] disk list failed:', err);
  }

  const out = [...ids];
  console.warn('[MealPhotoUpload] candidates:', out.length, out.slice(0, 5));
  return out;
}

async function askMissing(photoIds: string[]): Promise<string[]> {
  if (photoIds.length === 0) return [];
  const res = await authFetch('/v1/meal-photos/missing', {
    method: 'POST',
    body: JSON.stringify({ photoIds }),
  });
  if (!res.ok) {
    console.warn('[MealPhotoUpload] missing-check failed:', res.status);
    // Treat as "all missing" so a flaky check still tries once; failures re-queue.
    return photoIds;
  }
  const body = (await res.json()) as { missing?: string[] };
  return Array.isArray(body.missing) ? body.missing.filter((id) => typeof id === 'string') : [];
}

/** ok = stored on server; skip = no local file (drop); fail = retry next Share */
async function uploadOne(
  photoId: string,
  accessToken: string,
): Promise<'ok' | 'skip' | 'fail'> {
  const uri = mealPhotoUri(photoId);
  const info = await getInfoAsync(uri);
  if (!info.exists) {
    // photoId in meal JSON but JPEG gone (purge / wrong dir) — drop, do not count as uploaded.
    console.warn('[MealPhotoUpload] file missing on disk:', photoId, uri);
    return 'skip';
  }

  const result = await uploadAsync(`${apiBase()}/v1/meal-photos/${encodeURIComponent(photoId)}`, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Must match a registered Fastify binary parser (see mealPhotos routes).
      'Content-Type': 'application/octet-stream',
      ...clientIdentityHeaders(),
    },
  });

  if (result.status === 200 || result.status === 201) return 'ok';

  if (result.status === 401) {
    const refreshed = await refreshAuthSession();
    if (!refreshed?.accessToken) return 'fail';
    const retry = await uploadAsync(
      `${apiBase()}/v1/meal-photos/${encodeURIComponent(photoId)}`,
      uri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${refreshed.accessToken}`,
          'Content-Type': 'application/octet-stream',
          ...clientIdentityHeaders(),
        },
      },
    );
    return retry.status === 200 || retry.status === 201 ? 'ok' : 'fail';
  }

  console.warn('[MealPhotoUpload] upload failed:', photoId, result.status);
  return 'fail';
}

export type MealPhotoUploadResult = { uploaded: number; failed: number; candidates: number };

/**
 * After a snapshot succeeds. Prefer `seedPhotoIds` from that same export so we
 * upload exactly what the clinic already sees — do not depend on a second
 * AsyncStorage scan that can miss plates. Never throw.
 */
export async function uploadMealPhotosOnShare(
  seedPhotoIds?: string[],
): Promise<MealPhotoUploadResult> {
  const fromScan = await collectLocalPhotoIds();
  const candidates = [
    ...new Set([...(seedPhotoIds ?? []).filter((id) => typeof id === 'string' && id.length > 0), ...fromScan]),
  ];
  console.warn(
    '[MealPhotoUpload] start seed=',
    seedPhotoIds?.length ?? 0,
    'scan=',
    fromScan.length,
    'merged=',
    candidates.length,
  );
  if (candidates.length === 0) {
    await saveQueue([]);
    return { uploaded: 0, failed: 0, candidates: 0 };
  }

  let missing: string[];
  try {
    missing = await askMissing(candidates);
  } catch (err) {
    console.warn('[MealPhotoUpload] missing-check error:', err);
    await saveQueue(candidates);
    return { uploaded: 0, failed: candidates.length, candidates: candidates.length };
  }

  console.warn('[MealPhotoUpload] missing on server:', missing.length);

  if (missing.length === 0) {
    await saveQueue([]);
    return { uploaded: 0, failed: 0, candidates: candidates.length };
  }

  let accessToken = (await loadAuthTokens()).accessToken;
  if (!accessToken) {
    const refreshed = await refreshAuthSession();
    accessToken = refreshed?.accessToken ?? null;
  }
  if (!accessToken) {
    await saveQueue(missing);
    return { uploaded: 0, failed: missing.length, candidates: candidates.length };
  }

  const failed: string[] = [];
  let uploaded = 0;
  let skipped = 0;
  for (const photoId of missing) {
    try {
      const outcome = await uploadOne(photoId, accessToken);
      if (outcome === 'ok') uploaded += 1;
      else if (outcome === 'skip') skipped += 1;
      else failed.push(photoId);
    } catch (err) {
      console.warn('[MealPhotoUpload] upload error:', photoId, err);
      failed.push(photoId);
    }
  }

  await saveQueue(failed);
  console.warn(
    '[MealPhotoUpload] done uploaded=',
    uploaded,
    'failed=',
    failed.length,
    'skippedMissingFile=',
    skipped,
  );
  // Surface skips as failed so Share alert is honest (clinic still has no plate).
  return {
    uploaded,
    failed: failed.length + skipped,
    candidates: candidates.length,
  };
}
