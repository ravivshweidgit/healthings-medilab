import { gunzipSync, inflateSync } from 'node:zlib';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import type { ClinicChatMessage, ClinicUserRules } from './clinicOverlay.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 60_000;

type MentorType = 'doctor' | 'nutritionist' | 'coach';

type GeminiPart = { text?: string; thought?: boolean };

type GeminiGenOptions = {
  temperature: number;
  maxOutputTokens: number;
  /** 0 = off. Bound thinking so visible reply keeps most of maxOutputTokens. */
  thinkingBudget?: number;
};

function geminiGenerationConfig(config: GeminiGenOptions): Record<string, unknown> {
  return {
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    thinkingConfig: {
      thinkingBudget: config.thinkingBudget ?? 0,
      includeThoughts: false,
    },
  };
}

/** Prefer non-thought parts (matches phone GeminiService). */
function extractGeminiText(candidate: { content?: { parts?: GeminiPart[] } } | undefined): string {
  const parts = candidate?.content?.parts ?? [];
  const visible = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text!.trim())
    .filter(Boolean);
  if (visible.length) return visible.join('\n\n').trim();
  return parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text!.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

const MENTOR_LABEL: Record<MentorType, string> = {
  doctor: 'Doctor',
  nutritionist: 'Nutritionist',
  coach: 'Coach',
};

function geminiEndpoint(): string | null {
  if (!config.GEMINI_API_KEY) return null;
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;
}

async function geminiText(
  prompt: string,
  options: { temperature?: number; maxOutputTokens?: number; thinkingBudget?: number } = {},
): Promise<string> {
  const url = geminiEndpoint();
  if (!url) throw new Error('GEMINI_API_KEY not configured on server');

  const temperature = options.temperature ?? 0.3;
  const maxOutputTokens = options.maxOutputTokens ?? 2048;
  const thinkingBudget = options.thinkingBudget ?? 0;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: geminiGenerationConfig({ temperature, maxOutputTokens, thinkingBudget }),
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: GeminiPart[] };
      finishReason?: string;
    }>;
  };
  const candidate = json.candidates?.[0];
  const text = extractGeminiText(candidate);
  if (!text.trim()) throw new Error('Empty Gemini response');
  if (candidate?.finishReason === 'MAX_TOKENS') {
    return `${text.trim()}\n\n[Response truncated — ask a shorter follow-up or split your question.]`;
  }
  return text.trim();
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON in Gemini response');
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

export async function summariseRulesForClinic(rawText: string): Promise<ClinicUserRules> {
  const prompt = `You are a clinical nutritionist assistant. Extract dietary rules into JSON only.

Schema:
{"summary":"High cholesterol · IF 16:8","context":"Lower LDL","constraints":["avoid entrecôte","prefer salmon"]}

Rules:
- summary: max 5 words, · separator
- constraints: max 5 items, max 8 words each
- Copy explicit gram targets verbatim into constraints

User text:
"""
${rawText.replace(/"/g, "'")}
"""`;

  try {
    const raw = await geminiText(prompt, { temperature: 0, maxOutputTokens: 2048, thinkingBudget: 0 });
    const parsed = extractJsonObject(raw);
    return {
      rawText: rawText.trim(),
      summary: String(parsed.summary ?? rawText.trim().slice(0, 40)),
      constraints: Array.isArray(parsed.constraints)
        ? parsed.constraints.map((c) => String(c)).slice(0, 8)
        : [],
      aiContext: parsed.context ? String(parsed.context) : '',
      analyzedAt: new Date().toISOString(),
    };
  } catch {
    return {
      rawText: rawText.trim(),
      summary: rawText.trim().slice(0, 48),
      constraints: [],
      analyzedAt: new Date().toISOString(),
    };
  }
}

type SnapshotExport = {
  asyncStorage?: Record<string, string>;
  exportedAt?: string;
};

