/**
 * be-17 verification against a real Postgres (PGlite = PG16 in WASM), so the
 * destructive statements are exercised rather than reasoned about.
 *
 * The SQL below is copied from the source. assertInSource() fails loudly if the
 * source ever drifts from what is tested here.
 *
 * be-23: overlays are per-org. Revoking one clinic must delete that clinic's
 * workspace and leave the other clinic's intact (case 2b).
 */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Pins a statement that must stay absent, so re-adding it fails the run. */
function assertNotInSource(label, sql, src) {
  if (norm(src).includes(norm(sql))) {
    console.error(`SOURCE DRIFT: ${label}\n  expected NOT to find: ${norm(sql)}`);
    drift++;
  }
}

const SQL_PURGE_LINK = `DELETE FROM sync_update_requests WHERE patient_id = $1 AND mentor_id = $2`;
const SQL_COUNT = `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND status = 'approved'`;
const SQL_COUNT_ORG = `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND org_id = $2 AND status = 'approved'`;
const SQL_DEL_BLOBS = `DELETE FROM sync_blobs WHERE patient_id = $1`;
const SQL_DEL_ORG_OVERLAY = `DELETE FROM clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`;
const SQL_DEL_ORG_CHATS = `DELETE FROM clinic_clinician_chats
     WHERE patient_id = $1
       AND clinician_id IN (SELECT user_id FROM org_members WHERE org_id = $2)`;
const SQL_DEL_ALL_OVERLAYS = `DELETE FROM clinic_org_overlays WHERE patient_id = $1`;
const SQL_DEL_ALL_CHATS = `DELETE FROM clinic_clinician_chats WHERE patient_id = $1`;
const SQL_DEL_ALL_HISTORY = `DELETE FROM clinic_patient_rules_history WHERE patient_id = $1`;
const SQL_PRUNE = `DELETE FROM sync_blobs WHERE patient_id = $1 AND version < $2`;
const SQL_REVOKE = `UPDATE account_shares SET status = 'revoked', revoked_at = NOW(), updated_at = NOW() WHERE id = $1`;

assertInSource('purgeClinicLinkData', SQL_PURGE_LINK, consentSrc);
assertInSource('countConsumers', SQL_COUNT, consentSrc);
assertInSource('count org shares', SQL_COUNT_ORG, consentSrc);
assertInSource('delete blobs', SQL_DEL_BLOBS, consentSrc);
assertInSource('delete org overlay', SQL_DEL_ORG_OVERLAY, consentSrc);
assertInSource('delete org chats', SQL_DEL_ORG_CHATS, consentSrc);
// Per-link purge must NOT delete rules history — it holds versions the patient
// superseded, and its org_id already hides it from other clinics.
assertNotInSource(
  'per-link purge leaves rules history alone',
  `DELETE FROM clinic_patient_rules_history WHERE patient_id = $1 AND org_id = $2`,
  consentSrc,
);
assertInSource('delete all overlays', SQL_DEL_ALL_OVERLAYS, consentSrc);
assertInSource('delete all chats', SQL_DEL_ALL_CHATS, consentSrc);
assertInSource('delete all history', SQL_DEL_ALL_HISTORY, consentSrc);
assertInSource('prune versions', SQL_PRUNE, syncSrc);
assertInSource('revoke update', SQL_REVOKE, sharesSrc);
if (drift) { console.error(`\n${drift} statement(s) drifted from source`); process.exit(1); }
console.log('SQL matches source exactly\n');

const db = new PGlite({ extensions: { citext } });
await db.exec(schema);

const uid = async (email, role) =>
  (await db.query(`INSERT INTO users (email, role) VALUES ($1,$2) RETURNING id`, [email, role]))
    .rows[0].id;

const patient = await uid('patient@example.com', 'patient');
const clinicA = await uid('clinic-a@example.com', 'mentor');
const clinicB = await uid('clinic-b@example.com', 'mentor');

