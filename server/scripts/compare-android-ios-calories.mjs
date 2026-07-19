#!/usr/bin/env node
/**
 * Side-by-side Android vs iOS Withings calorie compare for last N days.
 * Android: raviv.shweid@gmail.com
 * iOS:     raviv.shweid+withings-ios@gmail.com
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url });
const BUCKET_MS = 30 * 60 * 1000;

const ACCOUNTS = {
  android: 'raviv.shweid@gmail.com',
  ios: 'raviv.shweid+withings-ios@gmail.com',
};

function dayKeyLocal(msOrIso) {
  const ms = typeof msOrIso === 'number' ? msOrIso : Date.parse(msOrIso);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function loadMetrics(buf) {
  const p = JSON.parse(inflateSync(buf).toString('utf8'));
  const as = p.asyncStorage || {};
  const mraw = as['healthings:metricsStore'] ?? as['healthings:withingsStore'];
  const m = typeof mraw === 'string' ? JSON.parse(mraw) : mraw;
  let sc = as.source_config ?? as['source_config'];
  if (typeof sc === 'string') {
    try {
      sc = JSON.parse(sc);
    } catch {
      /* keep */
    }
  }
  return { exportedAt: p.exportedAt ?? null, sourceConfig: sc, metrics: m };
}

function withingsActivityForDay(dk, calories, workouts) {
  const wktBuckets = new Set();
  let wktKcal = 0;
  const items = [];
  for (const w of workouts) {
    if (w.source === 'health-connect') continue;
    if (dayKeyLocal(w.startMs) !== dk) continue;
    wktKcal += Number(w.kcal) || 0;
    items.push({
      cat: w.category,
      kcal: w.kcal,
      totalKcal: w.totalKcal ?? null,
      start: new Date(w.startMs).toISOString(),
      mins: Math.round((w.endMs - w.startMs) / 60000),
    });
    const firstBk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS;
    for (let bk = firstBk; bk < w.endMs; bk += BUCKET_MS) wktBuckets.add(bk);
  }
  let passiveAll = 0;
  let passiveKept = 0;
  let n = 0;
  for (const pt of calories) {
    const t = Date.parse(pt.timestamp);
    if (dayKeyLocal(t) !== dk) continue;
    n += 1;
    passiveAll += Number(pt.kcal) || 0;
    const bk = Math.floor(t / BUCKET_MS) * BUCKET_MS;
    if (!wktBuckets.has(bk)) passiveKept += Number(pt.kcal) || 0;
  }
  const activity = Math.round(passiveKept + wktKcal);
  return {
    calPts: n,
    passiveAll: Math.round(passiveAll * 10) / 10,
    passiveKept: Math.round(passiveKept * 10) / 10,
    wktN: items.length,
    wktKcal: Math.round(wktKcal),
    activity,
    workouts: items,
  };
}

function dayReport(metrics, days) {
  const out = {};
  for (const dk of days) {
    const a = withingsActivityForDay(dk, metrics.calories || [], metrics.workouts || []);
    const trend = (metrics.bodyTrendDays || []).find((d) => d.dayKey === dk);
    const bmr = trend?.bmrKcalDay ?? null;
    out[dk] = {
      ...a,
      bmr,
      totalBurn: bmr != null ? bmr + a.activity : null,
      trendActivityKcalDay: trend?.activityKcalDay ?? null,
    };
  }
  return out;
}

async function loadUserCloud(email) {
  const { rows } = await pool.query(
    `SELECT u.payload_gzip, u.exported_at, u.prev_payload_gzip, u.prev_exported_at
     FROM user_cloud_backups u
     JOIN users us ON us.id = u.user_id
     WHERE lower(us.email) = lower($1)`,
    [email],
  );
  if (!rows[0]) return null;
  return {
    exported_at: rows[0].exported_at,
    cur: loadMetrics(rows[0].payload_gzip),
    prev: rows[0].prev_payload_gzip
      ? { exported_at: rows[0].prev_exported_at, ...loadMetrics(rows[0].prev_payload_gzip) }
      : null,
  };
}

