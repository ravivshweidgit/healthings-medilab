/**
 * Optional cloud backup — opt-in, purge on off, richness guard, daily opportunistic sync.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deflate, inflate } from 'pako';
import {
  canOverwriteCloudBackup,
  fingerprintFromBackupPayload,
  type BackupFingerprint,
} from '../logic/backupFingerprint';
import { authFetch } from './AuthApiService';
import { applyLocalBackupPayload, buildLocalBackupPayload } from './LocalBackupService';

const CLOUD_BACKUP_OPT_IN_KEY = 'healthings:cloudBackupOptIn';
const LAST_SUCCESS_KEY = 'healthings:cloudBackupLastSuccessAt';
const OPTED_IN_AT_KEY = 'healthings:cloudBackupOptedInAt';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CloudBackupStatus = {
  enabled: boolean;
  hasBackup: boolean;
  exportedAt: string | null;
  byteSize: number | null;
  fingerprint: BackupFingerprint | null;
  hasPrevious: boolean;
};

export class CloudBackupBlockedError extends Error {
  fingerprint: BackupFingerprint;
  cloudFingerprint: BackupFingerprint | null;

  constructor(message: string, fingerprint: BackupFingerprint, cloudFingerprint: BackupFingerprint | null) {
    super(message);
    this.name = 'CloudBackupBlockedError';
    this.fingerprint = fingerprint;
    this.cloudFingerprint = cloudFingerprint;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

export async function isCloudBackupOptInLocal(): Promise<boolean> {
  const v = await AsyncStorage.getItem(CLOUD_BACKUP_OPT_IN_KEY);
  return v === 'true';
}

async function setCloudBackupOptInLocal(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(CLOUD_BACKUP_OPT_IN_KEY, enabled ? 'true' : 'false');
  if (enabled) {
    const existing = await AsyncStorage.getItem(OPTED_IN_AT_KEY);
    if (!existing) await AsyncStorage.setItem(OPTED_IN_AT_KEY, new Date().toISOString());
  } else {
    await AsyncStorage.multiRemove([OPTED_IN_AT_KEY, LAST_SUCCESS_KEY]);
  }
}

async function markBackupSuccess(): Promise<void> {
  await AsyncStorage.setItem(LAST_SUCCESS_KEY, new Date().toISOString());
}

export async function fetchCloudBackupStatus(): Promise<CloudBackupStatus> {
  const res = await authFetch('/v1/account/backup/status', { method: 'GET' });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  const body = (await res.json()) as {
    hasBackup: boolean;
    exportedAt: string | null;
    byteSize: number | null;
    fingerprint: BackupFingerprint | null;
    hasPrevious?: boolean;
  };
  if (body.hasBackup) {
    await setCloudBackupOptInLocal(true);
    if (body.exportedAt) {
      const existing = await AsyncStorage.getItem(LAST_SUCCESS_KEY);
      if (!existing) await AsyncStorage.setItem(LAST_SUCCESS_KEY, body.exportedAt);
    }
  }
  const localEnabled = await isCloudBackupOptInLocal();
  return {
    enabled: body.hasBackup && localEnabled,
    hasBackup: body.hasBackup,
    exportedAt: body.exportedAt,
    byteSize: body.byteSize,
    fingerprint: body.fingerprint ?? null,
    hasPrevious: Boolean(body.hasPrevious),
  };
}

export type UploadCloudBackupOpts = {
  /** Skip richness guard (user confirmed force replace). */
  force?: boolean;
};