// schema.sql DO block creates one org per mentor on load — but mentors inserted
// after exec need orgs. Mirror ensureMentorOrg.
async function ensureOrg(mentorId, name) {
  const existing = (await db.query(`SELECT org_id FROM org_members WHERE user_id = $1`, [mentorId])).rows[0];
  if (existing) return existing.org_id;
  const orgId = (await db.query(`INSERT INTO organizations (name) VALUES ($1) RETURNING id`, [name])).rows[0].id;
  await db.query(`INSERT INTO org_members (org_id, user_id, role) VALUES ($1,$2,'owner')`, [orgId, mentorId]);
  return orgId;
}

const orgA = await ensureOrg(clinicA, 'Clinic A');
const orgB = await ensureOrg(clinicB, 'Clinic B');

const mkShare = async (mentorId, orgId) =>
  (await db.query(
    `INSERT INTO account_shares (patient_id, patient_email, mentor_id, org_id, status, initiated_by, approved_at)
     VALUES ($1,'patient@example.com',$2,$3,'approved','patient',NOW()) RETURNING id`,
    [patient, mentorId, orgId],
  )).rows[0].id;

async function seedClinicData(mentors) {
  await db.query(`DELETE FROM sync_blobs WHERE patient_id = $1`, [patient]);
  await db.query(`DELETE FROM clinic_org_overlays WHERE patient_id = $1`, [patient]);
  await db.query(`DELETE FROM clinic_clinician_chats WHERE patient_id = $1`, [patient]);
  await db.query(`DELETE FROM clinic_patient_rules_history WHERE patient_id = $1`, [patient]);
  await db.query(`DELETE FROM sync_update_requests WHERE patient_id = $1`, [patient]);
  await db.query(
    `INSERT INTO sync_blobs (patient_id, version, byte_size, payload_hash, summary, payload_gzip)
     VALUES ($1,1,10,'h','{}'::jsonb,'\\x00'::bytea)`, [patient]);
  for (const { mentorId, orgId, rules } of mentors) {
    await db.query(
      `INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_by)
       VALUES ($1,$2,$3::jsonb,$4)`,
      [patient, orgId, JSON.stringify({ rawText: rules }), mentorId]);
    await db.query(
      `INSERT INTO clinic_clinician_chats (patient_id, clinician_id, chat_json)
       VALUES ($1,$2,$3::jsonb)`,
      [patient, mentorId, JSON.stringify({ nutritionist: [{ role: 'user', text: rules, sentAt: '2026-01-01' }] })]);
    await db.query(
      `INSERT INTO clinic_patient_rules_history (patient_id, mentor_id, org_id, rules_json)
       VALUES ($1,$2,$3,'{}'::jsonb)`,
      [patient, mentorId, orgId]);
    await db.query(`INSERT INTO sync_update_requests (patient_id, mentor_id) VALUES ($1,$2)`,
      [patient, mentorId]);
  }
  await db.query(
    `INSERT INTO user_cloud_backups (user_id, payload_gzip, byte_size, payload_hash, exported_at)
     VALUES ($1,'\\x00'::bytea,1,'h',NOW()) ON CONFLICT (user_id) DO NOTHING`, [patient]);
}

async function purgeOrgIfOrphaned(orgId) {
  const n = parseInt((await db.query(SQL_COUNT_ORG, [patient, orgId])).rows[0].n, 10);
  if (n > 0) return;
  await db.query(SQL_DEL_ORG_OVERLAY, [patient, orgId]);
  await db.query(SQL_DEL_ORG_CHATS, [patient, orgId]);
}

/** Mirrors revokeShare() step for step. */
async function revoke(shareId, mentorId, orgId) {
  await db.query(SQL_REVOKE, [shareId]);
  await db.query(`DELETE FROM ai_sponsorships WHERE patient_id = $1 AND sponsor_id = $2`, [patient, mentorId]);
  await db.query(SQL_PURGE_LINK, [patient, mentorId]);
  await purgeOrgIfOrphaned(orgId);
  const n = parseInt((await db.query(SQL_COUNT, [patient])).rows[0].n, 10);
  if (n === 0) {
    await db.query(SQL_DEL_ALL_OVERLAYS, [patient]);
    await db.query(SQL_DEL_ALL_CHATS, [patient]);
    await db.query(SQL_DEL_ALL_HISTORY, [patient]);
    await db.query(SQL_DEL_BLOBS, [patient]);
  }
  return n;
}

