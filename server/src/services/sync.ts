import { createHash } from 'node:crypto';
import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import { hasApprovedShare } from './shares.js';
import { clearSyncUpdateRequestsForPatient } from './syncRequests.js';

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

export class SyncError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SyncError';
    this.status = status;
  }
}

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

async function countApprovedShares(patientId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND status = 'approved'`,
    [patientId],
  );
  return parseInt(rows[0]?.n ?? '0', 10);
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

  const approved = await countApprovedShares(user.id);
  if (approved === 0) {
    throw new SyncError('Link a clinic account before sharing data', 422);
  }

  if (payloadGzip.length === 0) {
    throw new SyncError('Empty payload', 400);
  }
  if (payloadGzip.length > 15 * 1024 * 1024) {
    throw new SyncError('Payload too large (max 15 MB)', 413);
  }

  const version = await nextVersion(user.id);
  const payloadHash = createHash('sha256').update(payloadGzip).digest('hex');

  const { rows } = await query<SyncRow>(
    `INSERT INTO sync_blobs (patient_id, version, byte_size, payload_hash, summary, payload_gzip)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user.id, version, payloadGzip.length, payloadHash, summary, payloadGzip],
  );

  await clearSyncUpdateRequestsForPatient(user.id);

  return toPublicBlob(rows[0]!);
}

export async function getLatestSyncForMentor(
  mentor: PublicUser,
  patientId: string,
): Promise<{ blob: PublicSyncBlob; payloadGzipBase64: string } | null> {
  if (mentor.role !== 'mentor') {
    throw new SyncError('Only mentors can download patient sync data', 403);
  }

  const allowed = await hasApprovedShare(patientId, mentor.id);
  if (!allowed) {
    throw new SyncError('No approved share with this patient', 403);
  }

  const { rows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [patientId],
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
