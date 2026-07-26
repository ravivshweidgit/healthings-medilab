/**
 * be-19 account deletion, verified against a real Postgres (PGlite = PG16 in WASM).
 *
 * The question: after a deletion, does any row anywhere still reference the
 * person — and does anyone *else's* data break or linger because they left?
 *
 * Every table in schema.sql is populated before each deletion, so a table that
 * cascades only by accident would show up. SQL is copied from source and
 * assertInSource() fails loudly on drift.
 *
 * be-23: overlays split into clinic_org_overlays + clinic_clinician_chats;
 * patient_access_log is deliberately excluded from residue (no FK, survives).
 */
import { PGlite } from '@electric-sql/pglite';
import { citext } from '@electric-sql/pglite/contrib/citext';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src').replace(/\\/g, '/');
const delSrc = readFileSync(`${SRC}/services/accountDeletion.ts`, 'utf8');
const consentSrc = readFileSync(`${SRC}/services/consent.ts`, 'utf8');
const poolSrc = readFileSync(`${SRC}/db/pool.ts`, 'utf8');
const routesSrc = readFileSync(`${SRC}/routes/account.ts`, 'utf8');
const emailSrc = readFileSync(`${SRC}/services/email.ts`, 'utf8');
const otpSrc = readFileSync(`${SRC}/services/otp.ts`, 'utf8');
const schema = readFileSync(`${SRC}/db/schema.sql`, 'utf8');

const norm = (s) => s.replace(/\s+/g, ' ').trim();
let drift = 0;
function assertInSource(label, needle, src) {
  if (!norm(src).includes(norm(needle))) {
    console.error(`SOURCE DRIFT: ${label}\n  expected: ${norm(needle)}`);
    drift++;
  }
}

/** Pins a statement that must stay absent, so re-adding it fails the run. */
function assertNotInSource(label, needle, src) {
  if (norm(src).includes(norm(needle))) {
    console.error(`SOURCE DRIFT: ${label}\n  expected NOT to find: ${norm(needle)}`);
    drift++;
  }
}

const SQL_AFFECTED = `SELECT DISTINCT patient_id, org_id FROM account_shares
         WHERE mentor_id = $1 AND status = 'approved' AND patient_id IS NOT NULL`;
const SQL_DEL_USER = `DELETE FROM users WHERE id = $1`;
const SQL_DEL_OTP = `DELETE FROM otp_requests WHERE email = $1`;
const SQL_DEL_INVITES = `DELETE FROM account_shares WHERE patient_email = $1 AND patient_id IS NULL`;
const SQL_COUNT_SHARES = `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND status = 'approved'`;
const SQL_COUNT_ORG = `SELECT COUNT(*)::text AS n FROM account_shares
     WHERE patient_id = $1 AND org_id = $2 AND status = 'approved'`;
const SQL_WEB_VIEW = `SELECT web_view_enabled AS on FROM users WHERE id = $1`;
const SQL_DEL_ORG_OVERLAY = `DELETE FROM clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`;
const SQL_DEL_ORG_CHATS = `DELETE FROM clinic_clinician_chats
     WHERE patient_id = $1
       AND clinician_id IN (SELECT user_id FROM org_members WHERE org_id = $2)`;
const SQL_DEL_ALL_OVERLAYS = `DELETE FROM clinic_org_overlays WHERE patient_id = $1`;
const SQL_DEL_ALL_CHATS = `DELETE FROM clinic_clinician_chats WHERE patient_id = $1`;
const SQL_DEL_ALL_HISTORY = `DELETE FROM clinic_patient_rules_history WHERE patient_id = $1`;
const SQL_DEL_BLOBS = `DELETE FROM sync_blobs WHERE patient_id = $1`;
const SQL_MY_ORGS = `SELECT org_id FROM org_members WHERE user_id = $1`;
const SQL_ANON_ORG = `UPDATE organizations SET name = NULL
           WHERE id = $1
             AND NOT EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = $1)`;

