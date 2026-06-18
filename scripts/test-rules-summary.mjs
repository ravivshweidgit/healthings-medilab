import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadKey() {
  for (const name of ['.env.prod', '.env.dev', '.env']) {
    const p = join(ROOT, 'app', name);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/^GEMINI_API_KEY=(.+)$/m);
    if (m?.[1] && m[1] !== 'your_gemini_api_key') return m[1].trim();
  }
  return null;
}

const rawText = process.argv[2] ?? `כולסטרול גבוה
הגבלת חלבון ל-2.2 גרם/ק"ג מסה רזה
הגבלת שומנים רוויים
העדפת סיבים מירקות, זרעים ואגוזים
הימנעות מאנטריקוט וקממבר
העדפת סלמון, שקדים וזרעי דלעת`;

const langNote =
  '\nLANGUAGE: Write JSON string values (summary, context, each constraints[] item) in עברית (he). Keys must stay exactly "summary", "constraints", and optional "context". Output ONLY valid JSON — no markdown, no prose before or after.';

const prompt = `You are a clinical nutritionist assistant. Extract the user's dietary rules into JSON only.

Schema (English keys only):
{"summary":"High cholesterol · IF 16:8","context":"Lower LDL; heart-healthy fats; kidney-aware protein","constraints":["avoid entrecôte","prefer salmon and nuts"]}

Rules:
- summary: max 5 words, · separator — user's framing (cholesterol, kidney, IF, etc.)
- context: optional ONE short sentence — primary goals (e.g. cholesterol, kidney) — NOT a diet brand name
- constraints: max 5 items, max 8 words each — actionable bullets from user text only
- Do NOT label as keto, ketogenic, or קטוגנית unless the user explicitly wrote keto/קטו/קטוגנית
- Do NOT invent carb gram caps the user did not state

User text:
"""
${rawText.replace(/"/g, "'")}
"""${langNote}`;

const key = loadKey();
if (!key) {
  console.error('No GEMINI_API_KEY');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048 },
  }),
});
const json = await res.json();
const raw = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
console.log('RAW:', raw.slice(0, 500));
const cleaned = raw
  .replace(/```json\s*/gi, '')
  .replace(/```/g, '')
  .trim();
const start = cleaned.indexOf('{');
const end = cleaned.lastIndexOf('}');
try {
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  console.log('\nPARSED:', JSON.stringify(parsed, null, 2));
} catch (e) {
  console.error('\nPARSE FAILED:', e.message);
  process.exit(1);
}
