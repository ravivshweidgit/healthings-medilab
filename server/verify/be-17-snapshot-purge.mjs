/**
 * be-17 verification against a real Postgres (PGlite = PG16 in WASM), so the
 * destructive statements are exercised rather than reasoned about.
 *
 * The SQL below is copied from the source. assertInSource() fails loudly if the
 * source ever drifts from what is tested here.
 */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from this file, not a hardcoded path — this harness is the gate for
// later batches and has to run on any machine and in CI.
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src').replace(/\\/g, '/');
const consentSrc = readFileSync(`${SRC}/services/consent.ts`, 'utf8');
const syncSrc = readFileSync(`${SRC}/services/sync.ts`, 'utf8');
const sharesSrc = readFileSync(`${SRC}/services/shares.ts`, 'utf8');
const schema = readFileSync(`${SRC}/db/schema.sql`, 'utf8');

const norm = (s) => s.replace(/\s+/g, ' ').trim();
let drift = 0;
function assertInSource(label, sql, src) {
  if (!norm(src).includes(norm(sql))) {
    console.error(`SOURCE DRIFT: ${label}\n  expected to find: ${norm(sql)}`);
    drift++;
  }
}

// --- the exact statements under test -----------------------------------------
const SQL_PURGE_LINK = `DELETE FROM sync_update_requests WHERE patient_id = $1 AND mentor_id = $2`;
const SQL_COUNT = `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND status = 'approved'`;
const SQL_DEL_BLOBS = `DELETE FROM sync_blobs WHERE patient_id = $1`;
const SQL_DEL_OVERLAY = `DELETE FROM clinic_patient_overlays WHERE patient_id = $1`;
const SQL_DEL_HISTORY = `DELETE FROM clinic_patient_rules_history WHERE patient_id = $1`;
const SQL_PRUNE = `DELETE FROM sync_blobs WHERE patient_id = $1 AND version < $2`;
const SQL_REVOKE = `UPDATE account_shares SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() WHERE id = $1`;

assertInSource('purgeClinicLinkData', SQL_PURGE_LINK, consentSrc);
assertInSource('countConsumers', SQL_COUNT, consentSrc);
assertInSource('delete blobs', SQL_DEL_BLOBS, consentSrc);
assertInSource('delete overlay', SQL_DEL_OVERLAY, consentSrc);
assertInSource('delete history', SQL_DEL_HISTORY, consentSrc);
assertInSource('prune versions', SQL_PRUNE, syncSrc);
assertInSource('revoke update', SQL_REVOKE, sharesSrc);
if (drift) { console.error(`\n${drift} statement(s) drifted from source`); process.exit(1); }
console.log('SQL matches source exactly\n');

const db = new PGlite({ extensions: { citext } });
await db.exec(schema);

// --- fixtures -----------------------------------------------------------------
const uid = async (email, role) =>
  (await db.query(`INSERT INTO users (email, role) VALUES ($1,$2) RETURNING id`, [email, role]))
    .rows[0].id;

const patient = await uid('patient@example.com', 'patient');
const clinicA = await uid('clinic-a@example.com', 'mentor');
const clinicB = await uid('clinic-b@example.com', 'mentor');

const mkShare = async (mentorId) =>
  (await db.query(
    `INSERT INTO account_shares (patient_id, patient_email, mentor_id, status, initiated_by, approved_at)
     VALUES ($1,'patient@example.com',$2,'approved','patient',NOW()) RETURNING id`,
    [patient, mentorId],
  )).rows[0].id;

async function seedClinicData(mentorIds) {
  await db.query(`DELETE FROM sync_blobs WHERE patient_id = $1`, [patient]);
  await db.query(`DELETE FROM clinic_patient_overlays WHERE patient_id = $1`, [patient]);
  await db.query(`DELETE FROM clinic_patient_rules_history WHERE patient_id = $1`, [patient]);
  await db.query(`DELETE FROM sync_update_requests WHERE patient_id = $1`, [patient]);
  await db.query(
    `INSERT INTO sync_blobs (patient_id, version, byte_size, payload_hash, summary, payload_gzip)
     VALUES ($1,1,10,'h','{}'::jsonb,'\\x00'::bytea)`, [patient]);
  await db.query(
    `INSERT INTO clinic_patient_overlays (patient_id, rules_json) VALUES ($1,'{"rawText":"x"}'::jsonb)`,
    [patient]);
  for (const m of mentorIds) {
    await db.query(
      `INSERT INTO clinic_patient_rules_history (patient_id, mentor_id, rules_json) VALUES ($1,$2,'{}'::jsonb)`,
      [patient, m]);
    await db.query(`INSERT INTO sync_update_requests (patient_id, mentor_id) VALUES ($1,$2)`,
      [patient, m]);
  }
  await db.query(
    `INSERT INTO user_cloud_backups (user_id, payload_gzip, byte_size, payload_hash, exported_at)
     VALUES ($1,'\\x00'::bytea,1,'h',NOW()) ON CONFLICT (user_id) DO NOTHING`, [patient]);
}

