#!/usr/bin/env node
/** List all raviv backups / blobs platform fingerprints. */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url });

function peek(buf) {
  const p = JSON.parse(inflateSync(buf).toString('utf8'));
  const as = p.asyncStorage || {};
  let sc = as.source_config ?? as['source_config'];
  if (typeof sc === 'string') {
    try {
      sc = JSON.parse(sc);
    } catch {
      /* keep */
    }
  }
  const mraw = as['healthings:metricsStore'] ?? as['healthings:withingsStore'];
  const m = mraw ? (typeof mraw === 'string' ? JSON.parse(mraw) : mraw) : null;
  const keys = Object.keys(as);
  const hasHC = keys.some((k) => /health.?connect|hc_/i.test(k));
  const hasHK = keys.some((k) => /healthkit|hk_/i.test(k));
  return {
    exportedAt: p.exportedAt ?? null,
    app: p.app ?? null,
    version: p.version ?? null,
    sourceConfig: sc,
    lastSyncedAt: m?.lastSyncedAt ?? null,
    calN: m?.calories?.length ?? 0,
    woN: m?.workouts?.length ?? 0,
    hasHC,
    hasHK,
    keyHints: keys.filter((k) => /health|platform|device|withings|source/i.test(k)).slice(0, 30),
  };
}

try {
  const { rows: users } = await pool.query(
    `SELECT id, email FROM users WHERE lower(email) LIKE '%raviv%' ORDER BY email`,
  );
  console.log('USERS', users);

  for (const u of users) {
    console.log('\n====', u.email, u.id);
    const { rows: blobs } = await pool.query(
      `SELECT version, created_at, byte_size, payload_gzip FROM sync_blobs WHERE patient_id=$1 ORDER BY version DESC LIMIT 4`,
      [u.id],
    );
    for (const b of blobs) {
      try {
        console.log('BLOB', b.version, b.created_at, JSON.stringify(peek(b.payload_gzip)));
      } catch (e) {
        console.log('BLOB fail', b.version, e.message);
      }
    }
    const { rows: cb } = await pool.query(
      `SELECT exported_at, prev_exported_at, payload_gzip, prev_payload_gzip FROM user_cloud_backups WHERE user_id=$1`,
      [u.id],
    );
    if (cb[0]) {
      console.log('CLOUD_CUR', cb[0].exported_at, JSON.stringify(peek(cb[0].payload_gzip)));
      if (cb[0].prev_payload_gzip) {
        console.log('CLOUD_PREV', cb[0].prev_exported_at, JSON.stringify(peek(cb[0].prev_payload_gzip)));
      }
    }
  }
} finally {
  await pool.end();
}
