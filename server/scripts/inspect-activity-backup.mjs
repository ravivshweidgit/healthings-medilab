/**
 * Activity kcal / steps span in cloud backup (+ clinic sync blob).
 * Usage (on VPS): node scripts/inspect-activity-backup.mjs <email>
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/inspect-activity-backup.mjs <email>');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const pool = new pg.Pool({ connectionString: env.match(/^DATABASE_URL=(.+)$/m)[1].trim() });

function parsePayload(buf) {
  const p = JSON.parse(inflateSync(buf).toString('utf8'));
  const as = p.asyncStorage || {};
  const mraw = as['healthings:metricsStore'] ?? as['healthings:withingsStore'];
  const m = typeof mraw === 'string' ? JSON.parse(mraw) : mraw;
  let sc = as['source_config'];
  if (typeof sc === 'string') {
    try {
      sc = JSON.parse(sc);
    } catch {
      /* keep raw */
    }
  }
  return { exportedAt: p.exportedAt ?? null, metrics: m, sourceConfig: sc };
}

function activityReport(metrics, label) {
  const days = [...(metrics?.bodyTrendDays || [])].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  const rows = days.map((d) => ({
    date: d.date,
    steps: d.steps ?? null,
    act: d.activityKcalDay ?? null,
    wt: d.weightKg ?? null,
  }));
  const pos = rows.filter((r) => r.act != null && r.act > 0);
  const zero = rows.filter((r) => r.act === 0);
  const nul = rows.filter((r) => r.act == null);
  const stepPos = rows.filter((r) => r.steps != null && r.steps > 0);

  // Find longest trailing positive streak and whether older days are zero/null
  let trailingPos = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].act != null && rows[i].act > 0) trailingPos++;
    else break;
  }

  const workouts = metrics?.workouts || [];
  const wDates = [
    ...new Set(workouts.map((w) => String(w.startDate || w.timestamp || '').slice(0, 10)).filter(Boolean)),
  ].sort();

  console.log(`==== ${label} ====`);
  console.log(
    JSON.stringify(
      {
        trendDays: rows.length,
        withActPositive: pos.length,
        withActZero: zero.length,
        withActNull: nul.length,
        withStepsPositive: stepPos.length,
        firstDate: rows[0]?.date ?? null,
        lastDate: rows[rows.length - 1]?.date ?? null,
        firstActPositive: pos[0]?.date ?? null,
        lastActPositive: pos[pos.length - 1]?.date ?? null,
        trailingPositiveDays: trailingPos,
        workouts: workouts.length,
        workoutDaysLast10: wDates.slice(-10),
        last21: rows.slice(-21),
        olderSample: rows.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

try {
  const { rows: users } = await pool.query(
    `SELECT id, email, role, created_at FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  if (!users.length) {
    console.error('User not found:', email);
    process.exit(1);
  }
  console.log('USER', JSON.stringify(users[0]));

  const { rows: backups } = await pool.query(
    `SELECT exported_at, prev_exported_at, byte_size, payload_gzip, prev_payload_gzip
     FROM user_cloud_backups WHERE user_id = $1`,
    [users[0].id],
  );
  if (!backups.length) {
    console.log('CLOUD_BACKUP: none');
  } else {
    const b = backups[0];
    console.log(
      'CLOUD_BACKUP meta',
      JSON.stringify({
        exported_at: b.exported_at,
        prev_exported_at: b.prev_exported_at,
        byte_size: b.byte_size,
      }),
    );
    const cur = parsePayload(b.payload_gzip);
    console.log('source_config', JSON.stringify(cur.sourceConfig));
    activityReport(cur.metrics, 'cloud CURRENT');
    if (b.prev_payload_gzip) {
      const prev = parsePayload(b.prev_payload_gzip);
      activityReport(prev.metrics, 'cloud PREV');
    }
  }

  const { rows: blobs } = await pool.query(
    `SELECT version, byte_size, created_at, payload_gzip
     FROM sync_blobs WHERE patient_id = $1 ORDER BY version DESC LIMIT 1`,
    [users[0].id],
  );
  if (!blobs.length) {
    console.log('SYNC_BLOB: none');
  } else {
    console.log(
      'SYNC_BLOB meta',
      JSON.stringify({
        version: blobs[0].version,
        created_at: blobs[0].created_at,
        byte_size: blobs[0].byte_size,
      }),
    );
    const cur = parsePayload(blobs[0].payload_gzip);
    console.log('source_config', JSON.stringify(cur.sourceConfig));
    activityReport(cur.metrics, 'clinic sync CURRENT');
  }
} finally {
  await pool.end();
}
