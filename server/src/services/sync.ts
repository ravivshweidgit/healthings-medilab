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
import {
  publishPatientWebRulesToOverlays,
  reconcileOverlayRulesFromPatientSnapshot,
  type ClinicUserRules,
} from './clinicOverlay.js';

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
 * be-24 refined 2026-07-27: patient coach chat may rest in the snapshot so
 * /account/ can show it. Strip before any clinic mentor download — never return
 * chat_history_* to clinicians. Old app builds that omit chat are unchanged.
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

/**
 * Keep web-edited My Rules when the phone uploads an older copy
 * (app has not pulled GET /v1/account/rules yet). Compared by analyzedAt.
 */
function mergeNewerServerUserRules(
  incomingGzip: Buffer,
  existingGzip: Buffer | null,
): Buffer {
  if (!existingGzip) return incomingGzip;
  const serverRules = patientRulesFromSyncPayload(existingGzip);
  if (!serverRules?.rawText?.trim() || !serverRules.analyzedAt) return incomingGzip;

  const serverAt = Date.parse(serverRules.analyzedAt);
  if (!Number.isFinite(serverAt)) return incomingGzip;

  let json: string;
  try {
    json = decompressSyncPayload(incomingGzip);
  } catch {
    return incomingGzip;
  }

  let parsed: { asyncStorage?: Record<string, string>; [k: string]: unknown };
  try {
    parsed = JSON.parse(json) as { asyncStorage?: Record<string, string> };
  } catch {
    return incomingGzip;
  }
  if (!parsed.asyncStorage || typeof parsed.asyncStorage !== 'object') {
    parsed.asyncStorage = {};
  }

  const phoneRules = patientRulesFromSyncPayload(incomingGzip);
  const phoneAt = phoneRules?.analyzedAt ? Date.parse(phoneRules.analyzedAt) : 0;
  if (Number.isFinite(phoneAt) && phoneAt >= serverAt) return incomingGzip;
  if (
    phoneRules?.rawText?.trim() &&
    phoneRules.rawText.trim() === serverRules.rawText.trim()
  ) {
    return incomingGzip;
  }

  parsed.asyncStorage.user_rules = JSON.stringify(serverRules);
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
  lookbackMode: '90d' | '128d' | '365d' | 'full';
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

  // Validate inflate size; keep chat_history_* for patient /account/ (stripped for mentors on read).
  try {
    const json = decompressSyncPayload(payloadGzip);
    if (Buffer.byteLength(json, 'utf8') > MAX_INFLATED_BYTES) {
      throw new SyncError('Payload too large when decompressed', 413);
    }
  } catch (err) {
    if (err instanceof SyncError) throw err;
    throw new SyncError('Invalid sync payload', 400);
  }

  let stored = payloadGzip;

  // Prefer newer My Rules already on the server (account web edit) over an
  // older phone copy uploaded before the app pulled GET /v1/account/rules.
  const { rows: prevRows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [user.id],
  );
  stored = mergeNewerServerUserRules(stored, prevRows[0]?.payload_gzip ?? null);
  stored = mergeNewerServerAppChat(stored, prevRows[0]?.payload_gzip ?? null);

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
    // be-24: never hand patient coach transcripts to a clinician.
    payloadGzipBase64: stripChatHistoryFromSyncPayload(row.payload_gzip).toString('base64'),
  };
}

/**
 * The patient's own snapshot, payload included. Same meals/metrics a clinic
 * would see, plus coach chat for /account/ self-view (clinic downloads strip chat).
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

async function assertPatientWebViewOn(user: PublicUser): Promise<void> {
  if (user.role !== 'patient') {
    throw new SyncError('Only patients can manage their own rules here', 403);
  }
  const { rows: flag } = await query<{ on: boolean }>(
    `SELECT web_view_enabled AS on FROM users WHERE id = $1`,
    [user.id],
  );
  if (flag[0]?.on !== true) {
    throw new SyncError('Turn on your web view to manage rules here', 403);
  }
}

/** Latest My Rules from the patient's own sync blob (web-view gated). */
export async function getPatientRulesFromLatestBlob(
  user: PublicUser,
): Promise<ClinicUserRules | null> {
  await assertPatientWebViewOn(user);

  const { rows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [user.id],
  );
  const row = rows[0];
  if (!row) return null;
  return patientRulesFromSyncPayload(row.payload_gzip);
}

/**
 * Patch user_rules inside the latest sync blob and bump version.
 * Phone pulls via GET /v1/account/rules so the next upload does not wipe web edits.
 */
