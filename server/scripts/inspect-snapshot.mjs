#!/usr/bin/env node
/**
 * Inspect patient sync blob integrity (metrics store, CGM, food logs).
 * Usage: node scripts/inspect-snapshot.mjs <email> [version]
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const email = process.argv[2];
const versionArg = process.argv[3] ? Number(process.argv[3]) : null;

if (!email) {
  console.error('Usage: node scripts/inspect-snapshot.mjs <email> [version]');
  process.exit(1);
}

const envPath = resolve(__dirname, '../.env');
const env = readFileSync(envPath, 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) {
  console.error('No DATABASE_URL in', envPath);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: m[1].trim() });

try {
  const { rows: users } = await pool.query(
    'SELECT id, email, role FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  if (!users.length) {
    console.error('User not found:', email);
    process.exit(1);
  }
  const user = users[0];
  console.log('USER', JSON.stringify(user));

  const { rows: recent } = await pool.query(
    `SELECT version, byte_size, created_at, summary
     FROM sync_blobs WHERE patient_id = $1 ORDER BY version DESC LIMIT 5`,
    [user.id],
  );
  console.log('RECENT_BLOBS', JSON.stringify(recent, null, 2));

  const version = versionArg ?? recent[0]?.version;
  if (!version) {
    console.error('No sync blobs for patient');
    process.exit(1);
  }

  const { rows: blobRows } = await pool.query(
    `SELECT version, byte_size, payload_gzip, summary, created_at
     FROM sync_blobs WHERE patient_id = $1 AND version = $2`,
    [user.id, version],
  );
  if (!blobRows.length) {
    console.error(`Version ${version} not found`);
    process.exit(1);
  }
  const row = blobRows[0];

  let json;
  try {
    json = inflateSync(row.payload_gzip).toString('utf8');
  } catch (err) {
    console.error('inflate failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const payload = JSON.parse(json);
  const store = payload.asyncStorage ?? {};
  const keys = Object.keys(store).sort();
  const metricsRaw =
    store['healthings:metricsStore'] ?? store['healthings:withingsStore'] ?? null;

  let metrics = null;
  let metricsParseError = null;
  if (metricsRaw) {
    try {
      metrics = JSON.parse(metricsRaw);
    } catch (err) {
      metricsParseError = err instanceof Error ? err.message : String(err);
    }
  }

  let cgm = null;
  if (store['healthings:lastMetrics']) {
    try {
      cgm = JSON.parse(store['healthings:lastMetrics']);
    } catch {
      /* ignore */
    }
  }

  const report = {
    version: row.version,
    byteSize: row.byte_size,
    createdAt: row.created_at,
    exportedAt: payload.exportedAt,
    lookbackMode: payload.lookbackMode,
    asyncKeyCount: keys.length,
    hasMetricsKey: Boolean(store['healthings:metricsStore']),
    hasLegacyWithingsKey: Boolean(store['healthings:withingsStore']),
    metricsRawBytes: metricsRaw ? metricsRaw.length : 0,
    metricsParseError,
    hasCgm: Boolean(store['healthings:lastMetrics']),
    foodLogDays: keys.filter((k) => /^food_log_\d{4}-\d{2}-\d{2}$/.test(k)).length,
    labReports: keys.filter((k) => k.startsWith('lab_report_')).length,
    cgm: cgm
      ? {
          glucosePoints: cgm.glucose?.length ?? 0,
          sessionStarts: cgm.cgmSessionStarts?.length ?? 0,
        }
      : null,
    metrics: metrics
      ? {
          version: metrics.version,
          lastSyncedAt: metrics.lastSyncedAt,
          bodyScan: metrics.bodyScan
            ? {
                measuredAt: metrics.bodyScan.measuredAt,
                weightKg: metrics.bodyScan.weightKg,
                fatMassKg: metrics.bodyScan.fatMassKg,
                muscleMassKg: metrics.bodyScan.muscleMassKg,
                bmrKcalDay: metrics.bodyScan.bmrKcalDay,
              }
            : null,
          bodyTrendDays: metrics.bodyTrendDays?.length ?? 0,
          bodyTrendSessions: metrics.bodyTrendSessions?.length ?? 0,
          heartRatePoints: metrics.heartRate?.length ?? 0,
          heartRateRange:
            metrics.heartRate?.length > 0
              ? {
                  first: metrics.heartRate[0]?.timestamp,
                  last: metrics.heartRate[metrics.heartRate.length - 1]?.timestamp,
                }
              : null,
          caloriePoints: metrics.calories?.length ?? 0,
          workouts: metrics.workouts?.length ?? 0,
        }
      : null,
    integrity: {
      metricsPresent: Boolean(metricsRaw),
      metricsPopulated: Boolean(
        metrics &&
          (metrics.bodyScan ||
            (metrics.bodyTrendDays?.length ?? 0) > 0 ||
            (metrics.heartRate?.length ?? 0) > 0 ||
            (metrics.workouts?.length ?? 0) > 0),
      ),
      clinicDashboardOk: Boolean(
        metrics?.bodyScan &&
          (metrics.bodyTrendDays?.length ?? 0) >= 2 &&
          ((metrics.heartRate?.length ?? 0) > 0 || (metrics.workouts?.length ?? 0) > 0),
      ),
    },
    summary: row.summary,
  };

  console.log('INTEGRITY_REPORT\n' + JSON.stringify(report, null, 2));
} finally {
  await pool.end();
}