function decompressSnapshotPayload(buf: Buffer): string {
  // App uploads pako.deflate (zlib); clinic web uses pako.inflate. Try zlib first, then gzip.
  try {
    return inflateSync(buf).toString('utf8');
  } catch {
    return gunzipSync(buf).toString('utf8');
  }
}

export async function loadLatestSnapshotExport(patientId: string): Promise<SnapshotExport | null> {
  const { rows } = await query<{ payload_gzip: Buffer }>(
    `SELECT payload_gzip FROM sync_blobs WHERE patient_id = $1 ORDER BY version DESC LIMIT 1`,
    [patientId],
  );
  const row = rows[0];
  if (!row) return null;
  try {
    const json = decompressSnapshotPayload(row.payload_gzip);
    return JSON.parse(json) as SnapshotExport;
  } catch {
    return null;
  }
}

type LabReportRow = {
  collectedAt?: string;
  panels?: Array<{
    results?: Array<{ name?: string; value?: number | string; unit?: string }>;
  }>;
};

function formatLabReports(store: Record<string, string>): string | null {
  const reports: LabReportRow[] = [];
  for (const [key, raw] of Object.entries(store)) {
    if (!key.startsWith('lab_report_')) continue;
    try {
      reports.push(JSON.parse(raw) as LabReportRow);
    } catch { /* skip */ }
  }
  reports.sort((a, b) => (b.collectedAt ?? '').localeCompare(a.collectedAt ?? ''));
  if (!reports.length) return null;

  const blocks: string[] = [];
  for (const report of reports.slice(0, 10)) {
    const resultLines: string[] = [];
    for (const panel of report.panels ?? []) {
      for (const r of panel.results ?? []) {
        const name = r.name ?? '?';
        const value = r.value ?? '—';
        const unit = r.unit ? ` ${r.unit}` : '';
        resultLines.push(`${name}: ${value}${unit}`);
      }
    }
    if (resultLines.length) {
      blocks.push(`Draw ${report.collectedAt ?? 'unknown'}:\n  ${resultLines.slice(0, 40).join('\n  ')}`);
    }
  }
  return blocks.length ? blocks.join('\n\n') : null;
}

type FoodMealItem = {
  name?: string;
  name_local?: string;
  grams?: number;
  kcal?: number;
  protein_g?: number;
  carb_g?: number;
  fat_g?: number;
  fiber_g?: number;
};

type FoodMeal = {
  timestamp?: number;
  totalKcal?: number;
  totalProtein_g?: number;
  totalCarb_g?: number;
  totalFat_g?: number;
  totalFiber_g?: number;
  note?: string;
  items?: FoodMealItem[];
};

function formatFoodLogItemLine(item: FoodMealItem): string {
  const name = (item.name_local || item.name || 'item').trim();
  const grams = item.grams;
  const kcal = item.kcal;
  const hasGrams = grams != null && Number.isFinite(grams);
  const hasKcal = kcal != null && Number.isFinite(kcal);
  const hasMacros =
    item.protein_g != null ||
    item.carb_g != null ||
    item.fat_g != null ||
    item.fiber_g != null;
  if (hasGrams && hasKcal && hasMacros) {
    return `${name}: ${Math.round(grams)}g, ${Math.round(kcal)} kcal, P${Math.round(item.protein_g ?? 0)}g C${Math.round(item.carb_g ?? 0)}g F${Math.round(item.fat_g ?? 0)}g Fi${Math.round(item.fiber_g ?? 0)}g`;
  }
  if (hasGrams && hasKcal) {
    return `${name}: ${Math.round(grams)}g, ${Math.round(kcal)} kcal`;
  }
  if (hasGrams) return `${name}: ${Math.round(grams)}g`;
  return name;
}