assertInSource('affected patients', SQL_AFFECTED, delSrc);
assertInSource('delete user', SQL_DEL_USER, delSrc);
assertInSource('delete otp by email', SQL_DEL_OTP, delSrc);
assertInSource('delete orphaned invites', SQL_DEL_INVITES, delSrc);
assertInSource('purge counts shares', SQL_COUNT_SHARES, consentSrc);
assertInSource('purge counts org shares', SQL_COUNT_ORG, consentSrc);
assertInSource('purge reads web view', SQL_WEB_VIEW, consentSrc);
assertInSource('purge org overlay', SQL_DEL_ORG_OVERLAY, consentSrc);
assertInSource('purge org chats', SQL_DEL_ORG_CHATS, consentSrc);
assertNotInSource(
  'per-link purge leaves rules history alone',
  `DELETE FROM clinic_patient_rules_history WHERE patient_id = $1 AND org_id = $2`,
  consentSrc,
);
// An organizations row is named from display_name || email, and nothing cascades
// into it. Deletion must strip the name or the address outlives the account.
assertInSource('empty org loses its name', SQL_ANON_ORG, delSrc);
assertInSource('orgs are read before the user row goes', SQL_MY_ORGS, delSrc);
assertInSource('purge all overlays', SQL_DEL_ALL_OVERLAYS, consentSrc);
assertInSource('purge all chats', SQL_DEL_ALL_CHATS, consentSrc);
assertInSource('purge all history', SQL_DEL_ALL_HISTORY, consentSrc);
assertInSource('purge blobs', SQL_DEL_BLOBS, consentSrc);
assertInSource(
  'audit log excluded from findResidue',
  'patient_access_log deliberately excluded',
  delSrc,
);

assertInSource('deletion runs in a transaction', 'await withTransaction(', delSrc);
assertInSource('pool exposes withTransaction', 'export async function withTransaction', poolSrc);
assertInSource('transaction begins', `client.query('BEGIN')`, poolSrc);
assertInSource('transaction rolls back', `client.query('ROLLBACK')`, poolSrc);
assertInSource('step-up verifies a code', 'await verifyOtpAndGetEmail(user.email, code)', delSrc);
assertInSource('route uses the checked entry point', 'deleteAccountWithCode(user, body.code)', routesSrc);
assertInSource('invalid code is 422, not 401', 'reply.code(422).send({ error: err.message })', routesSrc);
assertInSource('code endpoint takes email from the token', 'createOtpRequest(user.email, user.role, ', routesSrc);
assertInSource('deletion email has its own copy', `'account-deletion': {`, emailSrc);
assertInSource('deletion email warns, does not say ignore', 'do NOT enter this code', emailSrc);
assertInSource('otp passes purpose through', 'sendOtpEmail(normalized, code, purpose)', otpSrc);

if (drift) {
  console.error(`\n${drift} statement(s) drifted from source`);
  process.exit(1);
}
console.log('SQL and structure match source exactly\n');

const db = new PGlite({ extensions: { citext } });
await db.exec(schema);

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    fail++;
  } else pass++;
}

const countApprovedShares = async (p) =>
  parseInt((await db.query(SQL_COUNT_SHARES, [p])).rows[0]?.n ?? '0', 10);
const webViewEnabled = async (p) => (await db.query(SQL_WEB_VIEW, [p])).rows[0]?.on === true;

async function purgeClinicOrgWorkspaceIfOrphaned(p, orgId) {
  if (!orgId) return false;
  const n = parseInt((await db.query(SQL_COUNT_ORG, [p, orgId])).rows[0]?.n ?? '0', 10);
  if (n > 0) return false;
  await db.query(SQL_DEL_ORG_OVERLAY, [p, orgId]);
  await db.query(SQL_DEL_ORG_CHATS, [p, orgId]);
  return true;
}

async function purgeClinicDataIfNoConsumers(p) {
  const outcome = { clinicWorkspace: false, snapshot: false };
  if ((await countApprovedShares(p)) > 0) return outcome;
  await db.query(SQL_DEL_ALL_OVERLAYS, [p]);
  await db.query(SQL_DEL_ALL_CHATS, [p]);
  await db.query(SQL_DEL_ALL_HISTORY, [p]);
  outcome.clinicWorkspace = true;
  if (await webViewEnabled(p)) return outcome;
  await db.query(SQL_DEL_BLOBS, [p]);
  outcome.snapshot = true;
  return outcome;
}

