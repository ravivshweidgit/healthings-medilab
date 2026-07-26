/**
 * HR span in cloud backup (+ clinic sync blob) for a patient.
 * Usage (on VPS): node scripts/inspect-hr-backup.mjs [email]
 * Default: raviv.shweid@gmail.com
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const email = process.argv[2] || 'raviv.shweid@gmail.com';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const pool = new pg.Pool({ connectionString: env.match(/^DATABASE_URL=(.+)$/m)[1].trim() });

function dayKey(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function hrSummary(metrics, label) {
  const hr = metrics?.heartRate || [];
  if (!hr.length) {
    return { label, points: 0, first: null, last: null, spanDays: 0, daysWithHr: 0 };
  }
  const sorted = [...hr].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const first = sorted[0].timestamp;
  const last = sorted[sorted.length - 1].timestamp;
  const days = new Set(sorted.map((p) => dayKey(p.timestamp)));
  const spanMs = Date.parse(last) - Date.parse(first);
  return {
    label,
    points: hr.length,
    first,
    last,
    spanDays: Math.round(spanMs / (24 * 60 * 60 * 1000) * 10) / 10,
    daysWithHr: days.size,
    sampleDays: [...days].sort().slice(0, 5).concat(['…']).concat([...days].sort().slice(-5)),
  };
}

function loadMetrics(buf) {
  const p = JSON.parse(inflateSync(buf).toString('utf8'));
  const as = p.asyncStorage || {};
  const mraw = as['healthings:metricsStore'] ?? as['healthings:withingsStore'];
  const m = typeof mraw === 'string' ? JSON.parse(mraw) : mraw;
  return { exportedAt: p.exportedAt ?? null, metrics: m, lookbackMode: p.lookbackMode ?? null };
}

try {
  const { rows: users } = await pool.query(
    `SELECT id, email, role FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  if (!users.length) {
    console.error('User not found:', email);
    process.exit(1);
  }
  const user = users[0];
  console.log('USER', JSON.stringify(user));

  const { rows: backups } = await pool.query(
    `SELECT exported_at, prev_exported_at, byte_size, prev_byte_size,
            payload_gzip, prev_payload_gzip, fingerprint
     FROM user_cloud_backups WHERE user_id = $1`,
    [user.id],
  );
  if (!backups.length) {
    console.log('CLOUD_BACKUP: none');
  } else {
    const b = backups[0];
    const cur = loadMetrics(b.payload_gzip);
    const prev = b.prev_payload_gzip ? loadMetrics(b.prev_payload_gzip) : null;
    console.log(
      'CLOUD_BACKUP\n' +
        JSON.stringify(
          {
            exported_at: b.exported_at,
            byte_size: b.byte_size,
            prev_exported_at: b.prev_exported_at,
            prev_byte_size: b.prev_byte_size,
            fingerprint: b.fingerprint,
            payloadExportedAt: cur.exportedAt,
            current: hrSummary(cur.metrics, 'cloud.current'),
            previous: prev ? hrSummary(prev.metrics, 'cloud.prev') : null,
          },
          null,
          2,
        ),
    );
  }

  const { rows: blobs } = await pool.query(
    `SELECT version, byte_size, created_at, payload_gzip, summary
     FROM sync_blobs WHERE patient_id = $1 ORDER BY version DESC LIMIT 1`,
    [user.id],
  );
  if (!blobs.length) {
    console.log('CLINIC_SYNC: none');
  } else {
    const row = blobs[0];
    const cur = loadMetrics(row.payload_gzip);
    console.log(
      'CLINIC_SYNC\n' +
        JSON.stringify(
          {
            version: row.version,
            created_at: row.created_at,
            byte_size: row.byte_size,
            lookbackMode: cur.lookbackMode,
            summary: row.summary,
            hr: hrSummary(cur.metrics, 'sync.latest'),
          },
          null,
          2,
        ),
    );
  }
} finally {
  await pool.end();
}
