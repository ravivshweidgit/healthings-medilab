/**
 * Meal plate blobs — separate from the gzipped snapshot (prompt116 Phase 2).
 * Bytes never join sync_blobs JSON; upload is PUT octet-stream per photo id.
 */

import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import { assertMentorPatientAccess } from './clinicAccess.js';

/** Longest edge ~800 JPEG stays well under this; refuse anything larger. */
export const MEAL_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** `{YYYY-MM-DD}_{digest}` — digest is native md5 hex, or a short fallback id. */
const PHOTO_ID_RE = /^\d{4}-\d{2}-\d{2}_[a-zA-Z0-9]{6,64}$/;

export class MealPhotoError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'MealPhotoError';
    this.status = status;
  }
}

export function assertValidPhotoId(photoId: string): void {
  if (!PHOTO_ID_RE.test(photoId) || photoId.length > 80) {
    throw new MealPhotoError('Invalid photo id', 400);
  }
}

export async function upsertMealPhoto(
  patient: PublicUser,
  photoId: string,
  bytes: Buffer,
): Promise<{ photoId: string; byteSize: number }> {
  if (patient.role !== 'patient') {
    throw new MealPhotoError('Only patients upload meal photos', 403);
  }
  assertValidPhotoId(photoId);
  if (!bytes.length) throw new MealPhotoError('Empty photo', 400);
  if (bytes.length > MEAL_PHOTO_MAX_BYTES) {
    throw new MealPhotoError(`Photo too large (max ${MEAL_PHOTO_MAX_BYTES} bytes)`, 413);
  }

  await query(
    `INSERT INTO meal_photos (patient_id, photo_id, bytes, byte_size)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (patient_id, photo_id) DO UPDATE
       SET bytes = EXCLUDED.bytes,
           byte_size = EXCLUDED.byte_size,
           created_at = NOW()`,
    [patient.id, photoId, bytes, bytes.length],
  );
  return { photoId, byteSize: bytes.length };
}

/**
 * Which of the client's ids the server does not have yet — so a second Share
 * uploads nothing when every plate is already stored.
 */
export async function findMissingMealPhotoIds(
  patient: PublicUser,
  photoIds: string[],
): Promise<string[]> {
  if (patient.role !== 'patient') {
    throw new MealPhotoError('Only patients upload meal photos', 403);
  }
  const unique = [...new Set(photoIds.filter((id) => PHOTO_ID_RE.test(id)))];
  if (unique.length === 0) return [];

  const { rows } = await query<{ photo_id: string }>(
    `SELECT photo_id FROM meal_photos
     WHERE patient_id = $1 AND photo_id = ANY($2::text[])`,
    [patient.id, unique],
  );
  const have = new Set(rows.map((r) => r.photo_id));
  return unique.filter((id) => !have.has(id));
}

export async function getMealPhotoBytes(
  actor: PublicUser,
  patientId: string,
  photoId: string,
): Promise<Buffer | null> {
  assertValidPhotoId(photoId);

  if (actor.id === patientId) {
    if (actor.role !== 'patient') {
      throw new MealPhotoError('Forbidden', 403);
    }
  } else {
    await assertMentorPatientAccess(actor, patientId, MealPhotoError);
  }

  const { rows } = await query<{ bytes: Buffer }>(
    `SELECT bytes FROM meal_photos WHERE patient_id = $1 AND photo_id = $2`,
    [patientId, photoId],
  );
  return rows[0]?.bytes ?? null;
}
