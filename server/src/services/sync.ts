import { createHash } from 'node:crypto';
import { deflateSync, gunzipSync, inflateSync } from 'node:zlib';
import { query } from '../db/pool.js';
import { hasAnySnapshotConsumer } from './consent.js';
import type { PublicUser } from './jwt.js';
import {
  assertMentorPatientAccess,
  getMentorOrgId,
  recordPatientAccess,
} from './clinicAccess.js';
import { clearSyncUpdateRequestsForPatient } from './syncRequests.js';
import { reconcileOverlayRulesFromPatientSnapshot, type ClinicUserRules } from './clinicOverlay.js';

/** Cap inflated snapshot size so a hostile deflate cannot OOM the write path. */
const MAX_INFLATED_BYTES = 64 * 1024 * 1024;

const CHAT_HISTORY_KEY =
  /^chat_history_\d{4}-\d{2}-\d{2}(?:_(doctor|nutritionist|coach))?$/;

export class SyncError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
  }
}

function decompressSyncPayload(buf: Buffer): string {
  try {
    return inflateSync(buf).toString('utf8');
  } catch {
    return gunzipSync(buf).toString('utf8');
  }
}

/**
 * be-24: strip patient coach chat from clinic snapshots on upload.
 * Old app builds keep shipping chat_history_*; without this strip those
 * transcripts sit at rest even after the portal stops rendering them.
 * Returns the original buffer when nothing matched (hash unchanged).
 */
export function stripChatHistoryFromSyncPayload(payloadGzip: Buffer): Buffer {
  let json: string;
  try {
    json = decompressSyncPayload(payloadGzip);
  } catch {
    throw new SyncError('Invalid sync payload', 400);
  }
  if (Buffer.byteLength(json, 'utf8') > MAX_INFLATED_BYTES) {
    throw new SyncError('Payload too large when decompressed', 413);
  }

  let parsed: { asyncStorage?: Record<string, string>; [k: string]: unknown };
  try {
    parsed = JSON.parse(json) as { asyncStorage?: Record<string, string> };
  } catch {
    throw new SyncError('Invalid sync payload', 400);
  }

  const store = parsed.asyncStorage;
  if (!store || typeof store !== 'object') return payloadGzip;

  let removed = 0;
  for (const key of Object.keys(store)) {
    if (CHAT_HISTORY_KEY.test(key)) {
      delete store[key];
      removed++;
    }
  }
  if (removed === 0) return payloadGzip;

  return deflateSync(Buffer.from(JSON.stringify(parsed), 'utf8'));
}

function patientRulesFromSyncPayload(payloadGzip: Buffer): ClinicUserRules | null {
  try {
    const parsed = JSON.parse(decompressSyncPayload(payloadGzip)) as {
      asyncStorage?: Record<string, string>;
    };
    const raw = parsed.asyncStorage?.user_rules;
    if (!raw) return null;
    const rules = JSON.parse(raw) as ClinicUserRules;
    if (!rules?.rawText?.trim()) return null;
    return rules;
  } catch {
    return null;
  }
}

export type SyncSummary = {
  generatedAt: string;
  lookbackDays: number;
  lookbackMode: '90d' | 'full';
  dayRange: { from: string; to: string };
  includes: string[];
};

export type PublicSyncBlob = {
  id: string;
  patientId: string;
  version: number;
  byteSize: number;
  payloadHash: string;
  summary: SyncSummary;
  createdAt: string;
};

type SyncRow = {
  id: string;
  patient_id: string;
  version: number;
  byte_size: number;
  payload_hash: string;
  summary: SyncSummary;
  payload_gzip: Buffer;
  created_at: Date;
};

function toPublicBlob(row: SyncRow): PublicSyncBlob {
  return {
    id: row.id,
    patientId: row.patient_id,
    version: row.version,
    byteSize: row.byte_size,
    payloadHash: row.payload_hash,
    summary: row.summary,
    createdAt: row.created_at.toISOString(),
  };
}

