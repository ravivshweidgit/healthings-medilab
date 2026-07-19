#!/usr/bin/env node
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

function dayKeyLocal(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function loadGzip(buf) {
  const p = JSON.parse(inflateSync(buf).toString('utf8'));
  const as = p.asyncStorage || {};
  const mraw = as['healthings:metricsStore'] ?? as['healthings:withingsStore'];
  const m = typeof mraw === 'string' ? JSON.parse(mraw) : mraw;
  return { payload: p, metrics: m, asyncStorage: as };
}

function summarize(metrics, days) {
  const want = new Set(days);
  const cal = {};
  const wo = {};
  for (const d of days) {
    cal[d] = { kcal: 0, n: 0 };
    wo[d] = { n: 0, kcal: 0, items: [] };
  }
  for (const p of metrics.calories || []) {
    const k = dayKeyLocal(p.timestamp);
    if (!want.has(k)) continue;
    cal[k].kcal += Number(p.kcal || 0);
    cal[k].n += 1;
  }
  for (const w of metrics.workouts || []) {
    const k = dayKeyLocal(new Date(w.startMs).toISOString());
    if (!want.has(k)) continue;
    wo[k].n += 1;
    wo[k].kcal += Number(w.kcal) || 0;
    wo[k].items.push({
      category: w.category,
      kcal: w.kcal,
      totalKcal: w.totalKcal,
      start: new Date(w.startMs).toISOString(),
      source: w.source,
    });
  }
  const trend = {};
  for (const d of metrics.bodyTrendDays || []) {
    if (!want.has(d.dayKey)) continue;
    const keys = Object.keys(d).filter((k) => /cal|bmr|step|activ/i.test(k));
    trend[d.dayKey] = Object.fromEntries(keys.map((k) => [k, d[k]]));
  }

  // Simulate Dashboard max(intraday, workout) for Withings days
  const uiBurn = {};
  for (const d of days) {
    const passive = cal[d].kcal;
    const wkt = wo[d].kcal;
    const hasPassive = cal[d].n > 0;
    const hasWkt = wo[d].n > 0;
    let activity = null;
    if (hasPassive) activity = passive;
    if (hasWkt) {
      activity = activity != null ? Math.max(activity, wkt) : wkt;
    }
    const bmr = trend[d]?.bmrKcalDay ?? null;
    uiBurn[d] = {
      activityKcal: activity != null ? Math.round(activity) : null,
      bmr,
      totalBurnIfBmrPlusActivity:
        bmr != null && activity != null ? Math.round(bmr + activity) : null,
      maxOfPassiveVsWorkout: {
        passive: Math.round(passive),
        workoutSum: Math.round(wkt),
        chosen: activity != null ? Math.round(activity) : null,
      },
    };
  }
  return { cal, wo, trend, uiBurn };
}

try {
  const { rows } = await pool.query(
    `SELECT u.payload_gzip, u.prev_payload_gzip, u.exported_at, u.prev_exported_at, u.fingerprint, u.byte_size, u.prev_byte_size
     FROM user_cloud_backups u
     JOIN users us ON us.id = u.user_id
     WHERE lower(us.email) = lower($1)`,
    [email],
  );
  if (!rows.length) {
    console.error('No cloud backup');
    process.exit(1);
  }
  const row = rows[0];
  const cur = loadGzip(row.payload_gzip);
  const prev = row.prev_payload_gzip ? loadGzip(row.prev_payload_gzip) : null;
  const days = ['2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20'];

  const hints = {};
  for (const k of Object.keys(cur.asyncStorage).sort()) {
    if (/platform|device|ios|android|healthkit|health.?connect|source|sync_perf|last_device/i.test(k)) {
      const v = cur.asyncStorage[k];
      hints[k] = typeof v === 'string' && v.length > 400 ? `${v.slice(0, 400)}…` : v;
    }
  }

  // Diff current vs prev metrics sizes / last sync
  let prevDiff = null;
  if (prev) {
    const a = cur.metrics;
    const b = prev.metrics;
    prevDiff = {
      sameLastSynced: a.lastSyncedAt === b.lastSyncedAt,
      calLen: [a.calories?.length, b.calories?.length],
      woLen: [a.workouts?.length, b.workouts?.length],
      hrLen: [a.heartRate?.length, b.heartRate?.length],
      calSumJul19: [
        summarize(a, ['2026-07-19']).cal['2026-07-19'],
        summarize(b, ['2026-07-19']).cal['2026-07-19'],
      ],
    };
  }

  const out = {
    cloud: {
      exported_at: row.exported_at,
      prev_exported_at: row.prev_exported_at,
      byte_size: row.byte_size,
      prev_byte_size: row.prev_byte_size,
      fingerprint: row.fingerprint,
    },
    metricsMeta: {
      lastSyncedAt: cur.metrics.lastSyncedAt,
      caloriePoints: cur.metrics.calories?.length,
      workouts: cur.metrics.workouts?.length,
      hr: cur.metrics.heartRate?.length,
    },
    source_config: cur.asyncStorage.source_config ?? cur.asyncStorage['source_config'],
    hints,
    prevDiff,
    days: summarize(cur.metrics, days),
  };
  console.log(JSON.stringify(out, null, 2));
} finally {
  await pool.end();
}