export async function uploadCloudBackup(
  opts?: UploadCloudBackupOpts,
): Promise<{ byteSize: number; exportedAt: string; fingerprint: BackupFingerprint }> {
  const payload = await buildLocalBackupPayload({ includeWithingsTokens: false });
  const json = JSON.stringify(payload);
  const gzip = deflate(json, { level: 6 });
  const fingerprint = fingerprintFromBackupPayload(payload, gzip.length);

  if (!opts?.force) {
    let cloudFp: BackupFingerprint | null = null;
    try {
      const status = await fetchCloudBackupStatus();
      cloudFp = status.fingerprint;
      if (status.hasBackup) {
        const decision = canOverwriteCloudBackup(fingerprint, cloudFp);
        if (!decision.ok) {
          throw new CloudBackupBlockedError(decision.reason, fingerprint, cloudFp);
        }
      }
    } catch (e) {
      if (e instanceof CloudBackupBlockedError) throw e;
      /* status failed — server still guards */
    }
  }

  const res = await authFetch('/v1/account/backup', {
    method: 'PUT',
    body: JSON.stringify({
      payloadGzipBase64: bytesToBase64(gzip),
      exportedAt: payload.exportedAt,
      fingerprint,
      force: Boolean(opts?.force),
    }),
  });
  if (!res.ok) {
    const msg = await parseError(res);
    if (res.status === 409) {
      throw new CloudBackupBlockedError(msg, fingerprint, null);
    }
    throw new Error(msg);
  }
  await setCloudBackupOptInLocal(true);
  await markBackupSuccess();
  const body = (await res.json()) as {
    byteSize: number;
    exportedAt: string;
    fingerprint?: BackupFingerprint;
  };
  return {
    byteSize: body.byteSize,
    exportedAt: body.exportedAt,
    fingerprint: body.fingerprint ?? fingerprint,
  };
}

export async function purgeCloudBackup(): Promise<void> {
  const res = await authFetch('/v1/account/backup', { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    throw new Error(await parseError(res));
  }
  await setCloudBackupOptInLocal(false);
}

export async function restoreCloudBackup() {
  const res = await authFetch('/v1/account/backup', { method: 'GET' });
  if (res.status === 404) {
    throw new Error('No cloud backup found.');
  }
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  const body = (await res.json()) as { payloadGzipBase64: string };
  if (!body.payloadGzipBase64 || typeof body.payloadGzipBase64 !== 'string') {
    throw new Error('Cloud backup response missing payload.');
  }

  let json: string;
  try {
    const compressed = base64ToBytes(body.payloadGzipBase64);
    // pako@3 always returns Uint8Array — `{ to: 'string' }` is ignored and JSON.parse(bytes)
    // becomes "123,34,…" (comma-separated) → SyntaxError. Decode UTF-8 explicitly.
    const inflated = inflate(compressed);
    json = new TextDecoder('utf-8').decode(inflated);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not decompress cloud backup (${detail}).`);
  }

  let payload: Parameters<typeof applyLocalBackupPayload>[0];
  try {
    payload = JSON.parse(json) as Parameters<typeof applyLocalBackupPayload>[0];
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Cloud backup is not valid JSON after decompress (${detail}).`);
  }

  if (payload?.version !== 1 || payload?.app !== 'healthings-medilab' || !payload.asyncStorage) {
    throw new Error('Invalid cloud backup format.');
  }

  return applyLocalBackupPayload(payload);
}

/**
 * Once per ~24h when opted in. Skips first 24h after enable (fresh-phone safety)
 * unless user already has a successful upload recorded.
 */
export async function maybeRunOpportunisticCloudBackup(): Promise<'skipped' | 'uploaded' | 'blocked' | 'error'> {
  const optedIn = await isCloudBackupOptInLocal();
  if (!optedIn) return 'skipped';

  const lastSuccess = await AsyncStorage.getItem(LAST_SUCCESS_KEY);
  const optedAt = await AsyncStorage.getItem(OPTED_IN_AT_KEY);
  const now = Date.now();

  if (lastSuccess) {
    const lastMs = Date.parse(lastSuccess);
    if (Number.isFinite(lastMs) && now - lastMs < DAY_MS) return 'skipped';
  } else if (optedAt) {
    const optMs = Date.parse(optedAt);
    // After enable with successful upload, LAST_SUCCESS is set.
    // If enable failed mid-way, wait 24h before auto attempt.
    if (Number.isFinite(optMs) && now - optMs < DAY_MS && !lastSuccess) {
      /* allow first upload path from explicit enable; auto skips until lastSuccess */
      return 'skipped';
    }
  }

  try {
    await uploadCloudBackup();
    return 'uploaded';
  } catch (e) {
    if (e instanceof CloudBackupBlockedError) return 'blocked';
    return 'error';
  }
}
