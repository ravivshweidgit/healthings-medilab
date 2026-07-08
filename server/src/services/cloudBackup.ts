import { createHash } from 'node:crypto';
import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import {
  canOverwriteCloudBackup,
  type BackupFingerprint,
} from '../logic/backupFingerprint.js';

export type CloudBackupStatus = {
  hasBackup: boolean;
  exportedAt: string | null;
  byteSize: number | null;
  fingerprint: BackupFingerprint | null;
  hasPrevious: boolean;
};

type BackupRow = {
  user_id: string;
  byte_size: number;
  payload_hash: string;
  exported_at: Date;
  payload_gzip: Buffer;
  fingerprint: BackupFingerprint | null;
  prev_payload_gzip: Buffer | null;
  prev_byte_size: number | null;
  prev_exported_at: Date | null;
  prev_fingerprint: BackupFingerprint | null;
};

export class CloudBackupError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CloudBackupError';
    this.status = status;
  }
}

const MAX_BYTES = 25 * 1024 * 1024;

function parseFingerprint(raw: unknown): BackupFingerprint | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as BackupFingerprint;
  if (typeof f.byteSize !== 'number' || typeof f.mealDays !== 'number') return null;
  return {
    earliestDay: f.earliestDay ?? null,
    latestDay: f.latestDay ?? null,
    mealDays: f.mealDays,
    glucosePoints: f.glucosePoints ?? 0,
    keyCount: f.keyCount ?? 0,
    byteSize: f.byteSize,
  };
}

export async function getCloudBackupStatus(user: PublicUser): Promise<CloudBackupStatus> {
  if (user.role !== 'patient') {
    throw new CloudBackupError('Only patients can use cloud backup', 403);
  }
  const { rows } = await query<
    Pick<BackupRow, 'byte_size' | 'exported_at' | 'fingerprint' | 'prev_payload_gzip'>
  >(
    `SELECT byte_size, exported_at, fingerprint, prev_payload_gzip
     FROM user_cloud_backups WHERE user_id = $1`,
    [user.id],
  );
  const row = rows[0];
  if (!row) {
    return {
      hasBackup: false,
      exportedAt: null,
      byteSize: null,
      fingerprint: null,
      hasPrevious: false,
    };
  }
  return {
    hasBackup: true,
    exportedAt: row.exported_at.toISOString(),
    byteSize: row.byte_size,
    fingerprint: parseFingerprint(row.fingerprint),
    hasPrevious: row.prev_payload_gzip != null,
  };
}

export async function upsertCloudBackup(
  user: PublicUser,
  payloadGzip: Buffer,
  exportedAt: string,
  fingerprint: BackupFingerprint,
  force = false,
): Promise<CloudBackupStatus> {
  if (user.role !== 'patient') {
    throw new CloudBackupError('Only patients can use cloud backup', 403);
  }
  if (payloadGzip.length === 0) {
    throw new CloudBackupError('Empty payload', 400);
  }
  if (payloadGzip.length > MAX_BYTES) {
    throw new CloudBackupError('Payload too large (max 25 MB)', 413);
  }

  const fp: BackupFingerprint = {
    ...fingerprint,
    byteSize: payloadGzip.length,
  };

  const exported = new Date(exportedAt);
  if (Number.isNaN(exported.getTime())) {
    throw new CloudBackupError('Invalid exportedAt', 400);
  }

  const { rows: existing } = await query<BackupRow>(
    `SELECT * FROM user_cloud_backups WHERE user_id = $1`,
    [user.id],
  );
  const current = existing[0];
  if (current && !force) {
    const cloudFp = parseFingerprint(current.fingerprint) ?? {
      earliestDay: null,
      latestDay: null,
      mealDays: 0,
      glucosePoints: 0,
      keyCount: 0,
      byteSize: current.byte_size,
    };
    const decision = canOverwriteCloudBackup(fp, cloudFp);
    if (!decision.ok) {
      throw new CloudBackupError(decision.reason, 409);
    }
  }

  const payloadHash = createHash('sha256').update(payloadGzip).digest('hex');

  if (!current) {
    await query(
      `INSERT INTO user_cloud_backups (
         user_id, byte_size, payload_hash, exported_at, payload_gzip, fingerprint
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [user.id, payloadGzip.length, payloadHash, exported, payloadGzip, JSON.stringify(fp)],
    );
  } else {
    await query(
      `UPDATE user_cloud_backups SET
         prev_payload_gzip = payload_gzip,
         prev_byte_size = byte_size,
         prev_exported_at = exported_at,
         prev_fingerprint = fingerprint,
         byte_size = $2,
         payload_hash = $3,
         exported_at = $4,
         payload_gzip = $5,
         fingerprint = $6::jsonb,
         updated_at = NOW()
       WHERE user_id = $1`,
      [user.id, payloadGzip.length, payloadHash, exported, payloadGzip, JSON.stringify(fp)],
    );
  }

  return {
    hasBackup: true,
    exportedAt: exported.toISOString(),
    byteSize: payloadGzip.length,
    fingerprint: fp,
    hasPrevious: Boolean(current),
  };
}

export async function downloadCloudBackup(user: PublicUser): Promise<Buffer> {
  if (user.role !== 'patient') {
    throw new CloudBackupError('Only patients can use cloud backup', 403);
  }
  const { rows } = await query<Pick<BackupRow, 'payload_gzip'>>(
    `SELECT payload_gzip FROM user_cloud_backups WHERE user_id = $1`,
    [user.id],
  );
  const row = rows[0];
  if (!row) {
    throw new CloudBackupError('No cloud backup', 404);
  }
  return row.payload_gzip;
}

export async function deleteCloudBackup(user: PublicUser): Promise<void> {
  if (user.role !== 'patient') {
    throw new CloudBackupError('Only patients can use cloud backup', 403);
  }
  await query(`DELETE FROM user_cloud_backups WHERE user_id = $1`, [user.id]);
}
