/**
 * prompt116 Phase 2 — photo transport pins.
 *
 * Photos must stay off the snapshot JSON path. A rebuild that re-injects base64
 * thumbs, raises sync caps, or imports the uploader from ShareExport fails here.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
const APP = resolve(ROOT, '..', 'app', 'src').replace(/\\/g, '/');

const shareExport = readFileSync(`${APP}/services/ShareExportService.ts`, 'utf8');
const mealUpload = readFileSync(`${APP}/services/MealPhotoUpload.ts`, 'utf8');
const clinicSync = readFileSync(`${APP}/services/ClinicSyncService.ts`, 'utf8');
const syncSrc = readFileSync(`${ROOT}/src/services/sync.ts`, 'utf8');
const mealRoutes = readFileSync(`${ROOT}/src/routes/mealPhotos.ts`, 'utf8');
const schema = readFileSync(`${ROOT}/src/db/schema.sql`, 'utf8');

const norm = (s) => s.replace(/\s+/g, ' ').trim();
let drift = 0;

function assertIn(label, needle, src) {
  if (!norm(src).includes(norm(needle))) {
    console.error(`SOURCE DRIFT: ${label}\n  expected to find: ${norm(needle)}`);
    drift++;
  }
}

function assertNotIn(label, needle, src) {
  if (norm(src).includes(norm(needle))) {
    console.error(`SOURCE DRIFT: ${label}\n  expected NOT to find: ${norm(needle)}`);
    drift++;
  }
}

// Cut 1 — trigger: photos only from explicit Share tap
assertIn('shareSnapshotNow calls photo upload', 'await uploadMealPhotosOnShare()', clinicSync);
const uploadMentions = clinicSync.split('uploadMealPhotosOnShare').length - 1;
if (uploadMentions !== 2) {
  console.error(
    `SOURCE DRIFT: uploadMealPhotosOnShare should appear exactly twice (import + shareSnapshotNow), found ${uploadMentions}`,
  );
  drift++;
}

// Cut 2 — transport: ShareExport never touches photos
assertNotIn('ShareExport no MealPhotoUpload import', 'MealPhotoUpload', shareExport);
assertNotIn('ShareExport no mealPhotos sidecar', 'mealPhotos', shareExport);
assertNotIn('ShareExport no healthings:mealPhotos', 'healthings:mealPhotos', shareExport);
assertNotIn("ShareExport no encoding base64 photo", "encoding: 'base64'", shareExport);

// Cut 3 — representation: native binary upload
assertIn('upload uses uploadAsync', 'uploadAsync', mealUpload);
assertIn('upload is BINARY_CONTENT', 'FileSystemUploadType.BINARY_CONTENT', mealUpload);
assertNotIn('upload never readAsStringAsync', 'readAsStringAsync', mealUpload);
assertNotIn("upload never encoding base64", "encoding: 'base64'", mealUpload);

// Cut 4 — caps unchanged (tripwire for bytes back in JSON)
assertIn('sync gzip cap still 15 MB', 'payloadGzip.length > 15 * 1024 * 1024', syncSrc);

// Server binary route + table
assertIn('meal_photos table', 'CREATE TABLE IF NOT EXISTS meal_photos', schema);
assertIn('PUT meal-photos route', '/v1/meal-photos/:photoId', mealRoutes);
assertIn('missing route', '/v1/meal-photos/missing', mealRoutes);
assertIn('octet-stream parser', 'application/octet-stream', mealRoutes);

if (drift) {
  console.error(`\n${drift} statement(s) drifted from source`);
  process.exit(1);
}
console.log('prompt116 Phase 2 transport pins OK');
