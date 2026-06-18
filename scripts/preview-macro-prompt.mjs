/**
 * Build the Gemini MACRO REVISION prompt from a healthings backup JSON.
 * Usage:
 *   node scripts/preview-macro-prompt.mjs "C:\path\healthings-backup_2026-06-18.json"
 *   node scripts/preview-macro-prompt.mjs backup.json --out macro-prompt.txt
 *   node scripts/preview-macro-prompt.mjs backup.json --gemini --double
 *
 * Reads GEMINI_API_KEY from app/.env.prod or app/.env.dev (first match).
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const FIBER_CARB_RULE = `
## Fiber ↔ carb (mandatory)
- Dietary fiber is counted INSIDE total carbohydrates on food labels — \`fiber_g\` must NEVER exceed \`carb_g\`.
- When daily carb target ≤ 60g: recommend \`fiber_g\` ≈ round(½ × \`carb_g\`) from quality low-carb sources.
- When carb target > 60g: recommend \`fiber_g\` ≈ 30g/day (standard band), NOT ½ of carbs.
- If user's rules imply very low carbs (<30g), proactively set realistic fiber — do not default both to 30g.`;

const MACRO_REVISION_PROMPT = `## Role
You are a certified clinical nutritionist revising **daily macro targets** (not meal advice).

${FIBER_CARB_RULE}

## Energy balance (do this FIRST — before P/C/F)
Work in this order every time:
1. Read **current weight**, **body target** (goal kg), and **weight trend Δ** (e.g. 14d line).
2. Decide **daily deficit or surplus** (kcal/day) from how far current is from goal and how fast weight is already moving:
   - At/past goal → **0** (maintenance).
   - Losing, kg to goal small (e.g. &lt;2 kg) → **modest deficit** (~150–250 kcal), not aggressive.
   - Losing, far from goal → up to ~300–500 kcal deficit, tapered by kg remaining.
   - Gaining → modest surplus (~200–400 kcal).
   - If trend shows **rapid loss** (e.g. &gt;1 kg/week) → **do not deepen** deficit; hold or shrink it.
   - CGM low &lt;70 (trusted day) → do not cut kcal further.
3. \`kcal\` = **7-day avg burn** (Profile line) **minus deficit** (or plus surplus). Use **burn**, not BMR, as the anchor.
4. Only after \`kcal\` is set → derive \`protein_g\`, \`carb_g\`, \`fat_g\`, \`fiber_g\` to sum to that kcal.
5. In \`reasoning\`, show the math: burn, chosen deficit/surplus, resulting kcal — then macros.

## CGM (7-day block)
Context: GLUCOSE & FOOD IMPACT + MEAL GLUCOSE in the data section below.
- MUST cite period avg, min, max (mg/dL) in \`reasoning\` when CGM present.
- Use meal-spike / problem-food lines to justify carb and fiber targets.
- Lows &lt;70 (trusted days): do not cut kcal further — note in \`reasoning\`.

## Carbs (derivation)
- Read **7d eaten carb avg** from FOOD MACROS; \`carb_g\` should stay within **±10g** of that avg unless meal-spike lines or My Rules require lower.
- Do not default to round numbers (20/30/50) without citing eaten avg and CGM in \`reasoning\`.

## Kidney (lab results)
Scope: creatinine / urea on **latest draw** in LAB RESULTS.
- When creatinine or urea is flagged **high**: \`protein_g\` ≤ round(2.2 × lean mass kg); if lean mass missing use round(2.0 × weight kg).
- Cite exact lab values in \`reasoning\`; do not raise protein above 7d eaten protein avg without strong justification.
- If My Rules omit kidney/protein limits while these labs are high: set \`rules_advice\` with one concrete sentence the user can paste into My Rules.

## Priority rules
1. **My Rules** are HARD constraints — never violate when setting macros.
2. **Energy balance order** (above) overrides BMR or 7d eaten avg as the kcal anchor; eaten avg is context, not the primary kcal formula.
3. Labs: informational only — kidney/lipids may cap protein/fat increases, not diagnose.
4. kcal must align with 4×P + 4×C + 9×F within ~50 kcal.

## My Rules integrity
Compare the My Rules block to labs, CGM, 7d food log, and weight goal.
- If rules fit the data: **omit** \`rules_advice\` entirely — stay silent.
- If rules conflict with data or recent meals (e.g. "avoid X" but X logged): set \`rules_advice\` to one short paragraph — suggest concrete rule text edits only.
- Do **not** repeat rules that already match; do **not** relabel the diet (e.g. keto/ketogenic) unless the user's **raw** rules text says so.
- \`diet_label\`: never "keto/ketogenic" unless user raw text explicitly says keto.

## Output format
Return **JSON only** — no markdown, no preamble. Every numeric field must be a positive integer **derived from the data block**, not copied from the schema below.

\`\`\`json
{"protein_g":integer,"fat_g":integer,"carb_g":integer,"fiber_g":integer,"kcal":integer,"diet_label":"string","reasoning":"string — burn, deficit/surplus, kcal math, then weight→goal, CGM avg/min/max when present","rules_advice":"omit when aligned; else string"}
\`\`\``;

const LOW_CARB_FIBER_THRESHOLD_G = 60;
const STANDARD_FIBER_TARGET_G = 30;

function parseArgs(argv) {
  const args = { backup: null, out: null, gemini: false, double: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--gemini') args.gemini = true;
    else if (a === '--double') args.double = true;
    else if (a === '--out') args.out = argv[++i];
    else if (!a.startsWith('-') && !args.backup) args.backup = a;
  }
  return args;
}

function loadEnvKey() {
  for (const name of ['.env.prod', '.env.dev', '.env']) {
    const p = join(ROOT, 'app', name);
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, 'utf8');
    const m = raw.match(/^GEMINI_API_KEY=(.+)$/m);
    if (m?.[1] && m[1] !== 'your_gemini_api_key') return m[1].trim();
  }
  return null;
}

function j(store, key, fallback = null) {
  const raw = store[key];
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function localDayKeyFromMs(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyDaysAgo(asOfMs, daysAgo) {
  const d = new Date(asOfMs);
  d.setDate(d.getDate() - daysAgo);
  return localDayKeyFromMs(d.getTime());
}

function windowDayKeys(asOfMs, days) {
  const keys = [];
  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    keys.push(dayKeyDaysAgo(asOfMs, daysAgo));
  }
  return keys;
}

function fmtKg(v, decimals = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(decimals)} kg`;
}

function computeAge(birthdate) {
  const b = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function deriveFiberTargetFromCarbs(carb_g) {
  const c = Math.max(0, carb_g);
  if (c <= LOW_CARB_FIBER_THRESHOLD_G) return Math.min(Math.round(0.5 * c), c);
  return Math.min(STANDARD_FIBER_TARGET_G, c);
}

function macroKcalFromPcf(p, c, f) {
  return Math.round(4 * p + 4 * c + 9 * f);
}

function parseCarbCapFromRules(rules) {
  if (!rules) return null;
  const blob = [rules.aiContext ?? '', ...(rules.constraints ?? []), rules.rawText ?? ''].join('\n').toLowerCase();
  const lt = blob.match(/(?:<|under|max|maximum|up to|עד|מקס(?:ימום)?)\s*(\d+)\s*g?\s*(?:carb|carbs|פחמימ)/i);
  if (lt) {
    const n = parseInt(lt[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function postProcessMacroSuggestion(raw, rules) {
  let m = { ...raw };
  m.fiber_g = deriveFiberTargetFromCarbs(m.carb_g);
  const cap = parseCarbCapFromRules(rules);
  if (cap != null && m.carb_g > cap) {
    m.carb_g = cap;
    m.fiber_g = deriveFiberTargetFromCarbs(m.carb_g);
  }
  const computed = macroKcalFromPcf(m.protein_g, m.carb_g, m.fat_g);
  if (Math.abs(computed - m.kcal) > 50) m.kcal = computed;
  return m;
}

function formatCurrentMacroTarget(mt) {
  if (!mt) return 'Current macro target: none (user reset or not set)';
  const fi = mt.fiber_g ?? deriveFiberTargetFromCarbs(mt.carb_g);
  return `Current macro target: ${mt.kcal} kcal | P${mt.protein_g}g C${mt.carb_g}g F${mt.fat_g}g Fi${fi}g | ${mt.diet_label}`;
}

function formatBodyTarget(bt) {
  if (!bt) return 'Body target: not set';
  return [
    `Body target: ${bt.targetWeight_kg} kg | fat ${bt.targetFatPct}% | muscle ${bt.targetMuscleMass_kg} kg`,
    `Start: ${bt.startWeight_kg} kg | muscle ${bt.startMuscle_kg} kg`,
  ].join('\n');
}

function formatUserRulesBlock(rules) {
  if (!rules) return null;
  const lines = ['My Rules — AI understood:'];
  if (rules.summary) lines.push(`Summary: ${rules.summary}`);
  for (const c of rules.constraints ?? []) lines.push(`- ${c}`);
  if (rules.aiContext) lines.push(`Constraints: ${rules.aiContext}`);
  return lines.join('\n');
}

function formatProfileBasics(opts) {
  return [
    `Profile: sex ${opts.gender ?? 'unknown'} | age ${opts.age ?? '—'} | height ${opts.heightCm ?? '—'} cm`,
    `Weight: ${fmtKg(opts.weightKg)} | lean mass ${opts.leanMassKg != null ? `${opts.leanMassKg.toFixed(1)} kg` : '—'} | BMR ${opts.bmr_kcal ?? '—'} kcal/day`,
    `7-day avg burn: ${opts.avgBurn7d ?? '—'} kcal/day`,
  ].join('\n');
}

function formatWeightTrendLines(days, lookback) {
  const withWeight = days.filter((d) => d.weightKg != null).slice(-lookback);
  if (withWeight.length === 0) return null;
  const lines = [`WEIGHT TREND (${withWeight.length}d):`];
  for (const d of withWeight) lines.push(`  ${d.dayKey}: ${fmtKg(d.weightKg)}`);
  const first = withWeight[0].weightKg;
  const last = withWeight[withWeight.length - 1].weightKg;
  lines.push(`  Δ ${(last - first).toFixed(1)} kg over window`);
  return lines.join('\n');
}

function formatBodyCompTrendLines(days, lookback) {
  const slice = days.slice(-lookback);
  if (slice.length === 0) return null;
  const lines = [`BODY COMP TREND (${slice.length}d):`];
  for (const d of slice) {
    lines.push(
      `  ${d.dayKey}: W ${fmtKg(d.weightKg)} | fat ${d.fatMassKg != null ? `${d.fatMassKg.toFixed(1)} kg` : '—'} | muscle ${d.muscleMassKg != null ? `${d.muscleMassKg.toFixed(1)} kg` : '—'} | visceral ${d.visceralFatIndex ?? '—'}`,
    );
  }
  return lines.join('\n');
}

function formatResultLine(r) {
  const parts = [`${r.code} ${r.value} ${r.unit}`];
  const extras = [];
  if (r.referenceText) extras.push(r.referenceText);
  if (r.flag === 'high' || r.flag === 'low') extras.push(r.flag);
  if (extras.length > 0) parts.push(`(${extras.join(', ')})`);
  return parts.join(' ');
}

function formatReportBlock(report, prefix) {
  const date = report.collectedAt.slice(0, 10);
  const provider = report.labProvider === 'clalit' ? 'Clalit' : 'Lab';
  const types = report.panels.map((p) => p.panelType).join(' + ');
  const lines = [`${prefix} ${date} (${provider}) — ${types}:`];
  for (const panel of report.panels) {
    const row = panel.results.map(formatResultLine).join(' | ');
    if (row) lines.push(`  ${row}`);
  }
  return lines;
}

function buildLabsForMacroRevision(store) {
  const reports = Object.keys(store)
    .filter((k) => k.startsWith('lab_report_'))
    .map((k) => j(store, k))
    .filter(Boolean)
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  const slice = reports.slice(0, 2);
  if (slice.length === 0) return null;
  const header =
    slice.length === 1
      ? 'LAB RESULTS (latest draw — local PDFs, not medical advice):'
      : `LAB HISTORY (${slice.length} draws in review window — not medical advice):`;
  const lines = [header];
  for (const r of slice) lines.push(...formatReportBlock(r, 'Report'));
  return lines.join('\n');
}

function computeBurnKcalByDay(bodyDays, caloriePoints, sessions) {
  const BUCKET_MS = 30 * 60 * 1000;
  const bmrByDay = new Map();
  for (const d of bodyDays) {
    if (d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay)) bmrByDay.set(d.dayKey, d.bmrKcalDay);
  }
  const passiveByDay = new Map();
  for (const pt of caloriePoints ?? []) {
    const t = new Date(pt.timestamp).getTime();
    const dk = localDayKeyFromMs(t);
    if (!passiveByDay.has(dk)) passiveByDay.set(dk, new Map());
    const bk = Math.floor(t / BUCKET_MS) * BUCKET_MS;
    const m = passiveByDay.get(dk);
    m.set(bk, (m.get(bk) ?? 0) + pt.kcal);
  }
  const workoutKcalByDay = new Map();
  const workoutBucketsByDay = new Map();
  for (const w of sessions ?? []) {
    const dk = localDayKeyFromMs(w.startMs);
    workoutKcalByDay.set(dk, (workoutKcalByDay.get(dk) ?? 0) + w.kcal);
    if (!workoutBucketsByDay.has(dk)) workoutBucketsByDay.set(dk, new Set());
    const bkSet = workoutBucketsByDay.get(dk);
    const firstBk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS;
    for (let bk = firstBk; bk < w.endMs; bk += BUCKET_MS) bkSet.add(bk);
  }
  const allDayKeys = new Set([...bmrByDay.keys(), ...passiveByDay.keys(), ...workoutKcalByDay.keys()]);
  const result = new Map();
  for (const dk of allDayKeys) {
    const bmr = bmrByDay.get(dk);
    if (bmr == null || !Number.isFinite(bmr)) continue;
    const wktBuckets = workoutBucketsByDay.get(dk) ?? new Set();
    const wktKcal = workoutKcalByDay.get(dk) ?? 0;
    let passiveKcal = 0;
    for (const [bk, kcal] of passiveByDay.get(dk) ?? new Map()) {
      if (!wktBuckets.has(bk)) passiveKcal += kcal;
    }
    result.set(dk, Math.round(bmr + passiveKcal + wktKcal));
  }
  return result;
}

function get7DayAverageBurnKcal(store, asOfMs) {
  const withings = j(store, 'healthings:withingsStore', {});
  const dayKeys = windowDayKeys(asOfMs, 7);
  const burnByDay = computeBurnKcalByDay(withings.bodyTrendDays ?? [], withings.calories ?? [], withings.workouts ?? []);
  const burns = [];
  for (const dk of dayKeys) {
    const b = burnByDay.get(dk);
    if (b != null && b > 0) burns.push(b);
  }
  if (burns.length === 0) return null;
  return Math.round(burns.reduce((a, b) => a + b, 0) / burns.length);
}

function entryFiber_g(entry) {
  if (entry.totalFiber_g != null && Number.isFinite(entry.totalFiber_g)) return entry.totalFiber_g;
  return (entry.items ?? []).reduce((acc, item) => acc + (item.fiber_g ?? 0), 0);
}

function getDailyMacros(store, dk) {
  const entries = j(store, `food_log_${dk}`, []);
  const macros = { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0, entries };
  for (const e of entries) {
    macros.kcal += e.totalKcal ?? 0;
    macros.protein_g += e.totalProtein_g ?? 0;
    macros.carb_g += e.totalCarb_g ?? 0;
    macros.fat_g += e.totalFat_g ?? 0;
    macros.fiber_g += entryFiber_g(e);
  }
  return macros;
}

function buildMealsAiContext(entries) {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const formatMeal = (entry, index) => {
    const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const itemLines =
      entry.items?.length > 0
        ? entry.items
            .map((i) => {
              const name = i.name_local || i.name;
              return `    • ${name}: ${Math.round(i.grams)}g, ${Math.round(i.kcal)} kcal, P${i.protein_g}g C${i.carb_g}g F${i.fat_g}g Fi${i.fiber_g ?? 0}g`;
            })
            .join('\n')
        : '    • (items not stored — totals only)';
    return [
      `Meal ${index + 1} at ${time}:`,
      itemLines,
      `  Total: ${entry.totalKcal} kcal | P${entry.totalProtein_g}g C${entry.totalCarb_g}g F${entry.totalFat_g}g Fi${entryFiber_g(entry)}g`,
      entry.note ? `  Note: ${entry.note}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  };
  return sorted.map((e, i) => formatMeal(e, i)).join('\n\n');
}

function filterGlucoseToDayKeys(glucose, dayKeys) {
  const set = new Set(dayKeys);
  return (glucose ?? []).filter((p) => set.has(localDayKeyFromMs(new Date(p.timestamp).getTime())));
}

function computeCgmRangeDistribution(values) {
  const vals = values.filter((v) => v > 0);
  if (vals.length === 0) return null;
  let below70 = 0;
  let between70And100 = 0;
  let above100 = 0;
  for (const v of vals) {
    if (v < 70) below70++;
    else if (v <= 100) between70And100++;
    else above100++;
  }
  const n = vals.length;
  return {
    sampleCount: n,
    pctBelow70: Math.round((below70 / n) * 100),
    pctBetween70And100: Math.round((between70And100 / n) * 100),
    pctAbove100: Math.round((above100 / n) * 100),
  };
}

function buildPeriodGlucoseStatsLines(dayKeys, glucose) {
  const trustedVals = [];
  const dayRows = [];
  for (const dk of dayKeys) {
    const day = glucose.filter((p) => localDayKeyFromMs(new Date(p.timestamp).getTime()) === dk);
    const vals = day.map((p) => p.value).filter((v) => v > 0);
    if (vals.length === 0) continue;
    trustedVals.push(...vals);
    dayRows.push({
      dk,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      min: Math.min(...vals),
      max: Math.max(...vals),
    });
  }
  if (trustedVals.length === 0) return ['Period CGM stats: no trusted readings in window'];
  const periodAvg = Math.round(trustedVals.reduce((a, b) => a + b, 0) / trustedVals.length);
  const periodMin = Math.min(...trustedVals);
  const periodMax = Math.max(...trustedVals);
  const pctAbove140 = Math.round((trustedVals.filter((v) => v > 140).length / trustedVals.length) * 100);
  const dist = computeCgmRangeDistribution(trustedVals);
  const lines = [
    `Period CGM (trusted): avg ${periodAvg} | min ${periodMin} | max ${periodMax} mg/dL | ${pctAbove140}% readings >140 | ${trustedVals.length} samples / ${dayRows.length} days`,
    'Mentor MUST quote period avg, min, and max (mg/dL) in the reply — not vague summaries.',
  ];
  if (dist) {
    lines.push(
      `Time in range (by readings): ${dist.pctBelow70}% below 70 | ${dist.pctBetween70And100}% 70–100 | ${dist.pctAbove100}% above 100 mg/dL (${dist.sampleCount} samples)`,
    );
  }
  return lines;
}

// ── Meal ↔ CGM correlation (ported from mealGlucoseAnalysis.ts) ─────────────

const PRE_MEAL_LOOKBACK_MIN = 25;
const POST_MEAL_WINDOW_MIN = 120;
const PEAK_START_AFTER_MIN = 5;
const SAMPLE_MATCH_TOLERANCE_MIN = 8;

function sortGlucose(glucose) {
  return glucose
    .map((p) => ({ ms: new Date(p.timestamp).getTime(), value: p.value }))
    .filter((p) => !Number.isNaN(p.ms) && p.value > 0)
    .sort((a, b) => a.ms - b.ms);
}

function glucoseOnDay(glucose, dayKey) {
  return glucose.filter((p) => localDayKeyFromMs(new Date(p.timestamp).getTime()) === dayKey);
}

function avgInWindow(samples, startMs, endMs) {
  const inWin = samples.filter((s) => s.ms >= startMs && s.ms <= endMs);
  if (inWin.length === 0) return null;
  return Math.round(inWin.reduce((sum, s) => sum + s.value, 0) / inWin.length);
}

function maxInWindow(samples, startMs, endMs) {
  const inWin = samples.filter((s) => s.ms >= startMs && s.ms <= endMs);
  if (inWin.length === 0) return null;
  return inWin.reduce((best, s) => (s.value > best.value ? s : best));
}

function nearestValue(samples, targetMs, toleranceMin) {
  const tol = toleranceMin * 60 * 1000;
  let best = null;
  let bestDist = Infinity;
  for (const s of samples) {
    const dist = Math.abs(s.ms - targetMs);
    if (dist <= tol && dist < bestDist) {
      best = s;
      bestDist = dist;
    }
  }
  return best ? Math.round(best.value) : null;
}

function mealFoodSummary(entry) {
  if (!entry.items?.length) return `${entry.totalKcal} kcal, ${Math.round(entry.totalCarb_g)}g carbs`;
  const names = entry.items.slice(0, 3).map((i) => i.name_local || i.name);
  const suffix = entry.items.length > 3 ? ` +${entry.items.length - 3} more` : '';
  return `${names.join(', ')}${suffix} (${entry.totalKcal} kcal, ${Math.round(entry.totalCarb_g)}g C)`;
}

function mealFoodNames(entry) {
  return (entry.items ?? []).map((i) => i.name_local || i.name).filter(Boolean);
}

function classifyResponse(peakDelta, peakMgDl, preMealMgDl, postSampleCount) {
  if (preMealMgDl == null || postSampleCount < 2) return 'insufficient_data';
  if (peakDelta == null) return 'insufficient_data';
  if (peakDelta >= 50 || (peakMgDl != null && peakMgDl >= 180)) return 'sharp_spike';
  if (peakDelta >= 30 || (peakMgDl != null && peakMgDl >= 140)) return 'moderate_rise';
  return 'steady';
}

function assessmentLabel(a) {
  switch (a) {
    case 'steady':
      return 'steady response';
    case 'moderate_rise':
      return 'moderate post-meal rise';
    case 'sharp_spike':
      return 'sharp spike — review carbs/portions';
    default:
      return 'insufficient CGM data in window';
  }
}

function analyzeMealGlucoseResponse(meals, glucose) {
  if (meals.length === 0 || glucose.length === 0) return [];
  const samples = sortGlucose(glucose);
  const sortedMeals = [...meals].sort((a, b) => a.timestamp - b.timestamp);
  return sortedMeals.map((meal, index) => {
    const t = meal.timestamp;
    const preStart = t - PRE_MEAL_LOOKBACK_MIN * 60 * 1000;
    const preEnd = t;
    const peakStart = t + PEAK_START_AFTER_MIN * 60 * 1000;
    const postEnd = t + POST_MEAL_WINDOW_MIN * 60 * 1000;
    const preMealMgDl = avgInWindow(samples, preStart, preEnd);
    const peak = maxInWindow(samples, peakStart, postEnd);
    const peakMgDl = peak ? Math.round(peak.value) : null;
    const peakDeltaMgDl = preMealMgDl != null && peakMgDl != null ? peakMgDl - preMealMgDl : null;
    const peakMinutesAfter = peak != null ? Math.round((peak.ms - t) / (60 * 1000)) : null;
    const at60MinMgDl = nearestValue(samples, t + 60 * 60 * 1000, SAMPLE_MATCH_TOLERANCE_MIN);
    const at120MinMgDl = nearestValue(samples, t + POST_MEAL_WINDOW_MIN * 60 * 1000, SAMPLE_MATCH_TOLERANCE_MIN);
    const postSampleCount = samples.filter((s) => s.ms >= peakStart && s.ms <= postEnd).length;
    const assessment = classifyResponse(peakDeltaMgDl, peakMgDl, preMealMgDl, postSampleCount);
    return {
      mealIndex: index + 1,
      mealTimeLabel: new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      foodSummary: mealFoodSummary(meal),
      preMealMgDl,
      peakMgDl,
      peakDeltaMgDl,
      peakMinutesAfter,
      at60MinMgDl,
      at120MinMgDl,
      postSampleCount,
      assessment,
    };
  });
}

function formatMealGlucoseResultLine(r) {
  const lines = [`Meal ${r.mealIndex} at ${r.mealTimeLabel}: ${r.foodSummary}`];
  if (r.assessment === 'insufficient_data') {
    lines.push('  CGM: insufficient readings in 25 min before / 2 h after meal');
    return lines.join('\n');
  }
  lines.push(`  Pre-meal (25 min avg): ${r.preMealMgDl} mg/dL`);
  if (r.peakMgDl != null && r.peakDeltaMgDl != null && r.peakMinutesAfter != null) {
    const sign = r.peakDeltaMgDl >= 0 ? '+' : '';
    lines.push(
      `  Peak: ${r.peakMgDl} mg/dL at +${r.peakMinutesAfter} min (${sign}${r.peakDeltaMgDl} mg/dL vs pre-meal)`,
    );
  }
  if (r.at60MinMgDl != null) lines.push(`  At +60 min: ${r.at60MinMgDl} mg/dL`);
  if (r.at120MinMgDl != null) lines.push(`  At +120 min: ${r.at120MinMgDl} mg/dL`);
  lines.push(`  Assessment: ${assessmentLabel(r.assessment)} (${r.postSampleCount} post-meal samples)`);
  return lines.join('\n');
}

function buildDayMealGlucoseBlock(meals, glucose, dayKey) {
  const dayGlucose = glucoseOnDay(glucose, dayKey);
  if (dayGlucose.length === 0) return null;
  if (meals.length === 0) {
    const vals = dayGlucose.map((p) => p.value).filter((v) => v > 0);
    if (vals.length === 0) return null;
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    return `DAY CGM: avg ${avg} | min ${Math.min(...vals)} | max ${Math.max(...vals)} mg/dL (${vals.length} samples)`;
  }
  const results = analyzeMealGlucoseResponse(meals, dayGlucose);
  if (results.length === 0) return null;
  return ['MEAL GLUCOSE:', ...results.map((r) => `  ${formatMealGlucoseResultLine(r).replace(/\n/g, '\n  ')}`)].join('\n');
}

function collectSpikeMeals(dayKey, meals, glucose) {
  const dayGlucose = glucoseOnDay(glucose, dayKey);
  if (meals.length === 0 || dayGlucose.length === 0) return [];
  const sortedMeals = [...meals].sort((a, b) => a.timestamp - b.timestamp);
  const results = analyzeMealGlucoseResponse(meals, dayGlucose);
  return results
    .filter((r) => r.assessment === 'sharp_spike' || r.assessment === 'moderate_rise')
    .map((r) => ({
      dayKey,
      mealTimeLabel: r.mealTimeLabel,
      foodNames: sortedMeals[r.mealIndex - 1] ? mealFoodNames(sortedMeals[r.mealIndex - 1]) : [],
      peakDeltaMgDl: r.peakDeltaMgDl ?? 0,
      assessment: r.assessment,
    }));
}

function buildProblemFoodsLines(spikeMeals, hasAnyMeals) {
  if (!hasAnyMeals) {
    return [
      'FOODS LINKED TO HIGHER GLUCOSE: no meals logged in period — log meals with times to identify food triggers.',
    ];
  }
  if (spikeMeals.length === 0) {
    return ['FOODS LINKED TO HIGHER GLUCOSE: no moderate/sharp post-meal rises detected in logged meals'];
  }
  const byFood = new Map();
  for (const sm of spikeMeals) {
    for (const name of sm.foodNames) {
      const key = name.trim();
      if (!key) continue;
      const prev = byFood.get(key) ?? { count: 0, totalDelta: 0 };
      byFood.set(key, { count: prev.count + 1, totalDelta: prev.totalDelta + sm.peakDeltaMgDl });
    }
  }
  const ranked = [...byFood.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].totalDelta - a[1].totalDelta)
    .slice(0, 8);
  const lines = ['FOODS LINKED TO HIGHER GLUCOSE (appeared before moderate/sharp rises — review portions/swaps):'];
  for (const [name, stat] of ranked) {
    const avgDelta = Math.round(stat.totalDelta / stat.count);
    lines.push(`  • ${name} — ${stat.count} meal(s), avg peak rise +${avgDelta} mg/dL`);
  }
  lines.push('', 'MEALS WITH ELEVATED GLUCOSE RESPONSE:');
  for (const sm of spikeMeals) {
    const foods = sm.foodNames.length > 0 ? sm.foodNames.join(', ') : '(items not stored)';
    const tag = sm.assessment === 'sharp_spike' ? 'sharp spike' : 'moderate rise';
    lines.push(`  ${sm.dayKey} ${sm.mealTimeLabel}: ${foods} (+${Math.round(sm.peakDeltaMgDl)} mg/dL, ${tag})`);
  }
  return lines;
}

function buildPeriodMealGlucoseSection(dayKeys, macrosByDay, glucose) {
  if (glucose.length === 0) return null;
  const spikeMeals = [];
  let daysWithCgm = 0;
  let totalMeals = 0;
  for (const dk of dayKeys) {
    const dayG = glucoseOnDay(glucose, dk);
    if (dayG.length > 0) daysWithCgm++;
    const meals = macrosByDay.get(dk)?.entries ?? [];
    totalMeals += meals.length;
    spikeMeals.push(...collectSpikeMeals(dk, meals, glucose));
  }
  const lines = [
    'GLUCOSE & FOOD IMPACT (period):',
    `CGM samples in window: ${sortGlucose(glucose).length} | Days with CGM: ${daysWithCgm}/${dayKeys.length}`,
    ...buildPeriodGlucoseStatsLines(dayKeys, glucose),
    'Match each meal to pre-meal baseline and 2 h peak (~5 min CGM). Flag foods before moderate/sharp rises.',
    '',
    ...buildProblemFoodsLines(spikeMeals, totalMeals > 0),
  ];
  return lines.join('\n');
}

function formatBodyMetrics(day) {
  if (!day) return 'BODY: no Withings data';
  return `BODY: W ${fmtKg(day.weightKg)} | fat ${day.fatMassKg != null ? `${day.fatMassKg.toFixed(1)} kg` : '—'} | muscle ${day.muscleMassKg != null ? `${day.muscleMassKg.toFixed(1)} kg` : '—'} | BMR ${day.bmrKcalDay ?? '—'} kcal`;
}

function formatEnergyLine(eaten, burn) {
  if (burn == null) return `ENERGY: ${eaten} kcal eaten | burn unknown`;
  const delta = eaten - burn;
  const sign = delta >= 0 ? '+' : '';
  return `ENERGY: ${eaten} kcal eaten | ~${burn} kcal burn | ${sign}${delta} kcal`;
}

function formatFoodBlock(dk, macros) {
  const header = [
    `${Math.round(macros.kcal)} kcal eaten`,
    `P${Math.round(macros.protein_g)}g C${Math.round(macros.carb_g)}g F${Math.round(macros.fat_g)}g Fi${Math.round(macros.fiber_g ?? 0)}g`,
    `${macros.entries.length} meals`,
  ].join(' | ');
  if (macros.entries.length === 0) return header;
  const detail = buildMealsAiContext(macros.entries);
  return detail ? `${header}\n${detail}` : header;
}

function buildMacroEatenSummary(dayKeys, macrosByDay) {
  let mealDays = 0;
  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  for (const dk of dayKeys) {
    const m = macrosByDay.get(dk);
    if (!m || m.entries.length === 0) continue;
    mealDays++;
    totalKcal += m.kcal;
    totalProtein += m.protein_g;
    totalCarbs += m.carb_g;
    totalFat += m.fat_g;
    totalFiber += m.fiber_g ?? 0;
  }
  if (mealDays === 0) return 'FOOD MACROS (7d): no logged meals in period';
  return [
    'FOOD MACROS (7d, eaten only — not targets):',
    `${mealDays}/${dayKeys.length} days with meals`,
    `avg ${Math.round(totalKcal / mealDays)} kcal | P${Math.round(totalProtein / mealDays)}g C${Math.round(totalCarbs / mealDays)}g F${Math.round(totalFat / mealDays)}g Fi${Math.round(totalFiber / mealDays)}g`,
  ].join(' | ');
}

function buildMacroAdherenceSummary(dayKeys, macrosByDay, target) {
  if (!target) return '';
  let mealDays = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalKcal = 0;
  for (const dk of dayKeys) {
    const m = macrosByDay.get(dk);
    if (!m || m.entries.length === 0) continue;
    mealDays++;
    totalProtein += m.protein_g;
    totalCarbs += m.carb_g;
    totalFat += m.fat_g;
    totalKcal += m.kcal;
  }
  if (mealDays === 0) return 'MACRO ADHERENCE: no logged meal days in period';
  const avgP = Math.round(totalProtein / mealDays);
  const avgC = Math.round(totalCarbs / mealDays);
  const avgF = Math.round(totalFat / mealDays);
  const avgK = Math.round(totalKcal / mealDays);
  return [
    'MACRO ADHERENCE (days with meals):',
    `  Target: ${target.kcal} kcal P${target.protein_g} C${target.carb_g} F${target.fat_g}`,
    `  Avg eaten (${mealDays}d): ${avgK} kcal P${avgP} C${avgC} F${avgF}`,
  ].join('\n');
}

function buildTrendSection(windowKeys, bodyDays) {
  const windowSet = new Set(windowKeys);
  const inWindow = bodyDays.filter((d) => windowSet.has(d.dayKey));
  const weightVals = inWindow.map((d) => d.weightKg).filter((v) => v != null);
  const lines = ['TREND ANALYSIS (period):'];
  if (weightVals.length >= 2) {
    const start = weightVals[0];
    const end = weightVals[weightVals.length - 1];
    const dW = end - start;
    lines.push(`  Weight: ${start.toFixed(1)} → ${end.toFixed(1)} kg (Δ ${dW >= 0 ? '+' : ''}${dW.toFixed(1)} kg)`);
  } else {
    lines.push('  Weight: insufficient data');
  }
  const bmrVals = inWindow.map((d) => d.bmrKcalDay).filter((v) => v != null);
  if (bmrVals.length >= 2) {
    const avg = Math.round(bmrVals.reduce((a, b) => a + b, 0) / bmrVals.length);
    lines.push(`  BMR: avg ${avg} kcal/day (${bmrVals.length} days with data)`);
  }
  return lines.join('\n');
}

function buildPeriodReviewBlock(store, asOfMs) {
  const dayKeys = windowDayKeys(asOfMs, 7);
  const withings = j(store, 'healthings:withingsStore', {});
  const metrics = j(store, 'healthings:lastMetrics', {});
  const bodyDays = withings.bodyTrendDays ?? [];
  const bodyByDay = new Map(bodyDays.map((d) => [d.dayKey, d]));
  const burnByDay = computeBurnKcalByDay(bodyDays, withings.calories ?? [], withings.workouts ?? []);
  const macrosByDay = new Map(dayKeys.map((dk) => [dk, getDailyMacros(store, dk)]));
  const periodGlucose = filterGlucoseToDayKeys(metrics.glucose ?? [], dayKeys);

  const lines = [
    `=== ${dayKeys.length}-DAY RAW DATA (${dayKeys[0]} → ${dayKeys[dayKeys.length - 1]}) ===`,
    '',
    buildTrendSection(dayKeys, bodyDays),
    buildMacroEatenSummary(dayKeys, macrosByDay),
  ];

  if (periodGlucose.length > 0) {
    const glucoseSection = buildPeriodMealGlucoseSection(dayKeys, macrosByDay, periodGlucose);
    if (glucoseSection) lines.push('', glucoseSection);
  } else {
    lines.push('', 'GLUCOSE: no CGM data in 7-day window.');
  }

  lines.push('', 'DAILY DETAIL (newest last):');
  for (const dk of dayKeys) {
    const macros = macrosByDay.get(dk);
    const eaten = Math.round(macros.kcal);
    const dayLines = [
      '',
      `--- ${dk} ---`,
      formatBodyMetrics(bodyByDay.get(dk)),
      formatEnergyLine(eaten, burnByDay.get(dk)),
      'FOOD & MEALS:',
      formatFoodBlock(dk, macros),
    ];
    const mealGlucoseBlock = buildDayMealGlucoseBlock(macros.entries, periodGlucose, dk);
    if (mealGlucoseBlock) dayLines.push(mealGlucoseBlock);
    dayLines.push(
      'WORKOUTS:',
      `  ${(withings.workouts ?? []).filter((w) => localDayKeyFromMs(w.startMs) === dk).length > 0 ? 'see Withings workouts in app' : 'No workouts logged.'}`,
    );
    lines.push(...dayLines);
  }
  lines.push('', `=== END ${dayKeys.length}-DAY RAW DATA ===`);
  return lines.filter((l) => l !== '').join('\n');
}

function buildMacroRevisionContext(store, asOfMs, trigger = 'chat-proposal') {
  const macroTarget = j(store, 'daily_macro_target');
  const bodyTarget = j(store, 'body_target');
  const userRules = j(store, 'user_rules');
  const withings = j(store, 'healthings:withingsStore', {});
  const scan = withings.bodyScan ?? {};
  const weightKg = scan.weightKg ?? null;
  const fatMassKg = scan.fatMassKg ?? null;
  const leanMassKg = weightKg != null && fatMassKg != null ? weightKg - fatMassKg : null;
  const bmr_kcal = scan.bmrKcalDay ?? null;
  const birthdate = store.user_birthdate ?? null;
  const age = birthdate ? computeAge(birthdate) : null;
  const gender = store.user_gender ?? null;
  const heightCm = store.user_height_cm ? Number(store.user_height_cm) : null;
  const avgBurn7d = get7DayAverageBurnKcal(store, asOfMs);

  const period7 = buildPeriodReviewBlock(store, asOfMs);
  const weightTrend14 = formatWeightTrendLines(withings.bodyTrendDays ?? [], 14);
  const bodyTrend28 = formatBodyCompTrendLines(withings.bodyTrendDays ?? [], 28);
  const labs = buildLabsForMacroRevision(store);

  return [
    `=== MACRO REVISION (${trigger}) ===`,
    formatBodyTarget(bodyTarget),
    formatUserRulesBlock(userRules),
    formatProfileBasics({ age, gender, heightCm, weightKg, fatMassKg, bmr_kcal, leanMassKg, avgBurn7d }),
    weightTrend14,
    bodyTrend28,
    labs,
    period7,
    'Derive daily macro TARGETS from the raw data above (not meal advice). Do not copy prior app targets — conclude P/C/F/kcal from weight goal, burn, food eaten, CGM, labs, and rules.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function langInstruction(lang) {
  if (!lang || lang.code === 'en') return '';
  return `\nRespond entirely in ${lang.label} (${lang.code}). All text in the response must be in ${lang.label}.`;
}

function buildFullPrompt(contextText, lang) {
  return `${MACRO_REVISION_PROMPT}${langInstruction(lang)}

---

## Macro revision data

${contextText}`;
}

async function callGemini(prompt, apiKey, temperature = 0) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 8192 },
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini ${response.status}: ${err.slice(0, 300)}`);
  }
  const json = await response.json();
  const finishReason = json?.candidates?.[0]?.finishReason ?? 'UNKNOWN';
  const raw = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return parseMacroSuggestionRaw(raw, finishReason);
}

function parseMacroSuggestionRaw(raw, finishReason = 'UNKNOWN') {
  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  try {
    const parsed = JSON.parse(cleaned);
    return normalizeMacroParsed(parsed);
  } catch {
    const pick = (key) => {
      const m = stripped.match(new RegExp(`"${key}"\\s*:\\s*("([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|(-?\\d+(?:\\.\\d+)?))`));
      if (!m) return null;
      if (m[2] != null) return m[2].replace(/\\"/g, '"');
      return Number(m[3]);
    };
    const protein_g = pick('protein_g');
    const fat_g = pick('fat_g');
    const carb_g = pick('carb_g');
    const fiber_g = pick('fiber_g');
    const kcal = pick('kcal');
    const diet_label = pick('diet_label');
    const reasoning = pick('reasoning');
    if ([protein_g, fat_g, carb_g, kcal].some((v) => v == null || Number.isNaN(Number(v)))) {
      const hint = finishReason === 'MAX_TOKENS' ? ' (truncated)' : '';
      throw new Error(`Could not parse macro JSON${hint}: ${raw.slice(0, 200)}`);
    }
    return normalizeMacroParsed({
      protein_g,
      fat_g,
      carb_g,
      fiber_g: fiber_g ?? 0,
      kcal,
      diet_label: diet_label ?? 'Custom',
      reasoning: reasoning ?? raw.slice(0, 500),
    });
  }
}

function normalizeMacroParsed(parsed) {
  return {
    protein_g: Math.round(Number(parsed.protein_g) || 0),
    fat_g: Math.round(Number(parsed.fat_g) || 0),
    carb_g: Math.round(Number(parsed.carb_g) || 0),
    fiber_g: Math.round(Number(parsed.fiber_g) || 0),
    kcal: Math.round(Number(parsed.kcal) || 0),
    diet_label: String(parsed.diet_label ?? 'Custom'),
    reasoning: String(parsed.reasoning ?? ''),
  };
}

function averageMacros(a, b) {
  return {
    protein_g: Math.round((a.protein_g + b.protein_g) / 2),
    fat_g: Math.round((a.fat_g + b.fat_g) / 2),
    carb_g: Math.round((a.carb_g + b.carb_g) / 2),
    fiber_g: Math.round((a.fiber_g + b.fiber_g) / 2),
    kcal: Math.round((a.kcal + b.kcal) / 2),
    diet_label: a.diet_label === b.diet_label ? a.diet_label : `${a.diet_label} / ${b.diet_label}`,
    reasoning: `[Run 1] ${a.reasoning}\n\n[Run 2] ${b.reasoning}`,
  };
}

function formatSuggestion(label, s) {
  return `${label}: ${s.kcal} kcal · P${s.protein_g} · C${s.carb_g} · F${s.fat_g} · Fi${s.fiber_g} · ${s.diet_label}\n  ${s.reasoning.slice(0, 400)}${s.reasoning.length > 400 ? '…' : ''}`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.backup) {
    console.error('Usage: node scripts/preview-macro-prompt.mjs <backup.json> [--out file.txt] [--gemini] [--double]');
    process.exit(1);
  }

  const backupPath = resolve(args.backup);
  const payload = JSON.parse(readFileSync(backupPath, 'utf8'));
  if (payload.version !== 1 || payload.app !== 'healthings-medilab' || !payload.asyncStorage) {
    throw new Error('Invalid backup file format.');
  }

  const store = payload.asyncStorage;
  const asOfMs = Date.parse(payload.exportedAt) || Date.now();
  const lang = j(store, 'user_language');
  const userRules = j(store, 'user_rules');
  const contextText = buildMacroRevisionContext(store, asOfMs, 'chat-proposal');
  const fullPrompt = buildFullPrompt(contextText, lang);

  const defaultOut = join(ROOT, `macro-prompt-preview_${localDayKeyFromMs(asOfMs)}.txt`);
  const outPath = args.out ? resolve(args.out) : defaultOut;
  writeFileSync(outPath, fullPrompt, 'utf8');

  console.log(`Wrote prompt (${fullPrompt.length.toLocaleString()} chars) → ${outPath}`);
  console.log(`As-of: ${payload.exportedAt}`);
  console.log(`7d avg burn (recomputed): ${get7DayAverageBurnKcal(store, asOfMs) ?? '—'} kcal`);
  console.log(`Carb cap from rules: ${parseCarbCapFromRules(userRules) ?? 'none'}`);
  const mt = j(store, 'daily_macro_target');
  if (mt) console.log(`Saved target: ${mt.kcal} kcal P${mt.protein_g} C${mt.carb_g} F${mt.fat_g} Fi${mt.fiber_g ?? '—'}`);

  if (!args.gemini) {
    console.log('\nTip: add --gemini to call the API; --double runs twice and averages P/C/F/kcal.');
    return;
  }

  const apiKey = loadEnvKey();
  if (!apiKey) {
    console.error('No GEMINI_API_KEY in app/.env.prod or app/.env.dev');
    process.exit(1);
  }

  console.log('\nCalling Gemini (temperature 0)…');
  const run1 = postProcessMacroSuggestion(await callGemini(fullPrompt, apiKey), userRules);
  console.log(formatSuggestion('Run 1', run1));

  if (!args.double) return;

  const run2 = postProcessMacroSuggestion(await callGemini(fullPrompt, apiKey), userRules);
  console.log(formatSuggestion('Run 2', run2));

  const avg = postProcessMacroSuggestion(averageMacros(run1, run2), userRules);
  console.log(formatSuggestion('Average (post-processed)', avg));

  const deltas = {
    kcal: Math.abs(run1.kcal - run2.kcal),
    protein: Math.abs(run1.protein_g - run2.protein_g),
    carb: Math.abs(run1.carb_g - run2.carb_g),
    fat: Math.abs(run1.fat_g - run2.fat_g),
  };
  console.log(`\nRun1↔Run2 spread: Δkcal ${deltas.kcal} · ΔP ${deltas.protein} · ΔC ${deltas.carb} · ΔF ${deltas.fat}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