export async function updatePatientRulesInLatestBlob(
  user: PublicUser,
  rawText: string,
): Promise<ClinicUserRules> {
  await assertPatientWebViewOn(user);

  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new SyncError('Rules text is required', 400);
  }

  const { rows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [user.id],
  );
  const row = rows[0];
  if (!row) {
    throw new SyncError('No snapshot yet — open the app once with web view on', 404);
  }

  let json: string;
  try {
    json = decompressSyncPayload(row.payload_gzip);
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
  if (!parsed.asyncStorage || typeof parsed.asyncStorage !== 'object') {
    parsed.asyncStorage = {};
  }

  const rules: ClinicUserRules = {
    rawText: trimmed,
    summary: '',
    constraints: [],
    analyzedAt: new Date().toISOString(),
  };
  parsed.asyncStorage.user_rules = JSON.stringify(rules);

  const stored = deflateSync(Buffer.from(JSON.stringify(parsed), 'utf8'));
  const version = await nextVersion(user.id);
  const payloadHash = createHash('sha256').update(stored).digest('hex');

  await query<SyncRow>(
    `INSERT INTO sync_blobs (patient_id, version, byte_size, payload_hash, summary, payload_gzip)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user.id, version, stored.length, payloadHash, row.summary, stored],
  );
  await query(`DELETE FROM sync_blobs WHERE patient_id = $1 AND version < $2`, [user.id, version]);

  // Publish to org overlays (do not clear them). Phone pulls clinic overlays;
  // clearing here made account Save look broken while clinic Save worked.
  try {
    await publishPatientWebRulesToOverlays(user.id, rules, user.id);
  } catch {
    // Non-fatal: rules still saved in the blob; phone can use GET /v1/account/rules.
  }

  return rules;
}

export type AppChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  sentAt: string;
};

const APP_CHAT_MAX_MESSAGES = 1000;

function parseAppChatMessages(raw: string | undefined): AppChatMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AppChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.text === 'string' &&
        m.text.trim(),
    );
  } catch {
    return [];
  }
}

function lastChatSentAt(msgs: AppChatMessage[]): number {
  let max = 0;
  for (const m of msgs) {
    const t = Date.parse(m.sentAt || '');
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max;
}

function collectMentorThread(
  store: Record<string, string>,
  mentorType: string,
  dayKey?: string,
): AppChatMessage[] {
  const out: AppChatMessage[] = [];
  for (const [key, raw] of Object.entries(store)) {
    const m = key.match(/^chat_history_(\d{4}-\d{2}-\d{2})(?:_(doctor|nutritionist|coach))?$/);
    if (!m) continue;
    if (dayKey && m[1] !== dayKey) continue;
    const mentor = m[2] || 'nutritionist';
    if (mentor !== mentorType) continue;
    out.push(...parseAppChatMessages(raw));
  }
  out.sort((a, b) => (Date.parse(a.sentAt) || 0) - (Date.parse(b.sentAt) || 0));
  return out;
}

function localeFromSnapshotStore(store: Record<string, string>): string | null {
  const raw = store.user_language;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { code?: string; label?: string };
    if (parsed?.code) return String(parsed.code).slice(0, 8).toLowerCase();
  } catch {
    const s = raw.replace(/^"|"$/g, '').trim().toLowerCase();
    if (s.length >= 2 && s.length <= 8) return s.slice(0, 8);
  }
  return null;
}

/**
 * App → account chat is today-only (no history pile-up).
 * Keep web messages for that day when they are newer than the phone copy;
 * drop every other chat_history_* day from the stored blob.
 */
function mergeNewerServerAppChat(
  incomingGzip: Buffer,
  existingGzip: Buffer | null,
): Buffer {
  let phoneJson: string;
  try {
    phoneJson = decompressSyncPayload(incomingGzip);
  } catch {
    return incomingGzip;
  }

  let phoneParsed: { asyncStorage?: Record<string, string>; [k: string]: unknown };
  try {
    phoneParsed = JSON.parse(phoneJson) as { asyncStorage?: Record<string, string> };
  } catch {
    return incomingGzip;
  }
  if (!phoneParsed.asyncStorage || typeof phoneParsed.asyncStorage !== 'object') {
    phoneParsed.asyncStorage = {};
  }
  const phoneStore = phoneParsed.asyncStorage;

  let serverStore: Record<string, string> = {};
  if (existingGzip) {
    try {
      const serverParsed = JSON.parse(decompressSyncPayload(existingGzip)) as {
        asyncStorage?: Record<string, string>;
      };
      if (serverParsed.asyncStorage && typeof serverParsed.asyncStorage === 'object') {
        serverStore = serverParsed.asyncStorage;
      }
    } catch {
      serverStore = {};
    }
  }

  const phoneDays = Object.keys(phoneStore)
    .map((k) => {
      const m = k.match(/^chat_history_(\d{4}-\d{2}-\d{2})/);
      return m?.[1] ?? null;
    })
    .filter((d): d is string => !!d)
    .sort();
  const keepDay = phoneDays.length > 0 ? phoneDays[phoneDays.length - 1]! : new Date().toISOString().slice(0, 10);

  const mentors = ['doctor', 'nutritionist', 'coach'] as const;
  const nextChat: Record<string, string> = {};
  for (const mentor of mentors) {
    const key = `chat_history_${keepDay}_${mentor}`;
    const legacyKey = `chat_history_${keepDay}`;
    const serverMsgs = [
      ...parseAppChatMessages(serverStore[key]),
      ...(mentor === 'nutritionist' ? parseAppChatMessages(serverStore[legacyKey]) : []),
    ];
    const phoneMsgs = [
      ...parseAppChatMessages(phoneStore[key]),
      ...(mentor === 'nutritionist' ? parseAppChatMessages(phoneStore[legacyKey]) : []),
    ];
    let chosen = phoneMsgs;
    if (serverMsgs.length && (!phoneMsgs.length || lastChatSentAt(serverMsgs) > lastChatSentAt(phoneMsgs))) {
      chosen = serverMsgs;
    }
    if (chosen.length) nextChat[key] = JSON.stringify(chosen);
  }

  let changed = false;
  for (const key of Object.keys(phoneStore)) {
    if (CHAT_HISTORY_KEY.test(key)) {
      delete phoneStore[key];
      changed = true;
    }
  }
  for (const [key, raw] of Object.entries(nextChat)) {
    if (phoneStore[key] !== raw) {
      phoneStore[key] = raw;
      changed = true;
    }
  }
  if (!changed) return incomingGzip;
  return deflateSync(Buffer.from(JSON.stringify(phoneParsed), 'utf8'));
}

export async function loadPatientAppChatThread(
  user: PublicUser,
  mentorType: string,
  dayKey?: string,
): Promise<{ priorThread: AppChatMessage[]; replyLocale: string | null }> {
  await assertPatientWebViewOn(user);

  const { rows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [user.id],
  );
  const row = rows[0];
  if (!row) {
    throw new SyncError('No snapshot yet — open the app once with web view on', 404);
  }

  let parsed: { asyncStorage?: Record<string, string> };
  try {
    parsed = JSON.parse(decompressSyncPayload(row.payload_gzip)) as {
      asyncStorage?: Record<string, string>;
    };
  } catch {
    throw new SyncError('Invalid sync payload', 400);
  }
  const store = parsed.asyncStorage || {};
  const day = dayKey || new Date().toISOString().slice(0, 10);
  return {
    priorThread: collectMentorThread(store, mentorType, day),
    replyLocale: localeFromSnapshotStore(store),
  };
}

export async function appendPatientAppChatMessages(
  user: PublicUser,
  mentorType: string,
  dayKey: string,
  userMsg: AppChatMessage,
  assistantMsg: AppChatMessage,
): Promise<AppChatMessage[]> {
  await assertPatientWebViewOn(user);

  const { rows } = await query<SyncRow>(
    `SELECT * FROM sync_blobs
     WHERE patient_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [user.id],
  );
  const row = rows[0];
  if (!row) {
    throw new SyncError('No snapshot yet — open the app once with web view on', 404);
  }

  let json: string;
  try {
    json = decompressSyncPayload(row.payload_gzip);
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
  if (!parsed.asyncStorage || typeof parsed.asyncStorage !== 'object') {
    parsed.asyncStorage = {};
  }

  const key = `chat_history_${dayKey}_${mentorType}`;
  const dayMsgs = parseAppChatMessages(parsed.asyncStorage[key]);
  dayMsgs.push(userMsg, assistantMsg);
  // Today-only: drop other days so account chat does not pile history.
  for (const k of Object.keys(parsed.asyncStorage)) {
    if (CHAT_HISTORY_KEY.test(k) && k !== key) {
      delete parsed.asyncStorage[k];
    }
  }
  parsed.asyncStorage[key] = JSON.stringify(dayMsgs.slice(-APP_CHAT_MAX_MESSAGES));

  const stored = deflateSync(Buffer.from(JSON.stringify(parsed), 'utf8'));
  const version = await nextVersion(user.id);
  const payloadHash = createHash('sha256').update(stored).digest('hex');

  await query(
    `INSERT INTO sync_blobs (patient_id, version, byte_size, payload_hash, summary, payload_gzip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [user.id, version, stored.length, payloadHash, row.summary, stored],
  );
  await query(`DELETE FROM sync_blobs WHERE patient_id = $1 AND version < $2`, [user.id, version]);

  return collectMentorThread(parsed.asyncStorage, mentorType, dayKey);
}