const count = async (t, where = 'patient_id', id = patient) =>
  parseInt((await db.query(`SELECT COUNT(*)::text n FROM ${t} WHERE ${where} = $1`, [id])).rows[0].n, 10);

const state = async () => ({
  blobs: await count('sync_blobs'),
  overlays: await count('clinic_org_overlays'),
  chats: await count('clinic_clinician_chats'),
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
let shareA = await mkShare(clinicA, orgA);
await seedClinicData([{ mentorId: clinicA, orgId: orgA, rules: 'A-rules' }]);
check('1 setup: data present', await state(),
  { blobs: 1, overlays: 1, chats: 1, history: 1, requests: 1, backup: 1 });
await revoke(shareA, clinicA, orgA);
check('1 revoke only link -> snapshot, overlay, history deleted; own backup kept',
  await state(), { blobs: 0, overlays: 0, chats: 0, history: 0, requests: 0, backup: 1 });

// --- case 2: two clinics, revoke one -> other clinic's workspace SURVIVES -----
await db.query(`DELETE FROM account_shares WHERE patient_id = $1`, [patient]);
shareA = await mkShare(clinicA, orgA);
const shareB = await mkShare(clinicB, orgB);
await seedClinicData([
  { mentorId: clinicA, orgId: orgA, rules: 'A-rules' },
  { mentorId: clinicB, orgId: orgB, rules: 'B-rules' },
]);
check('2 setup: two links, two workspaces', await state(),
  { blobs: 1, overlays: 2, chats: 2, history: 2, requests: 2, backup: 1 });
await revoke(shareA, clinicA, orgA);
// History stays at 2: the revoked clinic's overlay and chat go, but rules history
// is kept per be-23's revision — it survives until the last link is gone.
check('2 revoke 1 of 2 -> snapshot survives; only revoked clinic overlay and chat dropped',
  await state(), { blobs: 1, overlays: 1, chats: 1, history: 2, requests: 1, backup: 1 });
const survivingHistoryOrgs = (await db.query(
  `SELECT DISTINCT org_id FROM clinic_patient_rules_history WHERE patient_id = $1 ORDER BY org_id`,
  [patient])).rows.map((r) => r.org_id);
check('2 revoked clinic history is kept, still attributed to its own org',
  survivingHistoryOrgs.includes(orgA) && survivingHistoryOrgs.includes(orgB), true);
const survivingReq = (await db.query(
  `SELECT mentor_id FROM sync_update_requests WHERE patient_id = $1`, [patient])).rows[0].mentor_id;
check('2 surviving request belongs to the clinic that was NOT revoked', survivingReq, clinicB);
const survivingOverlay = (await db.query(
  `SELECT org_id, rules_json->>'rawText' AS rules FROM clinic_org_overlays WHERE patient_id = $1`,
  [patient])).rows[0];
check('2 surviving overlay is clinic B only', survivingOverlay, { org_id: orgB, rules: 'B-rules' });
const survivingChat = (await db.query(
  `SELECT clinician_id FROM clinic_clinician_chats WHERE patient_id = $1`, [patient])).rows[0].clinician_id;
check('2 surviving chat is clinic B clinician only', survivingChat, clinicB);

// --- case 3: revoke the last one -> everything goes ---------------------------
await revoke(shareB, clinicB, orgB);
check('3 revoke last link -> all clinic data deleted, own backup kept',
  await state(), { blobs: 0, overlays: 0, chats: 0, history: 0, requests: 0, backup: 1 });

// --- case 4: upload pruning ---------------------------------------------------
await db.query(`DELETE FROM account_shares WHERE patient_id = $1`, [patient]);
await mkShare(clinicA, orgA);
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
