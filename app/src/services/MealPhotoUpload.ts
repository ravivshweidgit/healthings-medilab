/**
 * Share-only meal photo upload (prompt116 Phase 2).
 *
 * The ONLY module allowed to push plate bytes. `ShareExportService` must not
 * import this — auto sync / web-view push / clinic refresh stay photo-free.
 * Call from `shareSnapshotNow` after the snapshot succeeds.
 *
 * Bytes never enter JS: `FileSystem.uploadAsync` with BINARY_CONTENT streams
 * the file natively. No base64, no gzip of JPEG, no snapshot sidecar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { CONFIG } from '../config/env';
import { authFetch, refreshAuthSession } from './AuthApiService';
import { loadAuthTokens } from './AuthTokenStore';
import { clientIdentityHeaders } from './ClientIdentity';
import { getRecentMeals } from './FoodLogService';
import { mealPhotoUri } from './MealPhotoService';

/** Match phone purge window — nothing older than 30 days is still on disk. */
const PHOTO_LOOKBACK_DAYS = 30;

/** Failed uploads retry on the next explicit Share — never in a tight loop. */
const QUEUE_KEY = 'healthings:mealPhotoUploadQueue';

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

async function collectLocalPhotoIds(): Promise<string[]> {
  const meals = await getRecentMeals(PHOTO_LOOKBACK_DAYS);
  const fromMeals = meals
    .map((m) => m.photoId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const queued = await loadQueue();
  return [...new Set([...fromMeals, ...queued])];
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

async function uploadOne(photoId: string, accessToken: string): Promise<boolean> {
  const uri = mealPhotoUri(photoId);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    // Purged or never written — drop from queue; do not block Share.
    return true;
  }

  const result = await FileSystem.uploadAsync(
    `${apiBase()}/v1/meal-photos/${encodeURIComponent(photoId)}`,
    uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'image/jpeg',
        ...clientIdentityHeaders(),
      },
    },
  );

  if (result.status === 200 || result.status === 201) return true;

  if (result.status === 401) {
    const refreshed = await refreshAuthSession();
    if (!refreshed?.accessToken) return false;
    const retry = await FileSystem.uploadAsync(
      `${apiBase()}/v1/meal-photos/${encodeURIComponent(photoId)}`,
      uri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: `Bearer ${refreshed.accessToken}`,
          'Content-Type': 'image/jpeg',
          ...clientIdentityHeaders(),
        },
      },
    );
    return retry.status === 200 || retry.status === 201;
  }

  console.warn('[MealPhotoUpload] upload failed:', photoId, result.status);
  return false;
}

/**
 * After an explicit Share snapshot succeeds. Never throw — numbers already landed;
 * plates are a bonus. Failed ids stay in the queue for the next Share tap.
 */
export async function uploadMealPhotosOnShare(): Promise<{ uploaded: number; failed: number }> {
  const candidates = await collectLocalPhotoIds();
  if (candidates.length === 0) {
    await saveQueue([]);
    return { uploaded: 0, failed: 0 };
  }

  let missing: string[];
  try {
    missing = await askMissing(candidates);
  } catch (err) {
    console.warn('[MealPhotoUpload] missing-check error:', err);
    await saveQueue(candidates);
    return { uploaded: 0, failed: candidates.length };
  }

  if (missing.length === 0) {
    await saveQueue([]);
    return { uploaded: 0, failed: 0 };
  }

  let accessToken = (await loadAuthTokens()).accessToken;
  if (!accessToken) {
    const refreshed = await refreshAuthSession();
    accessToken = refreshed?.accessToken ?? null;
  }
  if (!accessToken) {
    await saveQueue(missing);
    return { uploaded: 0, failed: missing.length };
  }

  const failed: string[] = [];
  let uploaded = 0;
  for (const photoId of missing) {
    try {
      const ok = await uploadOne(photoId, accessToken);
      if (ok) uploaded += 1;
      else failed.push(photoId);
    } catch (err) {
      console.warn('[MealPhotoUpload] upload error:', photoId, err);
      failed.push(photoId);
    }
  }

  await saveQueue(failed);
  return { uploaded, failed: failed.length };
}