/** Mirrors revokeShare() step for step. */
async function revoke(shareId, mentorId) {
  await db.query(SQL_REVOKE, [shareId]);
  await db.query(`DELETE FROM ai_sponsorships WHERE patient_id = $1 AND sponsor_id = $2`, [patient, mentorId]);
  await db.query(SQL_PURGE_LINK, [patient, mentorId]);
  const n = parseInt((await db.query(SQL_COUNT, [patient])).rows[0].n, 10);
  if (n === 0) {
    await db.query(SQL_DEL_BLOBS, [patient]);
    await db.query(SQL_DEL_OVERLAY, [patient]);
    await db.query(SQL_DEL_HISTORY, [patient]);
  }
  return n;
}

const count = async (t, where = 'patient_id', id = patient) =>
  parseInt((await db.query(`SELECT COUNT(*)::text n FROM ${t} WHERE ${where} = $1`, [id])).rows[0].n, 10);

const state = async () => ({
  blobs: await count('sync_blobs'),
  overlay: await count('clinic_patient_overlays'),
  history: await count('clinic_patient_rules_history'),
  requests: await count('sync_update_requests'),
  backup: await count('user_cloud_backups', 'user_id'),
});

const results = [];
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, pass, actual, expected });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
  if (!pass) console.log(`      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
}

// --- case 1: one clinic, revoke it -> everything goes -------------------------
let shareA = await mkShare(clinicA);
await seedClinicData([clinicA]);
check('1 setup: data present', await state(), { blobs: 1, overlay: 1, history: 1, requests: 1, backup: 1 });
await revoke(shareA, clinicA);
check('1 revoke only link -> snapshot, overlay, history deleted; own backup kept',
  await state(), { blobs: 0, overlay: 0, history: 0, requests: 0, backup: 1 });

// --- case 2: two clinics, revoke one -> snapshot SURVIVES ---------------------
await db.query(`DELETE FROM account_shares WHERE patient_id = $1`, [patient]);
shareA = await mkShare(clinicA);
const shareB = await mkShare(clinicB);
await seedClinicData([clinicA, clinicB]);
check('2 setup: two links, two requests', await state(), { blobs: 1, overlay: 1, history: 2, requests: 2, backup: 1 });
await revoke(shareA, clinicA);
check('2 revoke 1 of 2 -> snapshot/overlay/history SURVIVE, only that link\'s request dropped',
  await state(), { blobs: 1, overlay: 1, history: 2, requests: 1, backup: 1 });
const survivingReq = (await db.query(
  `SELECT mentor_id FROM sync_update_requests WHERE patient_id = $1`, [patient])).rows[0].mentor_id;
check('2 surviving request belongs to the clinic that was NOT revoked', survivingReq, clinicB);

// --- case 3: revoke the last one -> everything goes ---------------------------
await revoke(shareB, clinicB);
check('3 revoke last link -> all clinic data deleted, own backup kept',
  await state(), { blobs: 0, overlay: 0, history: 0, requests: 0, backup: 1 });

// --- case 4: upload pruning ---------------------------------------------------
await db.query(`DELETE FROM account_shares WHERE patient_id = $1`, [patient]);
await mkShare(clinicA);
for (const v of [1, 2, 3]) {
  const next = (await db.query(`SELECT MAX(version) AS max FROM sync_blobs WHERE patient_id = $1`, [patient]))
    .rows[0].max ?? 0;
  const version = next + 1;
  await db.query(
    `INSERT INTO sync_blobs (patient_id, version, byte_size, payload_hash, summary, payload_gzip)
     VALUES ($1,$2,10,'h','{}'::jsonb,'\\x00'::bytea)`, [patient, version]);
  await db.query(SQL_PRUNE, [patient, version]);
}
const rows = (await db.query(`SELECT version FROM sync_blobs WHERE patient_id = $1 ORDER BY version`, [patient])).rows;
check('4 three uploads -> exactly one row, at the newest version',
  rows.map((r) => r.version), [3]);

// --- case 5: guard against a patient-less share -------------------------------
const before = await state();
await db.query(SQL_PURGE_LINK, [patient, clinicB]);
check('5 purging a link with no pending request is a no-op', await state(),
  { ...before, requests: 0 });

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
