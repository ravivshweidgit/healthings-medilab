/**
 * EAS Build: materialize app/.env from EAS Environment variables.
 * react-native-dotenv only reads a file — local `app/.env` is gitignored, so iOS
 * TestFlight builds were shipping with empty WITHINGS_* and Gemini keys.
 *
 * Set once on Expo (production + preview):
 *   eas env:create --environment production --name WITHINGS_CLIENT_ID --value "..." --visibility sensitive
 *   (same for WITHINGS_CLIENT_SECRET, WITHINGS_CALLBACK_URL, HEALTHINGS_API_URL)
 * GEMINI_API_KEY is no longer bundled — Gemini goes through the server proxy (be-40).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

const KEYS = [
  'NODE_ENV',
  'STORAGE_STRATEGY',
  'WITHINGS_CLIENT_ID',
  'WITHINGS_CLIENT_SECRET',
  'WITHINGS_CALLBACK_URL',
  'HEALTHINGS_API_URL',
];

const lines = [];
for (const key of KEYS) {
  const val = process.env[key];
  if (val != null && String(val).trim() !== '') {
    lines.push(`${key}=${String(val).trim()}`);
  }
}

if (lines.length === 0) {
  console.warn(
    '[eas-write-dotenv] No EAS env keys found — Withings/Gemini may be empty in this build. ' +
      'Add secrets on expo.dev → Project → Environment variables (production).',
  );
  process.exit(0);
}

// Do not overwrite a developer-local .env that already has more keys.
if (fs.existsSync(ENV_PATH) && !process.env.EAS_BUILD) {
  console.log('[eas-write-dotenv] Skipping — local .env exists and this is not an EAS build.');
  process.exit(0);
}

fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');
console.log(`[eas-write-dotenv] Wrote ${lines.length} keys to .env for Babel/dotenv.`);
