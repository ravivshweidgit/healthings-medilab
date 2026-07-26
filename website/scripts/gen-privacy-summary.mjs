/**
 * Inject the localized privacy summary into privacy.html (be-13 Phase B).
 *
 * The policy page is hand-maintained, unlike the help site, so this only
 * rewrites the block between two markers and leaves the rest untouched.
 *
 * The translations ship as a JSON island rather than ten hidden copies of the
 * summary. That keeps a single visible summary in the source, so no-JS readers
 * and crawlers see exactly the English text that is the policy of record, and
 * there is nothing to un-hide if the script never runs.
 *
 * Usage: node website/scripts/gen-privacy-summary.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP_LOCALES, PRIVACY_SUMMARY } from './help-locale-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE = join(__dirname, '..', 'privacy.html');

const BEGIN = '<!-- BEGIN generated: privacy summary translations (gen-privacy-summary.mjs) -->';
const END = '<!-- END generated: privacy summary translations -->';

const rtl = new Set(HELP_LOCALES.filter((l) => l.dir === 'rtl').map((l) => l.code));

const payload = {};
for (const [code, t] of Object.entries(PRIVACY_SUMMARY)) {
  if (code === 'en') throw new Error('English is the source text in the page, not a translation');
  if (!HELP_LOCALES.some((l) => l.code === code)) {
    throw new Error(`Unknown locale in PRIVACY_SUMMARY: ${code}`);
  }
  for (const field of ['heading', 'lead', 'summary', 'note']) {
    if (!t[field]) throw new Error(`PRIVACY_SUMMARY.${code} is missing ${field}`);
  }
  payload[code] = { ...t, rtl: rtl.has(code) || undefined };
}

const missing = HELP_LOCALES.map((l) => l.code).filter(
  (c) => c !== 'en' && !payload[c],
);
if (missing.length) throw new Error(`No privacy summary for: ${missing.join(', ')}`);

// </script> inside JSON would close the island early; \u003c is valid JSON and
// parses back to the same string.
const json = JSON.stringify(payload).replace(/</g, '\\u003c');

const html = readFileSync(PAGE, 'utf8');
const start = html.indexOf(BEGIN);
const stop = html.indexOf(END);
if (start === -1 || stop === -1) {
  throw new Error(`Markers not found in ${PAGE} — add ${BEGIN} … ${END}`);
}

const block = [
  BEGIN,
  `    <script type="application/json" id="privacy-i18n">${json}</script>`,
  `    ${END}`,
].join('\n    ');

const next = html.slice(0, start) + block + html.slice(stop + END.length);
writeFileSync(PAGE, next, 'utf8');

console.log(
  `privacy.html: ${Object.keys(payload).length} locales injected (${(json.length / 1024).toFixed(1)} kB)`,
);