async function deleteAccount(user) {
  await db.exec('BEGIN');
  let affected, invites, otp;
  try {
    affected = (await db.query(SQL_AFFECTED, [user.id])).rows.map((r) => ({
      patientId: r.patient_id,
      orgId: r.org_id,
    }));
    const myOrgs = (await db.query(SQL_MY_ORGS, [user.id])).rows.map((r) => r.org_id);
    await db.query(SQL_DEL_USER, [user.id]);
    for (const orgId of myOrgs) {
      await db.query(SQL_ANON_ORG, [orgId]);
    }
    otp = await db.query(SQL_DEL_OTP, [user.email]);
    invites = await db.query(SQL_DEL_INVITES, [user.email]);
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  let patientsPurged = 0;
  for (const { patientId, orgId } of affected) {
    if (orgId) await purgeClinicOrgWorkspaceIfOrphaned(patientId, orgId);
    const o = await purgeClinicDataIfNoConsumers(patientId);
    if (o.clinicWorkspace || o.snapshot) patientsPurged++;
  }
  return {
    patientsPurged,
    orphanedInvitesRemoved: invites.affectedRows ?? 0,
    otpRequestsRemoved: otp.affectedRows ?? 0,
  };
}

let seq = 0;
async function mkUser(role, opts = {}) {
  const email = `${role}${++seq}@example.com`;
  const { rows } = await db.query(
    `INSERT INTO users (email, role, web_view_enabled) VALUES ($1, $2, $3) RETURNING id, email, role`,
    [email, role, opts.webView === true],
  );
  const user = rows[0];
  if (role === 'mentor') {
    const orgId = (await db.query(
      `INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
      [email],
    )).rows[0].id;
    await db.query(
      `INSERT INTO org_members (org_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [orgId, user.id],
    );
    user.orgId = orgId;
  }
  return user;
}

async function share(patient, mentor, status = 'approved') {
  await db.query(
    `INSERT INTO account_shares (patient_id, patient_email, mentor_id, org_id, status, initiated_by)
     VALUES ($1, $2, $3, $4, $5, 'patient')`,
    [patient.id, patient.email, mentor.id, mentor.orgId, status],
  );
}

async function invite(email, mentor) {
  await db.query(
    `INSERT INTO account_shares (patient_id, patient_email, mentor_id, org_id, status, initiated_by)
     VALUES (NULL, $1, $2, $3, 'pending', 'mentor')`,
    [email, mentor.id, mentor.orgId],
  );
}

async function fillPatient(p, mentor) {
  await db.query(`INSERT INTO otp_requests (email, code_hash, role, expires_at)
                  VALUES ($1, 'h', 'patient', NOW() + INTERVAL '10 min')`, [p.email]);
  await db.query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
                  VALUES ($1, $2, NOW() + INTERVAL '30 day')`, [p.id, `tok-${p.id}`]);
  await db.query(`INSERT INTO sync_blobs (patient_id, version, byte_size, payload_hash, summary, payload_gzip)
                  VALUES ($1, 1, 10, 'h', '{}'::jsonb, '\\x00')`, [p.id]);
  await db.query(`INSERT INTO user_cloud_backups (user_id, byte_size, payload_hash, exported_at, payload_gzip)
                  VALUES ($1, 10, 'h', NOW(), '\\x00')`, [p.id]);
  await db.query(`INSERT INTO wallets (user_id, balance_tokens) VALUES ($1, 5)`, [p.id]);
  await db.query(`INSERT INTO wallet_ledger (user_id, delta, reason) VALUES ($1, 5, 'topup')`, [p.id]);
  await db.query(`INSERT INTO payment_methods (user_id, stripe_customer_id, card_last4)
                  VALUES ($1, 'cus_x', '4242')`, [p.id]);
  await db.query(`INSERT INTO ai_usage_events (patient_id, payer_user_id, tokens, reason)
                  VALUES ($1, $1, 1, 'chat')`, [p.id]);
  // Audit row that must survive patient deletion (be-23 exception).
  await db.query(
    `INSERT INTO patient_access_log (patient_id, actor_user_id, org_id, action)
     VALUES ($1, $2, $3, 'snapshot.read')`,
    [p.id, mentor?.id ?? null, mentor?.orgId ?? null],
  );
  if (mentor) {
    await db.query(`INSERT INTO ai_sponsorships (patient_id, sponsor_id, expires_at)
                    VALUES ($1, $2, NOW() + INTERVAL '90 day')`, [p.id, mentor.id]);
    await db.query(`INSERT INTO sync_update_requests (patient_id, mentor_id) VALUES ($1, $2)`,
      [p.id, mentor.id]);
    await db.query(`INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_by)
                    VALUES ($1, $2, '{"a":1}'::jsonb, $3)`, [p.id, mentor.orgId, mentor.id]);
    await db.query(`INSERT INTO clinic_clinician_chats (patient_id, clinician_id, chat_json)
                    VALUES ($1, $2, '{"nutritionist":[]}'::jsonb)`, [p.id, mentor.id]);
    await db.query(`INSERT INTO clinic_patient_rules_history (patient_id, mentor_id, org_id, rules_json)
                    VALUES ($1, $2, $3, '{"a":1}'::jsonb)`, [p.id, mentor.id, mentor.orgId]);
  }
}

const count = async (sql, params) =>
  parseInt((await db.query(`SELECT COUNT(*)::text AS n FROM ${sql}`, params)).rows[0].n, 10);

/** Mirrors findResidue: every table that could still name this person — except audit. */
async function residue(user, { countOnly = false } = {}) {
  const tables = [
    ['users', `users WHERE id = $1 OR email = $2`, [user.id, user.email]],
    ['otp_requests', `otp_requests WHERE email = $1`, [user.email]],
    ['account_shares', `account_shares WHERE patient_id = $1 OR mentor_id = $1 OR patient_email = $2`, [user.id, user.email]],
    ['refresh_tokens', `refresh_tokens WHERE user_id = $1`, [user.id]],
    ['sync_blobs', `sync_blobs WHERE patient_id = $1`, [user.id]],
    ['user_cloud_backups', `user_cloud_backups WHERE user_id = $1`, [user.id]],
    ['wallets', `wallets WHERE user_id = $1`, [user.id]],
    ['wallet_ledger', `wallet_ledger WHERE user_id = $1`, [user.id]],
    ['payment_methods', `payment_methods WHERE user_id = $1`, [user.id]],
    ['ai_sponsorships', `ai_sponsorships WHERE patient_id = $1 OR sponsor_id = $1`, [user.id]],
    ['ai_usage_events', `ai_usage_events WHERE patient_id = $1 OR payer_user_id = $1 OR sponsor_id = $1`, [user.id]],
    ['sync_update_requests', `sync_update_requests WHERE patient_id = $1 OR mentor_id = $1`, [user.id]],
    ['clinic_org_overlays', `clinic_org_overlays WHERE patient_id = $1 OR updated_by = $1`, [user.id]],
    ['clinic_clinician_chats', `clinic_clinician_chats WHERE patient_id = $1 OR clinician_id = $1`, [user.id]],
    ['clinic_patient_rules_history', `clinic_patient_rules_history WHERE patient_id = $1 OR mentor_id = $1`, [user.id]],
    ['org_members', `org_members WHERE user_id = $1`, [user.id]],
    // Keyed by name: a one-person org is named from display_name || email.
    ['organizations', `organizations WHERE name = $1`, [user.email]],
    // patient_access_log intentionally omitted from residue
  ];
  if (countOnly) return tables.length;
  const found = [];
  for (const [name, sql, params] of tables) {
    if ((await count(sql, params)) > 0) found.push(name);
  }
  return found;
}

const POPULATED = [
  'users', 'otp_requests', 'account_shares', 'refresh_tokens', 'sync_blobs',
  'user_cloud_backups', 'wallets', 'wallet_ledger', 'payment_methods',
  'ai_sponsorships', 'ai_usage_events', 'sync_update_requests',
  'clinic_org_overlays', 'clinic_clinician_chats', 'clinic_patient_rules_history',
];

// The count is the canary: a table silently dropping out of findResidue is
// exactly how `organizations` stayed invisible until be-23 review.
const RESIDUE_TABLE_COUNT = 17;

console.log('\n1. patient deletes: nothing anywhere still names them');
{
  const clinic = await mkUser('mentor');
  const p = await mkUser('patient');
  await share(p, clinic);
  await fillPatient(p, clinic);
  check('every table populated first', await residue(p), POPULATED);

  const out = await deleteAccount(p);
  check(`residue check still covers all ${RESIDUE_TABLE_COUNT} tables`,
    await residue(p, { countOnly: true }), RESIDUE_TABLE_COUNT);
  check('no residue in clinical tables', await residue(p), []);
  check('audit log rows survive patient deletion',
    await count(`patient_access_log WHERE patient_id = $1`, [p.id]), 1);
  check('the email-keyed otp row was removed', out.otpRequestsRemoved, 1);
  check('deleting a patient purges nobody else', out.patientsPurged, 0);
}

console.log('\n2. rows keyed by email, not by id');
{
  const clinic = await mkUser('mentor');
  const p = await mkUser('patient');
  await invite(p.email, clinic);
  await db.query(`INSERT INTO otp_requests (email, code_hash, role, expires_at)
                  VALUES ($1, 'h', 'patient', NOW() + INTERVAL '10 min')`, [p.email]);
  await db.query(`INSERT INTO otp_requests (email, code_hash, role, expires_at)
                  VALUES ($1, 'h2', 'patient', NOW() + INTERVAL '10 min')`, [p.email]);

  const beforeCascadeOnly = await count(`account_shares WHERE patient_email = $1`, [p.email]);
  check('the invitation exists and is not linked by id', beforeCascadeOnly, 1);

  const out = await deleteAccount(p);
  check('pending invitation removed', out.orphanedInvitesRemoved, 1);
  check('all codes for the address removed', out.otpRequestsRemoved, 2);
  check('no residue', await residue(p), []);
}

console.log('\n3. mentor deletes: patients who lose their last reader are purged');
{
  const clinic = await mkUser('mentor');
  const only = await mkUser('patient');
  const alsoWeb = await mkUser('patient', { webView: true });
  const other = await mkUser('patient');
  const clinic2 = await mkUser('mentor');

  for (const p of [only, alsoWeb, other]) {
    await share(p, clinic);
    await fillPatient(p, clinic);
  }
  await share(other, clinic2);
  await db.query(`INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_by)
                  VALUES ($1, $2, '{"b":1}'::jsonb, $3)`, [other.id, clinic2.orgId, clinic2.id]);

  const out = await deleteAccount(clinic);
  check('two of the three patients were purged', out.patientsPurged, 2);

  check('sole-clinic patient: overlay gone',
    await count(`clinic_org_overlays WHERE patient_id = $1`, [only.id]), 0);
  check('sole-clinic patient: snapshot gone',
    await count(`sync_blobs WHERE patient_id = $1`, [only.id]), 0);

  check('web-view patient: overlay gone (clinic-authored)',
    await count(`clinic_org_overlays WHERE patient_id = $1`, [alsoWeb.id]), 0);
  check('web-view patient: snapshot SURVIVES (they still read it)',
    await count(`sync_blobs WHERE patient_id = $1`, [alsoWeb.id]), 1);

  check('patient with another clinic: departing org overlay gone',
    await count(`clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`, [other.id, clinic.orgId]), 0);
  check('patient with another clinic: surviving org overlay kept',
    await count(`clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`, [other.id, clinic2.orgId]), 1);
  check('patient with another clinic: snapshot kept',
    await count(`sync_blobs WHERE patient_id = $1`, [other.id]), 1);

  check('the mentor leaves no residue', await residue(clinic), []);
  check('patients themselves still exist',
    await count(`users WHERE id IN ($1,$2,$3)`, [only.id, alsoWeb.id, other.id]), 3);
}

console.log('\n4. other people\u2019s records survive with the identity removed');
{
  const clinicA = await mkUser('mentor');
  const clinicB = await mkUser('mentor');
  const p = await mkUser('patient');
  await share(p, clinicA);
  await share(p, clinicB);
  await db.query(`INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_by)
                  VALUES ($1, $2, '{"a":1}'::jsonb, $3)`, [p.id, clinicA.orgId, clinicA.id]);
  await db.query(`INSERT INTO clinic_org_overlays (patient_id, org_id, rules_json, updated_by)
                  VALUES ($1, $2, '{"b":1}'::jsonb, $3)`, [p.id, clinicB.orgId, clinicB.id]);
  await db.query(`INSERT INTO clinic_patient_rules_history (patient_id, mentor_id, org_id, rules_json)
                  VALUES ($1, $2, $3, '{"a":1}'::jsonb)`, [p.id, clinicA.id, clinicA.orgId]);
  await db.query(`INSERT INTO ai_usage_events (patient_id, payer_user_id, sponsor_id, sponsored, reason)
                  VALUES ($1, $1, $2, TRUE, 'chat')`, [p.id, clinicA.id]);
  await db.query(`INSERT INTO wallet_ledger (user_id, delta, reason, payer_user_id)
                  VALUES ($1, 10, 'sponsored', $2)`, [p.id, clinicA.id]);

  await deleteAccount(clinicA);

  check('departing clinic overlay purged',
    await count(`clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`, [p.id, clinicA.orgId]), 0);
  check('surviving clinic keeps its own rules',
    await count(`clinic_org_overlays WHERE patient_id = $1 AND org_id = $2`, [p.id, clinicB.orgId]), 1);
  check('rules history kept, mentor anonymised',
    await count(`clinic_patient_rules_history
                 WHERE patient_id = $1 AND org_id = $2 AND mentor_id IS NULL`,
      [p.id, clinicA.orgId]), 1);
  check('the departing org row loses its name, so the address does not outlive the account',
    await count(`organizations WHERE id = $1 AND name IS NULL`, [clinicA.orgId]), 1);
  check('billing record kept, sponsor anonymised',
    await count(`ai_usage_events WHERE patient_id = $1 AND sponsor_id IS NULL`, [p.id]), 1);
  check('ledger entry kept, payer anonymised',
    await count(`wallet_ledger WHERE user_id = $1 AND payer_user_id IS NULL`, [p.id]), 1);
  check('the departing clinic leaves no residue', await residue(clinicA), []);
}

console.log('\n5. a failure part-way leaves the account intact');
{
  const p = await mkUser('patient');
  await db.query(`INSERT INTO otp_requests (email, code_hash, role, expires_at)
                  VALUES ($1, 'h', 'patient', NOW() + INTERVAL '10 min')`, [p.email]);

  await db.exec('BEGIN');
  await db.query(SQL_DEL_USER, [p.id]);
  check('inside the transaction the user is gone',
    await count(`users WHERE id = $1`, [p.id]), 0);
  await db.exec('ROLLBACK');

  check('after rollback the account is back', await count(`users WHERE id = $1`, [p.id]), 1);
  check('and its codes are still there',
    await count(`otp_requests WHERE email = $1`, [p.email]), 1);
}

console.log('\n6. deletion is scoped to one account');
{
  const clinic = await mkUser('mentor');
  const victim = await mkUser('patient');
  const bystander = await mkUser('patient');
  await share(victim, clinic);
  await share(bystander, clinic);
  await fillPatient(victim, clinic);
  await fillPatient(bystander, clinic);

  await deleteAccount(victim);
  check('bystander keeps every row', await residue(bystander), POPULATED);
  check('victim leaves nothing in clinical tables', await residue(victim), []);
  check('victim audit log survives',
    await count(`patient_access_log WHERE patient_id = $1`, [victim.id]), 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
