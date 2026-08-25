/**
 * Meal camera thumbs on disk — one JPEG per plate, written once at capture.
 *
 * Nothing here may be called from a render path (`render-path-reads-memory.mdc`).
 * The dashboard decides the camera mark from `FoodEntry.photoId` alone; this module
 * is touched only when a meal is saved or deleted, and when the meal card is open.
 * v1 of this feature stat-ed the disk once per meal per chart refresh, and one photo
 * was enough to make every expand feel slow.
 *
 * `photoId` is `{dayKey}_{md5}`, which buys two things:
 *   - the 30-day purge is a single directory listing plus a string compare, with no
 *     per-file stat, no meal-JSON read, and no meal-JSON write;
 *   - the md5 half is content-derived, so the server can be asked which ids it is
 *     missing and each plate uploads exactly once (prompt116 Phase 2).
 *
 * The md5 is computed natively by `getInfoAsync`. Bytes never enter JS — no base64
 * lives on disk, in AsyncStorage, or in any request body.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const DIR_NAME = 'healthings-meal-photos';
const KEEP_DAYS = 30;
const MAX_EDGE_PX = 800;
const JPEG_QUALITY = 0.72;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Local calendar day, `YYYY-MM-DD`. Must stay identical to `dayKey` in
 * `FoodLogService` — kept local so this module remains a leaf that the food log can
 * import for deletion, mirroring `LabPdfFileService`.
 */
function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rootDir(): string {
  return `${FileSystem.documentDirectory ?? ''}${DIR_NAME}/`;
}

/**
 * Pure string build — no I/O, safe to call while rendering. Says nothing about
 * whether the file exists; the `<Image>` in the open meal card handles a miss via
 * `onError`, which is free, unlike a stat on the render path.
 */
export function mealPhotoUri(photoId: string): string {
  return `${rootDir()}${photoId}.jpg`;
}

async function ensureDir(): Promise<void> {
  const dir = rootDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

/**
 * Resize + compress the camera shot and keep it. Call once, on meal save — this is
 * deliberately eager so that every later read is free.
 *
 * Source dimensions come from the picker asset so the *longest* edge is capped;
 * resizing width alone would leave a portrait plate ~1066 px tall.
 *
 * Returns the new `photoId`, or null if anything failed — a missing plate must never
 * fail a meal save.
 */
export async function writeMealPhoto(
  sourceUri: string,
  mealTimestamp: number,
  srcWidth?: number,
  srcHeight?: number,
): Promise<string | null> {
  try {
    await ensureDir();

    const portrait = srcWidth != null && srcHeight != null && srcHeight > srcWidth;
    const shrunk = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: portrait ? { height: MAX_EDGE_PX } : { width: MAX_EDGE_PX } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );

    const info = await FileSystem.getInfoAsync(shrunk.uri, { md5: true });
    const digest =
      info.exists && info.md5
        ? info.md5
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const photoId = `${dayKey(mealTimestamp)}_${digest}`;
    const dest = mealPhotoUri(photoId);

    // Same plate re-saved on the same day: identical md5, file already correct.
    const existing = await FileSystem.getInfoAsync(dest);
    if (existing.exists) {
      await FileSystem.deleteAsync(shrunk.uri, { idempotent: true });
    } else {
      await FileSystem.moveAsync({ from: shrunk.uri, to: dest });
    }
    return photoId;
  } catch (err) {
    console.warn('[MealPhoto] write failed:', err);
    return null;
  }
}

export async function deleteMealPhoto(photoId: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(mealPhotoUri(photoId), { idempotent: true });
  } catch {
    /* already gone */
  }
}

/**
 * Drop thumbs whose day prefix is older than the keep window.
 *
 * One directory listing and a string compare per name — no `getInfoAsync` per file,
 * and it never reads or rewrites meal JSON. Meal numbers keep their `photoId`
 * forever; a pointer to a purged file shows a stale camera mark, which is cosmetic
 * and costs nothing, whereas clearing it would mean rewriting day records.
 *
 * Call once per launch, deferred — never on meal save.
 */
export async function purgeOldMealPhotos(): Promise<void> {
  try {
    const dir = rootDir();
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return;

    const cutoffDay = dayKey(Date.now() - KEEP_DAYS * DAY_MS);
    const names = await FileSystem.readDirectoryAsync(dir);
    for (const name of names) {
      // '2026-08-25_ab12….jpg' → '2026-08-25'; both are YYYY-MM-DD so < is date order.
      if (name.slice(0, 10) < cutoffDay) {
        await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true });
      }
    }
  } catch (err) {
    console.warn('[MealPhoto] purge failed:', err);
  }
}
