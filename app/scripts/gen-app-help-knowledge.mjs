/**
 * Generate app/src/help/AppHelpKnowledge.ts from website EN help articles.
 * Run from repo root: node app/scripts/gen-app-help-knowledge.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ARTICLES, HELP_SLUGS } from '../../website/scripts/help-locale-content.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../src/help/AppHelpKnowledge.ts');

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const appendix = [
  '## Recent app surfaces (dashboard)',
  '- Profile & Settings: nested strips for Profile, Language, Units, Appearance, Gear (scale/watch/CGM), Mentors, Rules, Macros, Account, Data sharing, Clinic, Reports, and App backup. A short “Open app Help” link expands the dashboard Help card.',
  '- Help: dedicated dashboard card just below AI chat (not nested under Profile). Ask product how-to questions; answers follow App & coach language.',
  '- Language: App & coach language drives dashboard chrome, coach, meals, and Help answers. Changing language keeps custom chat quick-question chips per language.',
  '- Food Log → Edit item: grams field has a slider — centre = original grams when edit opened, left = 0 g, right = double original; kcal and macros (protein/carbs/fat/fibre) scale with grams.',
  "- Watch Off: activity calories come from phone steps (Health Connect on Android / Apple Health on iOS), not Withings Active Energy. Pull-to-refresh reloads today's steps into Food Log activity.",
  '- Allow access / Deep sync on the phone-health strip also reloads steps history.',
  '- AI chat (mentors) is separate from Help — mentors coach on health data; Help explains how to use the app.',
  '- Website long-form help: https://healthings.ai/{lang}/help/{slug}.html',
].join('\n');

const knowledgeParts = [];
for (const slug of HELP_SLUGS) {
  const a = ARTICLES[slug]?.en;
  if (!a) continue;
  knowledgeParts.push(`## ${a.title} [${slug}]`);
  if (a.lead) knowledgeParts.push(stripHtml(a.lead));
  knowledgeParts.push(stripHtml(a.body));
  knowledgeParts.push('');
}
const knowledge = knowledgeParts.join('\n').trim();

const file = `/**
 * Bundled English product KB for in-app Help AI (prompt98).
 * Sourced from website/scripts/help-locale-content.mjs EN articles + app appendix.
 * Regenerate: node app/scripts/gen-app-help-knowledge.mjs
 * Do not invent UI that is not described here.
 */

export const APP_HELP_APPENDIX = ${JSON.stringify(appendix)};

export const APP_HELP_KNOWLEDGE_EN = ${JSON.stringify(knowledge)};

export function buildAppHelpKnowledgeBlock(): string {
  return \`# Healthings app — product help knowledge\\n\\n\${APP_HELP_KNOWLEDGE_EN}\\n\\n\${APP_HELP_APPENDIX}\`;
}
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, file, 'utf8');
console.log('Wrote', outPath, `(${file.length} chars)`);
