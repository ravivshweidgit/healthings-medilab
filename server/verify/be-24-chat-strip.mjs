/**
 * be-24 — coach chat must not land in sync_blobs.
 *
 * Copies the strip logic from sync.ts and pins the portal so a later
 * reintroduction of chatFromSnapshot / mergeChat fails the run.
 */
import { createHash } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const syncSrc = readFileSync(`${ROOT}/src/services/sync.ts`, 'utf8');
const portalSrc = readFileSync(
  resolve(ROOT, '..', 'website', 'clinic', 'clinic-workspace.js'),
  'utf8',
);

const norm = (s) => s.replace(/\s+/g, ' ').trim();
let drift = 0;
function assertInSource(label, needle, src) {
  if (!norm(src).includes(norm(needle))) {
    console.error(`SOURCE DRIFT: ${label}\n  expected to find: ${norm(needle)}`);
    drift++;
  }
}
function assertNotInSource(label, needle, src) {
  if (norm(src).includes(norm(needle))) {
    console.error(`SOURCE DRIFT: ${label}\n  expected NOT to find: ${norm(needle)}`);
    drift++;
  }
}

assertInSource('strip helper exported', 'export function stripChatHistoryFromSyncPayload', syncSrc);
assertInSource('strip before store', 'const stored = stripChatHistoryFromSyncPayload(payloadGzip)', syncSrc);
assertInSource('hash stored bytes', "createHash('sha256').update(stored)", syncSrc);
assertInSource('inflate cap', 'MAX_INFLATED_BYTES = 64 * 1024 * 1024', syncSrc);
assertNotInSource('portal no chatFromSnapshot', 'chatFromSnapshot', portalSrc);
assertNotInSource('portal no mergeChat', 'function mergeChat', portalSrc);
assertNotInSource('portal no snapshot chat parse', 'fromSnapshot: true', portalSrc);
assertInSource('tab renamed', "label: 'Clinic chat'", portalSrc);

if (drift) {
  console.error(`\n${drift} statement(s) drifted from source`);
  process.exit(1);
}
console.log('Source pins match\n');

/** Mirror of CHAT_HISTORY_KEY + stripChatHistoryFromSyncPayload in sync.ts */
const CHAT_HISTORY_KEY =
  /^chat_history_\d{4}-\d{2}-\d{2}(?:_(doctor|nutritionist|coach))?$/;
const MAX_INFLATED_BYTES = 64 * 1024 * 1024;

function stripChatHistoryFromSyncPayload(payloadGzip) {
  let json;
  try {
    json = inflateSync(payloadGzip).toString('utf8');
  } catch {
    throw Object.assign(new Error('Invalid sync payload'), { status: 400 });
  }
  if (Buffer.byteLength(json, 'utf8') > MAX_INFLATED_BYTES) {
    throw Object.assign(new Error('Payload too large when decompressed'), { status: 413 });
  }
  const parsed = JSON.parse(json);
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

function pack(asyncStorage) {
  return deflateSync(
    Buffer.from(JSON.stringify({ version: 1, app: 'healthings-medilab', asyncStorage }), 'utf8'),
  );
}

function unpack(buf) {
  return JSON.parse(inflateSync(buf).toString('utf8'));
}

let failed = 0;
function check(label, ok) {
  if (ok) console.log(`  OK  ${label}`);
  else {
    console.error(`FAIL  ${label}`);
    failed++;
  }
}

console.log('Strip behaviour');

{
  const incoming = pack({
    'chat_history_2026-07-01_nutritionist': '[{"role":"user","text":"secret"}]',
    'chat_history_2026-07-01_doctor': '[{"role":"user","text":"doc"}]',
    'chat_history_2026-07-02': '[{"role":"user","text":"legacy"}]',
    'food_log_2026-07-01': '[]',
    user_rules: '{"rawText":"keto"}',
    lab_report_1: '{}',
    'healthings:metricsStore': '{}',
    chat_history_backup: 'keep-me',
    'chat_history_2026-7-1': 'lookalike',
  });
  const stored = stripChatHistoryFromSyncPayload(incoming);
  const keys = Object.keys(unpack(stored).asyncStorage).sort();
  check(
    'mentor-suffixed and bare chat_history stripped',
    !keys.some((k) => CHAT_HISTORY_KEY.test(k)),
  );
  check(
    'food_log / user_rules / labs / metrics survive',
    keys.includes('food_log_2026-07-01') &&
      keys.includes('user_rules') &&
      keys.includes('lab_report_1') &&
      keys.includes('healthings:metricsStore'),
  );
  check(
    'lookalike keys left alone',
    keys.includes('chat_history_backup') && keys.includes('chat_history_2026-7-1'),
  );
  const hashStored = createHash('sha256').update(stored).digest('hex');
  const hashIncoming = createHash('sha256').update(incoming).digest('hex');
  check('payload_hash is of stored bytes (differs from received)', hashStored !== hashIncoming);
  check('byte_size is stored length, not received', stored.length !== incoming.length);
}

{
  const incoming = pack({
    'food_log_2026-07-01': '[]',
    user_rules: '{"rawText":"ok"}',
  });
  const stored = stripChatHistoryFromSyncPayload(incoming);
  check('no-chat payload stored byte-identical', Buffer.compare(incoming, stored) === 0);
}

{
  // Inflate-bomb: tiny deflate of a huge string of zeros is hard; instead assert
  // the source still has the cap and a hand-crafted oversize string is rejected.
  const huge = 'x'.repeat(MAX_INFLATED_BYTES + 1);
  const bomb = deflateSync(Buffer.from(huge, 'utf8'));
  let rejected = false;
  try {
    stripChatHistoryFromSyncPayload(bomb);
  } catch (e) {
    rejected = e?.status === 413;
  }
  check('oversized inflated payload rejected (413)', rejected);
}

console.log(failed ? `\n${failed} check(s) failed` : `\nAll checks passed`);
process.exit(failed ? 1 : 0);
