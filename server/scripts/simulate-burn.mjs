#!/usr/bin/env node
/** Simulate Dashboard withingsActivityForDay from cloud metrics. */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const email = process.argv[2] || 'raviv.shweid@gmail.com';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url });
const BUCKET_MS = 30 * 60 * 1000;

function dayKeyLocal(ms) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function withingsActivityForDay(dk, calories, workouts) {
  const wktBuckets = new Set();
  let wktKcal = 0;
  for (const w of workouts) {
    if (w.source === 'health-connect') continue;
    if (dayKeyLocal(w.startMs) !== dk) continue;
    wktKcal += w.kcal;
    const firstBk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS;
    for (let bk = firstBk; bk < w.endMs; bk += BUCKET_MS) wktBuckets.add(bk);
  }
  let passiveKcal = 0;
  let passiveSkipped = 0;
  let passivePts = 0;
  for (const pt of calories) {
    const t = new Date(pt.timestamp).getTime();
    if (dayKeyLocal(t) !== dk) continue;
    passivePts += 1;
    const bk = Math.floor(t / BUCKET_MS) * BUCKET_MS;
    if (!wktBuckets.has(bk)) passiveKcal += pt.kcal;
    else passiveSkipped += pt.kcal;
  }
  return {
    passiveKcal: Math.round(passiveKcal * 10) / 10,
    passiveSkipped: Math.round(passiveSkipped * 10) / 10,
    passivePts,
    wktKcal,
    wktBuckets: wktBuckets.size,
    activity: Math.round(passiveKcal + wktKcal),
  };
}

try {
  const { rows } = await pool.query(
    `SELECT u.payload_gzip, u.exported_at
     FROM user_cloud_backups u
     JOIN users us ON us.id = u.user_id
     WHERE lower(us.email) = lower($1)`,
    [email],
  );
  const p = JSON.parse(inflateSync(rows[0].payload_gzip).toString('utf8'));
  const mraw = p.asyncStorage['healthings:metricsStore'];
  const m = typeof mraw === 'string' ? JSON.parse(mraw) : mraw;

  const days = ['2026-07-17', '2026-07-18', '2026-07-19'];
  const out = {};
  for (const dk of days) {
    const act = withingsActivityForDay(dk, m.calories || [], m.workouts || []);
    const trend = (m.bodyTrendDays || []).find((d) => d.dayKey === dk);
    const bmr = trend?.bmrKcalDay ?? null;
    out[dk] = {
      ...act,
      bmr,
      totalBurn: bmr != null ? bmr + act.activity : null,
      // naive max path (trend chart style)
      maxPassiveOrWkt: Math.round(Math.max(
        (m.calories || [])
          .filter((pt) => dayKeyLocal(Date.parse(pt.timestamp)) === dk)
          .reduce((s, pt) => s + pt.kcal, 0),
        act.wktKcal,
      )),
    };
  }

  // Workout kcal vs totalKcal if present
  const woCheck = (m.workouts || [])
    .filter((w) => ['2026-07-17', '2026-07-18', '2026-07-19'].includes(dayKeyLocal(w.startMs)))
    .map((w) => ({
      day: dayKeyLocal(w.startMs),
      cat: w.category,
      kcal: w.kcal,
      totalKcal: w.totalKcal,
      ratio: w.totalKcal && w.kcal ? +(w.totalKcal / w.kcal).toFixed(2) : null,
      start: new Date(w.startMs).toISOString(),
      mins: Math.round((w.endMs - w.startMs) / 60000),
    }));

  console.log(JSON.stringify({ exported_at: rows[0].exported_at, burnSim: out, workoutsDetail: woCheck }, null, 2));
} finally {
  await pool.end();
}