try {
  const days = ['2026-07-18', '2026-07-19'];
  const android = await loadUserCloud(ACCOUNTS.android);
  const ios = await loadUserCloud(ACCOUNTS.ios);

  const aDays = dayReport(android.cur.metrics, days);
  const iDays = dayReport(ios.cur.metrics, days);

  const compare = {};
  for (const dk of days) {
    const a = aDays[dk];
    const i = iDays[dk];
    const ratio =
      a.activity > 0 && i.activity > 0 ? +(i.activity / a.activity).toFixed(3) : null;
    const burnRatio =
      a.totalBurn > 0 && i.totalBurn > 0 ? +(i.totalBurn / a.totalBurn).toFixed(3) : null;
    compare[dk] = {
      android: a,
      ios: i,
      iosOverAndroidActivity: ratio,
      iosOverAndroidBurn: burnRatio,
      activityDeltaPct: ratio != null ? +((ratio - 1) * 100).toFixed(1) : null,
      burnDeltaPct: burnRatio != null ? +((burnRatio - 1) * 100).toFixed(1) : null,
    };
  }

  // Also compare raw workout overlap by startMs
  const aWo = new Map((android.cur.metrics.workouts || []).map((w) => [w.startMs, w]));
  const iWo = new Map((ios.cur.metrics.workouts || []).map((w) => [w.startMs, w]));
  const woCompare = [];
  for (const dk of days) {
    const starts = new Set([
      ...[...aWo.values()].filter((w) => dayKeyLocal(w.startMs) === dk).map((w) => w.startMs),
      ...[...iWo.values()].filter((w) => dayKeyLocal(w.startMs) === dk).map((w) => w.startMs),
    ]);
    for (const s of [...starts].sort()) {
      const aw = aWo.get(s);
      const iw = iWo.get(s);
      woCompare.push({
        day: dk,
        start: new Date(s).toISOString(),
        androidKcal: aw?.kcal ?? null,
        iosKcal: iw?.kcal ?? null,
        androidTotal: aw?.totalKcal ?? null,
        iosTotal: iw?.totalKcal ?? null,
        cat: aw?.category ?? iw?.category,
        onlyOn: aw && iw ? 'both' : aw ? 'android' : 'ios',
        kcalRatio: aw?.kcal && iw?.kcal ? +(iw.kcal / aw.kcal).toFixed(3) : null,
      });
    }
  }

  // Intraday calorie sample: sum + count + first/last timestamp per day
  function calMeta(metrics, dk) {
    const pts = (metrics.calories || []).filter((p) => dayKeyLocal(p.timestamp) === dk);
    if (!pts.length) return { n: 0 };
    pts.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    return {
      n: pts.length,
      sum: Math.round(pts.reduce((s, p) => s + p.kcal, 0) * 10) / 10,
      first: pts[0].timestamp,
      last: pts[pts.length - 1].timestamp,
      avgPt: Math.round((pts.reduce((s, p) => s + p.kcal, 0) / pts.length) * 1000) / 1000,
    };
  }

  console.log(
    JSON.stringify(
      {
        androidMeta: {
          email: ACCOUNTS.android,
          exported_at: android.exported_at,
          sourceConfig: android.cur.sourceConfig,
          lastSyncedAt: android.cur.metrics.lastSyncedAt,
          calN: android.cur.metrics.calories?.length,
          woN: android.cur.metrics.workouts?.length,
        },
        iosMeta: {
          email: ACCOUNTS.ios,
          exported_at: ios.exported_at,
          sourceConfig: ios.cur.sourceConfig,
          lastSyncedAt: ios.cur.metrics.lastSyncedAt,
          calN: ios.cur.metrics.calories?.length,
          woN: ios.cur.metrics.workouts?.length,
        },
        compare,
        workoutPairs: woCompare,
        calMeta: {
          android: Object.fromEntries(days.map((d) => [d, calMeta(android.cur.metrics, d)])),
          ios: Object.fromEntries(days.map((d) => [d, calMeta(ios.cur.metrics, d)])),
        },
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
