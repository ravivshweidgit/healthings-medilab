/**
 * Merge Withings heart-rate + calorie intraday history from an older backup into a newer one.
 *
 * Usage:
 *   node scripts/merge-withings-hr-into-backup.mjs \
 *     app/healthings-backup/healthings-backup_2026-07-02-all-meals.json \
 *     C:\Users\raviv\Downloads\healthings-backup_2026-06-18.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STORE_KEY = 'healthings:withingsStore';

function mergeByTimestamp(prev, next) {
  const map = new Map();
  for (const p of prev) {
    const ms = Date.parse(p.timestamp);
    if (!Number.isNaN(ms)) map.set(ms, p);
  }
  for (const p of next) {
    const ms = Date.parse(p.timestamp);
    if (!Number.isNaN(ms)) map.set(ms, p);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

function hrSummary(store) {
  const hr = store?.heartRate ?? [];
  const days = [...new Set(hr.map((p) => p.timestamp.slice(0, 10)))].sort();
  return {
    points: hr.length,
    first: days[0] ?? '-',
    last: days[days.length - 1] ?? '-',
    days: days.length,
  };
}

function main() {
  const targetPath = resolve(process.argv[2]);
  const hrSourcePath = resolve(process.argv[3]);
  const outPath = targetPath.replace(/\.json$/i, '-hr-merged.json');

  const target = JSON.parse(readFileSync(targetPath, 'utf8'));
  const hrSource = JSON.parse(readFileSync(hrSourcePath, 'utf8'));

  const targetStore = JSON.parse(target.asyncStorage[STORE_KEY] ?? '{}');
  const sourceStore = JSON.parse(hrSource.asyncStorage[STORE_KEY] ?? '{}');

  const before = hrSummary(targetStore);

  const mergedStore = {
    ...targetStore,
    version: targetStore.version ?? 1,
    heartRate: mergeByTimestamp(sourceStore.heartRate ?? [], targetStore.heartRate ?? []),
    calories: mergeByTimestamp(sourceStore.calories ?? [], targetStore.calories ?? []),
    // Keep newer workouts/body from target (usually more complete).
  };

  target.asyncStorage[STORE_KEY] = JSON.stringify(mergedStore);
  target.exportedAt = new Date().toISOString();

  writeFileSync(outPath, JSON.stringify(target, null, 2), 'utf8');

  const after = hrSummary(mergedStore);
  console.log('Target:', targetPath);
  console.log('HR source:', hrSourcePath);
  console.log('HR before:', before.points, 'pts', before.first, '..', before.last, `(${before.days} days)`);
  console.log('HR after :', after.points, 'pts', after.first, '..', after.last, `(${after.days} days)`);
  console.log('Output:', outPath);
  console.log('');
  console.log('Phone: Import all data -> pick *-hr-merged.json');
  console.log('Gap Jun 19-24: update app (60d Withings lookback) + pull to refresh');
}

main();
