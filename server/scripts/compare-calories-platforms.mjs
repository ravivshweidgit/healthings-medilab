#!/usr/bin/env node
/**
 * Compare calorie / activity fields in sync blobs + cloud backup for a patient.
 * Usage: node scripts/compare-calories-platforms.mjs <email>
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/compare-calories-platforms.mjs <email>');
  process.exit(1);
}

const envPath = resolve(__dirname, '../.env');
const env = readFileSync(envPath, 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error('No DATABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: m[1].trim() });

function dayKeyFromMs(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function localDayKeyFromIso(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return dayKeyFromMs(ms);
}

/** Sum calorie points by local calendar day (Israel-ish: use device-local via ISO parse — timestamps are ISO). */
function sumCaloriesByDay(calories, dayKeys) {
  const want = new Set(dayKeys);
  const byDay = Object.fromEntries(dayKeys.map((k) => [k, { kcal: 0, n: 0 }]));
  for (const p of calories ?? []) {
    const k = localDayKeyFromIso(p.timestamp);
    if (!k || !want.has(k)) continue;
    const v = Number(p.calories ?? p.kcal ?? p.value ?? 0);
    if (!Number.isFinite(v)) continue;
    byDay[k].kcal += v;
    byDay[k].n += 1;
  }
  return byDay;
}

function activityFromTrend(days, dayKeys) {
  const want = new Set(dayKeys);
  const out = {};
  for (const d of days ?? []) {
    if (!want.has(d.dayKey)) continue;
    out[d.dayKey] = {
      activeKcal: d.activeCaloriesKcal ?? d.dailyActiveKcal ?? null,
      weightKg: d.weightKg ?? null,
      bmr: d.bmrKcalDay ?? null,
    };
  }
  return out;
}

function workoutsByDay(workouts, dayKeys) {
  const want = new Set(dayKeys);
  const out = Object.fromEntries(dayKeys.map((k) => [k, { n: 0, kcal: 0, sources: {} }]));
  for (const w of workouts ?? []) {
    const k = dayKeyFromMs(w.startMs);
    if (!want.has(k)) continue;
    out[k].n += 1;
    out[k].kcal += Number(w.kcal) || 0;
    const src = w.source ?? 'withings';
    out[k].sources[src] = (out[k].sources[src] ?? 0) + 1;
  }
  return out;
}

function extractMetrics(asyncStorage) {
  const raw =
    asyncStorage?.['healthings:metricsStore'] ??
    asyncStorage?.['healthings:withingsStore'] ??
    null;
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

function summarizePayload(label, payload, dayKeys) {
  const store = payload.asyncStorage ?? {};
  const metrics = extractMetrics(store);
  const sourceConfigRaw = store.source_config ?? store['source_config'];
  let sourceConfig = null;
  try {
    sourceConfig = sourceConfigRaw
      ? typeof sourceConfigRaw === 'string'
        ? JSON.parse(sourceConfigRaw)
        : sourceConfigRaw
      : null;
  } catch {
    /* ignore */
  }

  const calByDay = sumCaloriesByDay(metrics?.calories, dayKeys);
  const trend = activityFromTrend(metrics?.bodyTrendDays, dayKeys);
  const wo = workoutsByDay(metrics?.workouts, dayKeys);

  return {
    label,
    exportedAt: payload.exportedAt ?? null,
    lookbackMode: payload.lookbackMode ?? null,
    sourceConfig: sourceConfig
      ? {
          activity: sourceConfig.activity,
          heartRate: sourceConfig.heartRate,
          bodyComposition: sourceConfig.bodyComposition,
        }
      : null,
    metricsLastSyncedAt: metrics?.lastSyncedAt ?? null,
    caloriePoints: metrics?.calories?.length ?? 0,
    hrPoints: metrics?.heartRate?.length ?? 0,
    workouts: metrics?.workouts?.length ?? 0,
    sampleCalPoint: metrics?.calories?.[metrics.calories.length - 1] ?? null,
    byDay: Object.fromEntries(
      dayKeys.map((k) => [
        k,
        {
          intradayCalSum: calByDay[k],
          trendActive: trend[k] ?? null,
          workouts: wo[k],
        },
      ]),
    ),
  };
}

function lastNLocalDayKeys(n) {
  const keys = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    keys.push(dayKeyFromMs(x.getTime()));
  }
  return keys;
}

try {
  const { rows: users } = await pool.query(
    `SELECT id, email, role FROM users WHERE lower(email) = lower($1) OR lower(email) LIKE lower($2)`,
    [email, `%${email}%`],
  );
  if (!users.length) {
    console.error('User not found:', email);
    process.exit(1);
  }

  const dayKeys = lastNLocalDayKeys(2);
  console.log('DAY_KEYS', dayKeys);

  for (const user of users) {
    console.log('\n==== USER', user.email, user.id, '====');

    const { rows: blobs } = await pool.query(
      `SELECT version, byte_size, created_at, summary, payload_gzip
       FROM sync_blobs WHERE patient_id = $1 ORDER BY version DESC LIMIT 6`,
      [user.id],
    );
    console.log(
      'BLOB_META',
      JSON.stringify(
        blobs.map((b) => ({
          version: b.version,
          byte_size: b.byte_size,
          created_at: b.created_at,
          summary: b.summary,
        })),
        null,
        2,
      ),
    );

    const reports = [];
    for (const b of blobs) {
      try {
        const json = inflateSync(b.payload_gzip).toString('utf8');
        const payload = JSON.parse(json);
        reports.push(
          summarizePayload(`sync_blob_v${b.version}@${b.created_at.toISOString?.() ?? b.created_at}`, payload, dayKeys),
        );
      } catch (err) {
        console.error('blob inflate fail', b.version, err.message);
      }
    }

    const { rows: cbRows } = await pool.query(
      `SELECT byte_size, exported_at, fingerprint, prev_byte_size, prev_exported_at,
              payload_gzip, prev_payload_gzip
       FROM user_cloud_backups WHERE user_id = $1`,
      [user.id],
    );
    const cb = cbRows[0];
    if (cb) {
      console.log(
        'CLOUD_META',
        JSON.stringify(
          {
            byte_size: cb.byte_size,
            exported_at: cb.exported_at,
            fingerprint: cb.fingerprint,
            prev_byte_size: cb.prev_byte_size,
            prev_exported_at: cb.prev_exported_at,
            has_prev: cb.prev_payload_gzip != null,
          },
          null,
          2,
        ),
      );
      try {
        const json = inflateSync(cb.payload_gzip).toString('utf8');
        reports.push(summarizePayload(`cloud_current@${cb.exported_at.toISOString?.() ?? cb.exported_at}`, JSON.parse(json), dayKeys));
      } catch (err) {
        console.error('cloud inflate fail', err.message);
      }
      if (cb.prev_payload_gzip) {
        try {
          const json = inflateSync(cb.prev_payload_gzip).toString('utf8');
          reports.push(
            summarizePayload(`cloud_prev@${cb.prev_exported_at.toISOString?.() ?? cb.prev_exported_at}`, JSON.parse(json), dayKeys),
          );
        } catch (err) {
          console.error('cloud prev inflate fail', err.message);
        }
      }
    } else {
      console.log('CLOUD_META none');
    }

    console.log('COMPARE_REPORT\n' + JSON.stringify(reports, null, 2));
    writeFileSync(`/tmp/calorie-compare-${user.id}.json`, JSON.stringify(reports, null, 2));
    console.log('WROTE', `/tmp/calorie-compare-${user.id}.json`);
  }
} finally {
  await pool.end();
}
