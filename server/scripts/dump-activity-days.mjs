/**
 * Dump raw activity fields for one user (cloud backup).
 * Usage: node scripts/dump-activity-days.mjs <email>
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const email = process.argv[2];
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const pool = new pg.Pool({ connectionString: env.match(/^DATABASE_URL=(.+)$/m)[1].trim() });

const { rows: u } = await pool.query(
  'SELECT id, email FROM users WHERE lower(email)=lower($1)',
  [email],
);
if (!u.length) {
  console.error('not found');
  process.exit(1);
}
const { rows: b } = await pool.query(
  'SELECT exported_at, payload_gzip FROM user_cloud_backups WHERE user_id=$1',
  [u[0].id],
);
if (!b.length) {
  console.error('no backup');
  process.exit(1);
}
const p = JSON.parse(inflateSync(b[0].payload_gzip).toString('utf8'));
const as = p.asyncStorage || {};
const mraw = as['healthings:metricsStore'] ?? as['healthings:withingsStore'];
const m = typeof mraw === 'string' ? JSON.parse(mraw) : mraw;
let sc = as['source_config'];
if (typeof sc === 'string') sc = JSON.parse(sc);

const days = [...(m.bodyTrendDays || [])].sort((a, b) =>
  String(a.dayKey || a.date || '').localeCompare(String(b.dayKey || b.date || '')),
);

const rows = days.map((d) => ({
  dayKey: d.dayKey ?? d.date ?? null,
  steps: d.steps ?? null,
  act: d.activityKcalDay ?? null,
  dist: d.distanceKm ?? null,
  wt: d.weightKg ?? null,
  bmr: d.bmrKcalDay ?? d.bmrKcal ?? null,
}));

const actPos = rows.filter((r) => r.act != null && r.act > 0);
const actZero = rows.filter((r) => r.act === 0);
const actNull = rows.filter((r) => r.act == null);
const stepPos = rows.filter((r) => r.steps != null && r.steps > 0);

console.log(
  JSON.stringify(
    {
      email: u[0].email,
      exported_at: b[0].exported_at,
      source_config: sc,
      metricsKeys: Object.keys(m),
      day0Keys: days[0] ? Object.keys(days[0]) : [],
      trendDays: rows.length,
      actPos: actPos.length,
      actZero: actZero.length,
      actNull: actNull.length,
      stepPos: stepPos.length,
      first: rows[0]?.dayKey,
      last: rows[rows.length - 1]?.dayKey,
      firstActPos: actPos[0]?.dayKey,
      lastActPos: actPos[actPos.length - 1]?.dayKey,
      workouts: (m.workouts || []).length,
      last21: rows.slice(-21),
      older10: rows.slice(0, 10),
      mid10: rows.slice(Math.max(0, Math.floor(rows.length / 2) - 5), Math.floor(rows.length / 2) + 5),
    },
    null,
    2,
  ),
);

await pool.end();
