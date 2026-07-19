#!/usr/bin/env node
/** Compare raviv.shweid cloud current vs prev (expect iOS vs Android after fresh backup). */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const email = process.argv[2] || 'raviv.shweid@gmail.com';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const pool = new pg.Pool({ connectionString: env.match(/^DATABASE_URL=(.+)$/m)[1].trim() });
const BUCKET = 30 * 60 * 1000;

const dayKey = (ms) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));

function load(buf) {
  const p = JSON.parse(inflateSync(buf).toString('utf8'));
  const as = p.asyncStorage || {};
  let sc = as.source_config;
  if (typeof sc === 'string') {
    try {
      sc = JSON.parse(sc);
    } catch {
      /* */
    }
  }
  const mraw = as['healthings:metricsStore'];
  const m = typeof mraw === 'string' ? JSON.parse(mraw) : mraw;
  return { exportedAt: p.exportedAt, sc, m };
}

function platformGuess(sc) {
  if (!sc) return 'unknown';
  if (sc.glucose === 'healthkit') return 'ios';
  if (sc.glucose === 'health-connect') return 'android';
  return `mixed:${sc.glucose}`;
}

function act(m, dk) {
  const cals = m.calories || [];
  const wos = m.workouts || [];
  const buckets = new Set();
  let wkt = 0;
  const items = [];
  for (const w of wos) {
    if (w.source === 'health-connect') continue;
    if (dayKey(w.startMs) !== dk) continue;
    wkt += Number(w.kcal) || 0;
    items.push({
      cat: w.category,
      kcal: w.kcal,
      start: new Date(w.startMs).toISOString(),
      mins: Math.round((w.endMs - w.startMs) / 60000),
    });
    for (let bk = Math.floor(w.startMs / BUCKET) * BUCKET; bk < w.endMs; bk += BUCKET) {
      buckets.add(bk);
    }
  }
  let passiveAll = 0;
  let passiveKept = 0;
  let n = 0;
  for (const p of cals) {
    const t = Date.parse(p.timestamp);
    if (dayKey(t) !== dk) continue;
    n += 1;
    passiveAll += Number(p.kcal) || 0;
    if (!buckets.has(Math.floor(t / BUCKET) * BUCKET)) passiveKept += Number(p.kcal) || 0;
  }
  const trend = (m.bodyTrendDays || []).find((d) => d.dayKey === dk);
  const activity = Math.round(passiveKept + wkt);
  return {
    calPts: n,
    passiveAll: +passiveAll.toFixed(1),
    passiveKept: +passiveKept.toFixed(1),
    wktN: items.length,
    wktKcal: Math.round(wkt),
    activity,
    bmr: trend?.bmrKcalDay ?? null,
    totalBurn: trend?.bmrKcalDay != null ? trend.bmrKcalDay + activity : null,
    items,
  };
}

function fuzzy(aList, bList) {
  const used = new Set();
  const pairs = [];
  for (const a of aList) {
    let best = null;
    let bestDt = 1e99;
    for (let i = 0; i < bList.length; i++) {
      if (used.has(i)) continue;
      const dt = Math.abs(a.startMs - bList[i].startMs);
      if (dt < bestDt && dt <= 5 * 60 * 1000 && a.category === bList[i].category) {
        bestDt = dt;
        best = i;
      }
    }
    if (best != null) {
      used.add(best);
      const b = bList[best];
      pairs.push({
        dtSec: Math.round(bestDt / 1000),
        currentKcal: a.kcal,
        previousKcal: b.kcal,
        ratio: b.kcal ? +(a.kcal / b.kcal).toFixed(3) : null,
        start: new Date(a.startMs).toISOString(),
        identicalStart: a.startMs === b.startMs,
      });
    }
  }
  return pairs;
}

try {
  const { rows } = await pool.query(
    `SELECT u.exported_at, u.prev_exported_at, u.payload_gzip, u.prev_payload_gzip,
            u.byte_size, u.prev_byte_size, u.fingerprint
     FROM user_cloud_backups u
     JOIN users us ON us.id = u.user_id
     WHERE lower(us.email) = lower($1)`,
    [email],
  );
  if (!rows[0]) {
    console.error('No backup');
    process.exit(1);
  }
  const r = rows[0];
  const cur = load(r.payload_gzip);
  const prev = r.prev_payload_gzip ? load(r.prev_payload_gzip) : null;
  const days = ['2026-07-18', '2026-07-19'];

  const out = {
    cloud: {
      exported_at: r.exported_at,
      prev_exported_at: r.prev_exported_at,
      byte_size: r.byte_size,
      prev_byte_size: r.prev_byte_size,
    },
    current: {
      platform: platformGuess(cur.sc),
      sc: cur.sc,
      lastSynced: cur.m?.lastSyncedAt,
      calN: cur.m?.calories?.length,
      woN: cur.m?.workouts?.length,
    },
    previous: prev
      ? {
          platform: platformGuess(prev.sc),
          sc: prev.sc,
          lastSynced: prev.m?.lastSyncedAt,
          calN: prev.m?.calories?.length,
          woN: prev.m?.workouts?.length,
        }
      : null,
    days: {},
    workoutPairs: {},
  };

  for (const dk of days) {
    const a = act(cur.m, dk);
    const b = prev ? act(prev.m, dk) : null;
    out.days[dk] = {
      current: a,
      previous: b,
      activityDeltaPct:
        b && b.activity ? +(((a.activity / b.activity) - 1) * 100).toFixed(1) : null,
      sameActivity: b ? a.activity === b.activity : null,
    };
    const cW = (cur.m.workouts || []).filter((w) => dayKey(w.startMs) === dk);
    const pW = prev ? (prev.m.workouts || []).filter((w) => dayKey(w.startMs) === dk) : [];
    out.workoutPairs[dk] = fuzzy(cW, pW);
  }

  console.log(JSON.stringify(out, null, 2));
} finally {
  await pool.end();
}