async function nextVersion(patientId: string): Promise<number> {
  const { rows } = await query<{ max: number | null }>(
    `SELECT MAX(version) AS max FROM sync_blobs WHERE patient_id = $1`,
    [patientId],
  );
  return (rows[0]?.max ?? 0) + 1;
}

export async function uploadSyncBlob(
  user: PublicUser,
  payloadGzip: Buffer,
  summary: SyncSummary,
): Promise<PublicSyncBlob> {
  if (user.role !== 'patient') {
    throw new SyncError('Only patients can upload sync data', 403);
  }

  if (!(await hasAnySnapshotConsumer(user.id))) {
    throw new SyncError('Link a clinic account or turn on your web view before sharing data', 422);
  }

  if (payloadGzip.length === 0) {
    throw new SyncError('Empty payload', 400);
  }
  if (payloadGzip.length > 15 * 1024 * 1024) {
    throw new SyncError('Payload too large (max 15 MB)', 413);
  }

  // Strip before hash/store so old app builds cannot leave coach chat at rest.
  const stored = stripChatHistoryFromSyncPayload(payloadGzip);

  const version = await nextVersion(user.id);
  const payloadHash = createHash('sha256').update(stored).digest('hex');

  const { rows } = await query<SyncRow>(
    `INSERT INTO sync_blobs (patient_id, version, byte_size, payload_hash, summary, payload_gzip)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user.id, version, stored.length, payloadHash, summary, stored],
  );

  // Every consumer reads ORDER BY version DESC LIMIT 1, so superseded rows are
  // dead weight at up to 15 MB each, and privacy.html describes "a current
  // snapshot" in the singular. Keep exactly that.
  await query(`DELETE FROM sync_blobs WHERE patient_id = $1 AND version < $2`, [user.id, version]);

  await clearSyncUpdateRequestsForPatient(user.id);

  try {
    await reconcileOverlayRulesFromPatientSnapshot(user.id, patientRulesFromSyncPayload(stored));
  } catch {
    // Non-fatal: snapshot still uploaded; portal can still prefer newer snapshot text.
  }

  return toPublicBlob(rows[0]!);
}

export async function getLatestSyncForMentor(
  mentor: PublicUser,
  patientId: string,
): Promise<{ blob: PublicSyncBlob; payloadGzipBase64: string } | null> {
  await assertMentorPatientAccess(mentor, patientId, SyncError);

  const { rows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [patientId],
  );

  const row = rows[0];
  if (!row) return null;

  const orgId = await getMentorOrgId(mentor.id);
  await recordPatientAccess({
    patientId,
    actorUserId: mentor.id,
    orgId,
    action: 'snapshot.read',
  });

  return {
    blob: toPublicBlob(row),
    payloadGzipBase64: row.payload_gzip.toString('base64'),
  };
}

/**
 * The patient's own snapshot, payload included — the same bytes a linked clinic
 * reads, which is the point: /account/ shows exactly what a clinic would see.
 *
 * Gated on the live column rather than on `user.webViewEnabled` from the access
 * token, so turning the view off revokes reads immediately instead of when the
 * 15-minute token expires.
 */
export async function getLatestSyncPayloadForPatient(
  user: PublicUser,
): Promise<{ blob: PublicSyncBlob; payloadGzipBase64: string } | null> {
  if (user.role !== 'patient') {
    throw new SyncError('Only patients can read their own snapshot', 403);
  }

  const { rows: flag } = await query<{ on: boolean }>(
    `SELECT web_view_enabled AS on FROM users WHERE id = $1`,
    [user.id],
  );
  if (flag[0]?.on !== true) {
    throw new SyncError('Turn on your web view to read your snapshot here', 403);
  }

  const { rows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [user.id],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    blob: toPublicBlob(row),
    payloadGzipBase64: row.payload_gzip.toString('base64'),
  };
}

export async function getLatestSyncMetaForPatient(user: PublicUser): Promise<PublicSyncBlob | null> {
  if (user.role !== 'patient') {
    throw new SyncError('Only patients can read own sync metadata', 403);
  }

  const { rows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [user.id],
  );

  const row = rows[0];
  if (!row) return null;
  return toPublicBlob(row);
}