function formatFoodLogMealLines(meal: FoodMeal, utcOffsetMinutes: number): string[] {
  const time = meal.timestamp
    ? formatHmFromMsWithOffset(meal.timestamp, utcOffsetMinutes)
    : '??:??';
  const lines: string[] = [`  · ${time}:`];
  const items = meal.items ?? [];
  if (items.length > 0) {
    for (const item of items) {
      lines.push(`      • ${formatFoodLogItemLine(item)}`);
    }
  } else {
    lines.push('      • (items not stored — totals only)');
  }
  lines.push(
    `    Total: ${Math.round(meal.totalKcal ?? 0)} kcal | P${Math.round(meal.totalProtein_g ?? 0)}g C${Math.round(meal.totalCarb_g ?? 0)}g F${Math.round(meal.totalFat_g ?? 0)}g Fi${Math.round(meal.totalFiber_g ?? 0)}g`,
  );
  if (meal.note?.trim()) lines.push(`    Note: ${meal.note.trim()}`);
  return lines;
}

function parseFoodLogsFromStore(store: Record<string, string>): Map<string, FoodMeal[]> {
  const byDay = new Map<string, FoodMeal[]>();
  for (const [key, raw] of Object.entries(store)) {
    const m = key.match(/^food_log_(\d{4}-\d{2}-\d{2})$/);
    if (!m) continue;
    try {
      const meals = JSON.parse(raw) as FoodMeal[];
      if (Array.isArray(meals)) byDay.set(m[1]!, meals);
    } catch {
      /* skip corrupt day */
    }
  }
  return byDay;
}

