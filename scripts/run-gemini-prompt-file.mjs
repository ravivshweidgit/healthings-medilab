import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadKey() {
  for (const name of ['.env.prod', '.env.dev', '.env']) {
    const p = join(ROOT, 'app', name);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, 'utf8');
    const m = raw.match(/^GEMINI_API_KEY=(.+)$/m);
    if (m?.[1] && m[1] !== 'your_gemini_api_key') return m[1].trim();
  }
  return null;
}

function parseMacro(raw, finishReason = 'UNKNOWN') {
  const stripped = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
  try {
    return JSON.parse(cleaned);
  } catch {
    const pick = (key) => {
      const re = new RegExp(`"${key}"\\s*:\\s*("([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|(-?\\d+(?:\\.\\d+)?))`);
      const m = stripped.match(re);
      if (!m) return null;
      if (m[2] != null) return m[2].replace(/\\"/g, '"');
      return Number(m[3]);
    };
    const protein_g = pick('protein_g');
    const fat_g = pick('fat_g');
    const carb_g = pick('carb_g');
    const fiber_g = pick('fiber_g');
    const kcal = pick('kcal');
    if ([protein_g, fat_g, carb_g, kcal].some((v) => v == null || Number.isNaN(Number(v)))) {
      throw new Error(`Parse failed (${finishReason}): ${raw.slice(0, 200)}`);
    }
    return {
      protein_g,
      fat_g,
      carb_g,
      fiber_g: fiber_g ?? 0,
      kcal,
      diet_label: pick('diet_label') ?? '',
      reasoning: pick('reasoning') ?? raw.slice(0, 400),
    };
  }
}

async function callGemini(prompt, apiKey, temperature) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 8192 },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 400));
  const finishReason = json?.candidates?.[0]?.finishReason ?? 'UNKNOWN';
  const raw = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return parseMacro(raw, finishReason);
}

function formatLine(label, m) {
  const p = Math.round(Number(m.protein_g) || 0);
  const f = Math.round(Number(m.fat_g) || 0);
  const c = Math.round(Number(m.carb_g) || 0);
  const fi = Math.round(Number(m.fiber_g) || 0);
  const k = Math.round(Number(m.kcal) || 0);
  const kcalCheck = 4 * p + 4 * c + 9 * f;
  console.log(`${label}: ${k} kcal · P${p} · C${c} · F${f} · Fi${fi} · ${m.diet_label || '—'}`);
  console.log(`  4P+4C+9F = ${kcalCheck} (Δ ${k - kcalCheck})`);
  const r = String(m.reasoning ?? '');
  console.log(`  ${r.slice(0, 320)}${r.length > 320 ? '…' : ''}`);
  return { p, f, c, fi, k };
}

const promptPath = resolve(process.argv[2] ?? join(ROOT, 'macro-gemini-prompt_2026-06-18 (1).txt'));
const prompt = readFileSync(promptPath, 'utf8');
const key = loadKey();
if (!key) {
  console.error('No GEMINI_API_KEY in app/.env.prod or .env.dev');
  process.exit(1);
}

console.log(`Prompt: ${promptPath}`);
console.log(`Chars: ${prompt.length.toLocaleString()}\n`);

const r1 = formatLine('Run 1 (temp 0.2)', await callGemini(prompt, key, 0.2));
console.log('');
const r2 = formatLine('Run 2 (temp 0.2)', await callGemini(prompt, key, 0.2));
console.log('');
const r0 = formatLine('Run 3 (temp 0)', await callGemini(prompt, key, 0));
console.log('\nPhone reported: P160 · C50 · F105 · Fi25');
console.log(
  `Spread run1↔run2: ΔP ${Math.abs(r1.p - r2.p)} ΔC ${Math.abs(r1.c - r2.c)} ΔF ${Math.abs(r1.f - r2.f)} Δkcal ${Math.abs(r1.k - r2.k)}`,
);
