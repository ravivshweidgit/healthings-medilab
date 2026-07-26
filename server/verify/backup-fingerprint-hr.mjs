/**
 * Assert HR floor is in the overwrite guard source, and the decision rules hold.
 * Run: node verify/backup-fingerprint-hr.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const logicSrc = readFileSync(`${SRC}/logic/backupFingerprint.ts`, 'utf8');
const cloudSrc = readFileSync(`${SRC}/services/cloudBackup.ts`, 'utf8');
const routeSrc = readFileSync(`${SRC}/routes/accountBackup.ts`, 'utf8');

const must = [
  [logicSrc, 'heartRatePoints'],
  [logicSrc, 'hrEarliestDay'],
  [logicSrc, 'phone.heartRatePoints < cloud.heartRatePoints'],
  [logicSrc, 'Cloud has more heart-rate samples'],
  [cloudSrc, 'cloudFingerprintForGuard'],
  [cloudSrc, 'fingerprintFromBackupPayload'],
  [routeSrc, 'heartRatePoints'],
  [routeSrc, 'hrEarliestDay'],
];

let drift = 0;
for (const [src, needle] of must) {
  if (!src.includes(needle)) {
    console.error('SOURCE DRIFT missing:', needle);
    drift++;
  }
}
if (drift) process.exit(1);
console.log('SQL/source markers match\n');

// Load compiled logic via tsx-less path: transpile with node --import tsx if available,
// else require after building. Prefer dynamic import of dist if present.
const require = createRequire(import.meta.url);
let canOverwriteCloudBackup;
let fingerprintFromBackupPayload;
try {
  ({ canOverwriteCloudBackup, fingerprintFromBackupPayload } = await import(
    '../dist/logic/backupFingerprint.js'
  ));
} catch {
  // Fall back to tsx register if the package is present
  try {
    await import('tsx/esm');
    ({ canOverwriteCloudBackup, fingerprintFromBackupPayload } = await import(
      '../src/logic/backupFingerprint.ts'
    ));
  } catch {
    console.log('Skipping runtime cases (build with npm run build, or install tsx)');
    process.exit(0);
  }
}

const base = {
  earliestDay: '2026-02-25',
  latestDay: '2026-07-26',
  mealDays: 55,
  glucosePoints: 20000,
  keyCount: 160,
  byteSize: 300000,
  heartRatePoints: 0,
  hrEarliestDay: null,
};

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    console.log('  expected', expected, 'got', actual);
    fail++;
  } else pass++;
}

check(
  'fewer HR points blocked',
  canOverwriteCloudBackup(
    { ...base, heartRatePoints: 264, hrEarliestDay: '2026-07-25' },
    { ...base, heartRatePoints: 5000, hrEarliestDay: '2026-05-01' },
  ).ok,
  false,
);

check(
  'shorter HR span blocked even with more points',
  canOverwriteCloudBackup(
    { ...base, heartRatePoints: 5000, hrEarliestDay: '2026-07-01' },
    { ...base, heartRatePoints: 4000, hrEarliestDay: '2026-05-01' },
  ).ok,
  false,
);

check(
  'richer HR allowed',
  canOverwriteCloudBackup(
    { ...base, heartRatePoints: 5000, hrEarliestDay: '2026-05-01' },
    { ...base, heartRatePoints: 264, hrEarliestDay: '2026-07-25' },
  ).ok,
  true,
);

const payload = {
  asyncStorage: {
    'healthings:metricsStore': JSON.stringify({
      heartRate: [
        { timestamp: '2026-05-01T10:00:00.000Z', bpm: 60 },
        { timestamp: '2026-05-02T10:00:00.000Z', bpm: 62 },
      ],
    }),
  },
};
const fp = fingerprintFromBackupPayload(payload, 1000);
check('fingerprint counts HR', fp.heartRatePoints, 2);
check('fingerprint hr earliest', fp.hrEarliestDay, '2026-05-01');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