/** Patient device TZ — inferred from food_log day keys vs meal epoch ms (server runs UTC). */
function dayKeyFromMsWithOffset(ms: number, utcOffsetMinutes: number): string {
  const d = new Date(ms + utcOffsetMinutes * 60_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function dayKeyFromIsoWithOffset(iso: string, utcOffsetMinutes: number): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return dayKeyFromMsWithOffset(ms, utcOffsetMinutes);
}

function formatHmFromMsWithOffset(ms: number, utcOffsetMinutes: number): string {
  const d = new Date(ms + utcOffsetMinutes * 60_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function formatHmFromIsoWithOffset(iso: string, utcOffsetMinutes: number): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '??:??';
  return formatHmFromMsWithOffset(ms, utcOffsetMinutes);
}

function patientLocalHour(iso: string, utcOffsetMinutes: number): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 0;
  return new Date(ms + utcOffsetMinutes * 60_000).getUTCHours();
}

function formatUtcOffsetLabel(utcOffsetMinutes: number): string {
  if (utcOffsetMinutes === 0) return 'UTC';
  const sign = utcOffsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(utcOffsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, '0')}`;
}

function inferPatientUtcOffsetMinutes(store: Record<string, string>): number {
  let bestOffset = 0;
  let bestScore = -Infinity;
  for (let offsetMin = -720; offsetMin <= 840; offsetMin += 30) {
    let score = 0;
    for (const [key, raw] of Object.entries(store)) {
      const m = key.match(/^food_log_(\d{4}-\d{2}-\d{2})$/);
      if (!m) continue;
      const expectedDay = m[1]!;
      try {
        const meals = JSON.parse(raw) as FoodMeal[];
        if (!Array.isArray(meals)) continue;
        for (const meal of meals) {
          if (!meal.timestamp) continue;
          if (dayKeyFromMsWithOffset(meal.timestamp, offsetMin) === expectedDay) score += 2;
          else score -= 1;
        }
      } catch {
        /* skip corrupt day */
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestOffset = offsetMin;
    }
  }
  return bestOffset;
}

/** Multi-day food log for clinic mentor chat — matches Food log tab in portal. */
function formatFoodLogBlock(
  store: Record<string, string>,
  lookbackDays = 31,
  utcOffsetMinutes = 0,
): string | null {
  const byDay = parseFoodLogsFromStore(store);
  if (byDay.size === 0) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  const dayKeys = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  const tzLabel = formatUtcOffsetLabel(utcOffsetMinutes);
  const lines: string[] = [
    `Food log (by day, newest first — meal times patient local ${tzLabel}; use for questions about any listed date):`,
  ];

  for (const dk of dayKeys) {
    if (dk < cutoffKey) continue;
    const meals = [...(byDay.get(dk) ?? [])].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    if (!meals.length) continue;
    const kcal = meals.reduce((a, m) => a + (m.totalKcal ?? 0), 0);
    const p = meals.reduce((a, m) => a + (m.totalProtein_g ?? 0), 0);
    const c = meals.reduce((a, m) => a + (m.totalCarb_g ?? 0), 0);
    const f = meals.reduce((a, m) => a + (m.totalFat_g ?? 0), 0);
    lines.push(
      `${dk}: ${meals.length} meals, ${Math.round(kcal)} kcal, P${Math.round(p)} C${Math.round(c)} F${Math.round(f)} g`,
    );
    for (const meal of meals) {
      lines.push(...formatFoodLogMealLines(meal, utcOffsetMinutes));
    }
  }

  return lines.length > 1 ? lines.join('\n') : null;
}

type GlucosePoint = { timestamp: string; value: number };

function avgRounded(vals: number[]): number | null {
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function isDaytimeReading(iso: string, utcOffsetMinutes: number): boolean {
  const h = patientLocalHour(iso, utcOffsetMinutes);
  return h >= 7 && h < 23;
}

function glucoseOnDay(glucose: GlucosePoint[], dayKey: string, utcOffsetMinutes: number): GlucosePoint[] {
  return glucose.filter(
    (p) => dayKeyFromIsoWithOffset(p.timestamp, utcOffsetMinutes) === dayKey && p.value > 0,
  );
}

function formatDayGlucoseSeries(
  glucose: GlucosePoint[],
  dayKey: string,
  utcOffsetMinutes: number,
): string | null {
  const dayPts = glucoseOnDay(glucose, dayKey, utcOffsetMinutes).sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  if (!dayPts.length) return null;
  const readings = dayPts.map(
    (p) => `${formatHmFromIsoWithOffset(p.timestamp, utcOffsetMinutes)}=${Math.round(p.value)}`,
  );
  const last = dayPts[dayPts.length - 1]!;
  return `  CGM readings (${dayPts.length} samples, HH:MM=mg/dL patient local — match Food log meal times): ${readings.join(', ')} | latest ${Math.round(last.value)} mg/dL at ${formatHmFromIsoWithOffset(last.timestamp, utcOffsetMinutes)}`;
}

/** Multi-day CGM for clinic mentor chat — matches dashboard chart data in portal. */
function formatCgmBlock(
  store: Record<string, string>,
  lookbackDays = 31,
  fullSeriesDays = 7,
  utcOffsetMinutes = 0,
): string | null {
  const cgmRaw = store['healthings:lastMetrics'];
  if (!cgmRaw) return null;
  let glucose: GlucosePoint[] = [];
  try {
    const cgm = JSON.parse(cgmRaw) as { glucose?: GlucosePoint[] };
    glucose = (cgm.glucose ?? []).filter((p) => p.value > 0 && Date.parse(p.timestamp));
  } catch {
    return null;
  }
  if (!glucose.length) return null;

  glucose.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const cutoffMs = Date.now() - lookbackDays * 86_400_000;
  const cutoffKey = dayKeyFromMsWithOffset(cutoffMs, utcOffsetMinutes);

  const byDay = new Map<string, GlucosePoint[]>();
  for (const p of glucose) {
    const dk = dayKeyFromIsoWithOffset(p.timestamp, utcOffsetMinutes);
    if (!dk || dk < cutoffKey) continue;
    const list = byDay.get(dk) ?? [];
    list.push(p);
    byDay.set(dk, list);
  }
  if (byDay.size === 0) return null;

  const dayKeys = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  const fullSeriesCutoffMs = Date.now() - fullSeriesDays * 86_400_000;
  const fullSeriesCutoffKey = dayKeyFromMsWithOffset(fullSeriesCutoffMs, utcOffsetMinutes);
  const tzLabel = formatUtcOffsetLabel(utcOffsetMinutes);

  const lines: string[] = [
    `CGM glucose (by day, newest first — times patient local ${tzLabel}; correlate spikes with Food log meal times):`,
    `Total: ${glucose.length} samples in snapshot | ${byDay.size} days with readings in last ${lookbackDays} days`,
  ];

  const dayNightLines: string[] = [];
  for (const dk of dayKeys) {
    const dayPts = byDay.get(dk) ?? [];
    const dayVals = dayPts.filter((p) => isDaytimeReading(p.timestamp, utcOffsetMinutes)).map((p) => p.value);
    const nightVals = dayPts.filter((p) => !isDaytimeReading(p.timestamp, utcOffsetMinutes)).map((p) => p.value);
    const dayAvg = avgRounded(dayVals);
    const nightAvg = avgRounded(nightVals);
    if (dayAvg == null && nightAvg == null) continue;
    dayNightLines.push(
      `  ${dk}: day avg ${dayAvg ?? '—'} mg/dL (${dayVals.length} samples, 07:00–23:00) | night avg ${nightAvg ?? '—'} mg/dL (${nightVals.length} samples)`,
    );
  }
  if (dayNightLines.length) {
    lines.push('CGM DAY vs NIGHT (local time):', ...dayNightLines);
  }

  for (const dk of dayKeys) {
    const dayPts = byDay.get(dk) ?? [];
    const vals = dayPts.map((p) => p.value);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pctAbove140 = Math.round((vals.filter((v) => v > 140).length / vals.length) * 100);
    lines.push(`${dk}: avg ${avg} | min ${min} | max ${max} mg/dL | ${pctAbove140}% readings >140 | ${vals.length} samples`);
    if (dk >= fullSeriesCutoffKey) {
      const series = formatDayGlucoseSeries(glucose, dk, utcOffsetMinutes);
      if (series) lines.push(series);
    }
  }

  return lines.length > 1 ? lines.join('\n') : null;
}

type WorkoutSession = {
  category?: number;
  activityLabel?: string;
  startMs: number;
  endMs: number;
  kcal: number;
};

type HeartRatePoint = {
  timestamp: string;
  value: number;
};

type WithingsSnapshot = {
  bodyScan?: {
    weightKg?: number;
    fatMassKg?: number;
    muscleMassKg?: number;
    bmrKcalDay?: number;
  };
  bodyTrendDays?: Array<{
    dayKey: string;
    activityKcalDay?: number | null;
    bmrKcalDay?: number | null;
  }>;
  heartRate?: HeartRatePoint[];
  workouts?: WorkoutSession[];
};

function parseWithingsStore(store: Record<string, string>): WithingsSnapshot | null {
  const raw = store['healthings:metricsStore'] ?? store['healthings:withingsStore'];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WithingsSnapshot;
  } catch {
    return null;
  }
}

function hrDuringWorkout(hrPoints: HeartRatePoint[], startMs: number, endMs: number): string | null {
  const during = hrPoints.filter((p) => {
    const t = Date.parse(p.timestamp);
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
  if (!during.length) return null;
  const vals = during.map((p) => p.value).filter((v) => v > 0);
  if (!vals.length) return null;
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  const max = Math.max(...vals);
  return `HR avg ${avg} max ${max} bpm (${vals.length} readings)`;
}

function formatWorkoutLine(
  workout: WorkoutSession,
  utcOffsetMinutes: number,
  hrPoints: HeartRatePoint[],
): string {
  const start = formatHmFromMsWithOffset(workout.startMs, utcOffsetMinutes);
  const end = formatHmFromMsWithOffset(workout.endMs, utcOffsetMinutes);
  const durMin = Math.max(1, Math.round((workout.endMs - workout.startMs) / 60_000));
  const label = workout.activityLabel?.trim() || `Activity ${workout.category ?? '?'}`;
  const kcal = Math.round(workout.kcal ?? 0);
  const hr = hrDuringWorkout(hrPoints, workout.startMs, workout.endMs);
  return hr
    ? `${label} ${start}–${end} (${durMin} min, ${kcal} kcal active) | ${hr}`
    : `${label} ${start}–${end} (${durMin} min, ${kcal} kcal active)`;
}

/** Withings workout sessions + daily active calories for clinic mentor chat. */
function formatWorkoutsBlock(
  store: Record<string, string>,
  lookbackDays = 31,
  utcOffsetMinutes = 0,
): string | null {
  const withings = parseWithingsStore(store);
  if (!withings) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  const hrPoints = (withings.heartRate ?? []).filter((p) => p.value > 0 && Date.parse(p.timestamp));
  const workouts = (withings.workouts ?? []).filter(
    (w) => Number.isFinite(w.startMs) && Number.isFinite(w.endMs) && w.endMs > w.startMs,
  );

  const workoutsByDay = new Map<string, WorkoutSession[]>();
  for (const w of workouts) {
    const dk = dayKeyFromMsWithOffset(w.startMs, utcOffsetMinutes);
    if (dk < cutoffKey) continue;
    const list = workoutsByDay.get(dk) ?? [];
    list.push(w);
    workoutsByDay.set(dk, list);
  }
  for (const list of workoutsByDay.values()) {
    list.sort((a, b) => a.startMs - b.startMs);
  }

  const activityByDay = new Map<string, number>();
  for (const d of withings.bodyTrendDays ?? []) {
    if (!d.dayKey || d.dayKey < cutoffKey) continue;
    if (d.activityKcalDay != null && Number.isFinite(d.activityKcalDay) && d.activityKcalDay > 0) {
      activityByDay.set(d.dayKey, Math.round(d.activityKcalDay));
    }
  }

  const dayKeys = [...new Set([...workoutsByDay.keys(), ...activityByDay.keys()])].sort((a, b) =>
    b.localeCompare(a),
  );
  if (!dayKeys.length) return null;

  const tzLabel = formatUtcOffsetLabel(utcOffsetMinutes);
  const lines: string[] = [
    `Workouts & activity (by day, newest first — times patient local ${tzLabel}; correlate with Food log meals and CGM):`,
    `Total: ${workouts.length} timed session(s) in snapshot | ${dayKeys.length} day(s) with activity data`,
  ];

  for (const dk of dayKeys) {
    const dayWorkouts = workoutsByDay.get(dk) ?? [];
    const dailyActive = activityByDay.get(dk);
    if (dayWorkouts.length > 0) {
      lines.push(`${dk}: ${dayWorkouts.length} session(s)${dailyActive ? `, ${dailyActive} kcal daily active total` : ''}`);
      for (const w of dayWorkouts) {
        lines.push(`  · ${formatWorkoutLine(w, utcOffsetMinutes, hrPoints)}`);
      }
    } else if (dailyActive) {
      lines.push(`${dk}: ${dailyActive} kcal active (daily total — no timed workout sessions in snapshot)`);
    }
  }

  return lines.length > 1 ? lines.join('\n') : null;
}

function buildPatientContextBlock(exportData: SnapshotExport | null): string {
  if (!exportData?.asyncStorage) return 'No patient snapshot uploaded yet.';

  const store = exportData.asyncStorage;
  const lines: string[] = [];
  const utcOffsetMinutes = inferPatientUtcOffsetMinutes(store);

  const labsBlock = formatLabReports(store);
  if (labsBlock) lines.push(`Lab reports (newest first):\n${labsBlock}`);

  const withings = parseWithingsStore(store);
  if (withings?.bodyScan) {
    const b = withings.bodyScan;
    lines.push(
      `Body: weight ${b.weightKg ?? '—'} kg, fat ${b.fatMassKg ?? '—'} kg, muscle ${b.muscleMassKg ?? '—'} kg, BMR ${b.bmrKcalDay ?? '—'} kcal`,
    );
  }

  const cgmBlock = formatCgmBlock(store, 31, 7, utcOffsetMinutes);
  if (cgmBlock) lines.push(cgmBlock);

  const foodBlock = formatFoodLogBlock(store, 31, utcOffsetMinutes);
  if (foodBlock) lines.push(foodBlock);

  const workoutsBlock = formatWorkoutsBlock(store, 31, utcOffsetMinutes);
  if (workoutsBlock) lines.push(workoutsBlock);

  const rulesRaw = store.user_rules;
  if (rulesRaw) {
    try {
      const rules = JSON.parse(rulesRaw) as { summary?: string; rawText?: string };
      lines.push(`Patient rules: ${rules.summary ?? rules.rawText?.slice(0, 80) ?? '—'}`);
    } catch { /* */ }
  }

  const macroRaw = store.daily_macro_target;
  if (macroRaw) {
    try {
      const m = JSON.parse(macroRaw) as { kcal?: number; protein_g?: number; carb_g?: number; fat_g?: number };
      lines.push(`Macro targets: ${m.kcal ?? '—'} kcal, P${m.protein_g ?? '—'} C${m.carb_g ?? '—'} F${m.fat_g ?? '—'} g`);
    } catch { /* */ }
  }

  if (exportData.exportedAt) {
    lines.push(`Snapshot exported: ${exportData.exportedAt}`);
  }

  return lines.length ? lines.join('\n') : 'Snapshot present but sparse.';
}

export async function mentorChatReply(
  mentorType: MentorType,
  message: string,
  history: ClinicChatMessage[],
  patientId: string,
  clinicRules: ClinicUserRules | null,
): Promise<string> {
  const snapshot = await loadLatestSnapshotExport(patientId);
  const dataBlock = buildPatientContextBlock(snapshot);

  let snapRules: ClinicUserRules | null = null;
  const rulesRaw = snapshot?.asyncStorage?.user_rules;
  if (rulesRaw) {
    try {
      const parsed = JSON.parse(rulesRaw) as ClinicUserRules;
      if (parsed?.rawText?.trim()) snapRules = parsed;
    } catch { /* */ }
  }

  const snapAt = snapRules?.analyzedAt ? Date.parse(snapRules.analyzedAt) : 0;
  const clinicAt = clinicRules?.analyzedAt ? Date.parse(clinicRules.analyzedAt) : 0;
  const liveRules =
    snapRules && Number.isFinite(snapAt) && (!clinicRules || snapAt > (Number.isFinite(clinicAt) ? clinicAt : 0))
      ? snapRules
      : clinicRules ?? snapRules;

  const rulesBlock = liveRules
    ? `${clinicRules && liveRules === clinicRules ? 'CLINIC-UPDATED RULES (authoritative)' : 'PATIENT RULES (from phone / snapshot)'}:\n${liveRules.rawText}\n${(liveRules.constraints ?? []).map((c) => `- ${c}`).join('\n')}`
    : '';

  const historyText = history
    .slice(-12)
    .map((m) => `${m.role === 'user' ? 'Clinic staff' : MENTOR_LABEL[mentorType]}: ${m.text}`)
    .join('\n');

  const prompt = `You are the ${MENTOR_LABEL[mentorType]} AI mentor in a clinical nutrition app.
The clinic staff is chatting on behalf of reviewing this patient's data. Answer in clear, practical prose.
Use the patient data below. Do not invent labs or meals not listed.
When CGM glucose lists a date with avg/min/max or HH:MM readings, that date HAS glucose data — cite it and correlate with Food log meals. Never say glucose/CGM is missing for a date that appears in the CGM block.
When Workouts & activity lists timed sessions for a date/time, that exercise IS logged — cite start/end, duration, and kcal. Correlate walks/workouts with CGM trends after meals. Never say exercise is missing for a date that appears in the Workouts block.

PATIENT DATA:
${dataBlock}

${rulesBlock}

RECENT CHAT:
${historyText || '(none)'}

Clinic staff message:
${message}

Reply as the ${MENTOR_LABEL[mentorType]} mentor (plain text, no JSON).`;

  try {
    return await geminiText(prompt, {
      temperature: 0.4,
      maxOutputTokens: 8192,
      thinkingBudget: 4096,
    });
  } catch (e) {
    return e instanceof Error ? e.message : 'AI chat unavailable';
  }
}
