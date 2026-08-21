import { gunzipSync, inflateSync } from 'node:zlib';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import type { ClinicChatMessage, ClinicUserRules } from './clinicOverlay.js';
import { markerShortLabelMap } from './treatmentMarkers.js';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 60_000;

/**
 * Packing splits clinic vs patient web chat (be-39).
 * Clinic must not hide meal items — default 365d itemized food (clinic snapshot window).
 * Patient /account/ keeps be-36 COGS defaults; optional widen on “30 days” / “חודש”.
 */
const PATIENT_FOOD_LOOKBACK_DAYS = 31;
const PATIENT_FOOD_DETAIL_DAYS = 7;
const PATIENT_CGM_LOOKBACK_DAYS = 14;
const PATIENT_CGM_FULL_SERIES_DAYS = 2;
const PATIENT_WORKOUT_LOOKBACK_DAYS = 14;
const PATIENT_LAB_REPORT_LIMIT = 3;

const CLINIC_FOOD_LOOKBACK_DAYS = 365;
const CLINIC_FOOD_DETAIL_DAYS = 365;
const CLINIC_CGM_LOOKBACK_DAYS = 365;
const CLINIC_CGM_FULL_SERIES_DAYS = 14;
const CLINIC_WORKOUT_LOOKBACK_DAYS = 365;
const CLINIC_LAB_REPORT_LIMIT = 10;

const CHAT_CGM_SERIES_STEP_MIN = 15;
const CHAT_THINKING_BUDGET = 1024;

/** Defaults used by format* helpers when packing omitted. */
const CHAT_FOOD_LOOKBACK_DAYS = CLINIC_FOOD_LOOKBACK_DAYS;
const CHAT_FOOD_DETAIL_DAYS = CLINIC_FOOD_DETAIL_DAYS;
const CHAT_CGM_LOOKBACK_DAYS = CLINIC_CGM_LOOKBACK_DAYS;
const CHAT_CGM_FULL_SERIES_DAYS = CLINIC_CGM_FULL_SERIES_DAYS;
const CHAT_WORKOUT_LOOKBACK_DAYS = CLINIC_WORKOUT_LOOKBACK_DAYS;
const CHAT_LAB_REPORT_LIMIT = CLINIC_LAB_REPORT_LIMIT;

type ChatPacking = {
  foodLookbackDays: number;
  foodDetailDays: number;
  cgmLookbackDays: number;
  cgmFullSeriesDays: number;
  workoutLookbackDays: number;
  labReportLimit: number;
};

/** Clinic portal mentor chat — full clinical window; never totals-only within lookback. */
const CLINIC_CHAT_PACKING: ChatPacking = {
  foodLookbackDays: CLINIC_FOOD_LOOKBACK_DAYS,
  foodDetailDays: CLINIC_FOOD_DETAIL_DAYS,
  cgmLookbackDays: CLINIC_CGM_LOOKBACK_DAYS,
  cgmFullSeriesDays: CLINIC_CGM_FULL_SERIES_DAYS,
  workoutLookbackDays: CLINIC_WORKOUT_LOOKBACK_DAYS,
  labReportLimit: CLINIC_LAB_REPORT_LIMIT,
};

/** Patient /account/ self-chat (be-36 COGS). */
const PATIENT_CHAT_PACKING: ChatPacking = {
  foodLookbackDays: PATIENT_FOOD_LOOKBACK_DAYS,
  foodDetailDays: PATIENT_FOOD_DETAIL_DAYS,
  cgmLookbackDays: PATIENT_CGM_LOOKBACK_DAYS,
  cgmFullSeriesDays: PATIENT_CGM_FULL_SERIES_DAYS,
  workoutLookbackDays: PATIENT_WORKOUT_LOOKBACK_DAYS,
  labReportLimit: PATIENT_LAB_REPORT_LIMIT,
};

/** Patient widen when they explicitly ask for a wide window. */
const PATIENT_WIDE_CHAT_PACKING: ChatPacking = {
  foodLookbackDays: 31,
  foodDetailDays: 31,
  cgmLookbackDays: 31,
  cgmFullSeriesDays: 7,
  workoutLookbackDays: 31,
  labReportLimit: 10,
};

/** @deprecated alias — prefer CLINIC_CHAT_PACKING / PATIENT_CHAT_PACKING */
const DEFAULT_CHAT_PACKING = CLINIC_CHAT_PACKING;

/**
 * Intent routing only — not clinical rule parsing (ai-judgment-not-regex).
 * Matches “last 30 days”, “past month”, Hebrew “חודש”, etc. Patient web only.
 */
function wantsWideChatContext(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return (
    /\b(30|31)\s*-?\s*days?\b/.test(m) ||
    /\blast\s+(month|30|31)\b/.test(m) ||
    /\bpast\s+(month|30|31)\b/.test(m) ||
    /\bfull\s+(history|month|log|cgm|food)\b/.test(m) ||
    /\b(último|ultimo)\s+mes\b/.test(m) ||
    /\b(mois|Monat|mese|mês|mes)\s+(dernier|letzten|scorso|passado|pasado)\b/.test(m) ||
    /חודש/.test(message) ||
    /الشهر/.test(message) ||
    /месяц/.test(message)
  );
}

function packingForPatientMessage(message: string): ChatPacking {
  return wantsWideChatContext(message) ? PATIENT_WIDE_CHAT_PACKING : PATIENT_CHAT_PACKING;
}

function dayKeyDaysAgo(days: number, utcOffsetMinutes = 0): string {
  return dayKeyFromMsWithOffset(Date.now() - days * 86_400_000, utcOffsetMinutes);
}

export type MentorType = 'doctor' | 'nutritionist' | 'coach';

type GeminiPart = { text?: string; thought?: boolean };

/** Real Google token usage from usageMetadata — analytics only, not wallet math. */
export type GeminiUsage = {
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  model: string;
};

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

/** Same 10 codes as app SUPPORTED_LANGUAGES / clinic-i18n CLINIC_LOCALES. */
export const CLINIC_CHAT_LOCALES = [
  'en',
  'he',
  'es',
  'fr',
  'de',
  'ar',
  'ru',
  'pt',
  'it',
  'tr',
] as const;
export type ClinicChatLocale = (typeof CLINIC_CHAT_LOCALES)[number];

const CLINIC_LOCALE_NAME: Record<ClinicChatLocale, string> = {
  en: 'English',
  he: 'Hebrew',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ar: 'Arabic',
  ru: 'Russian',
  pt: 'Portuguese',
  it: 'Italian',
  tr: 'Turkish',
};

export function normalizeClinicChatLocale(raw: string | undefined | null): ClinicChatLocale {
  const code = String(raw || 'en').trim().toLowerCase().slice(0, 8);
  return (CLINIC_CHAT_LOCALES as readonly string[]).includes(code)
    ? (code as ClinicChatLocale)
    : 'en';
}

function geminiEndpoint(): string | null {
  if (!config.GEMINI_API_KEY) return null;
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;
}

async function geminiTextWithUsage(
  prompt: string,
  options: { temperature?: number; maxOutputTokens?: number; thinkingBudget?: number } = {},
): Promise<{ text: string; usage: GeminiUsage | null }> {
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
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const um = json.usageMetadata;
  const usage: GeminiUsage | null = um
    ? {
        promptTokens: um.promptTokenCount ?? 0,
        candidatesTokens: um.candidatesTokenCount ?? 0,
        thoughtsTokens: um.thoughtsTokenCount ?? 0,
        totalTokens: um.totalTokenCount ?? 0,
        model: GEMINI_MODEL,
      }
    : null;
  const candidate = json.candidates?.[0];
  const text = extractGeminiText(candidate);
  if (!text.trim()) throw new Error('Empty Gemini response');
  if (candidate?.finishReason === 'MAX_TOKENS') {
    return {
      text: `${text.trim()}\n\n[Response truncated — ask a shorter follow-up or split your question.]`,
      usage,
    };
  }
  return { text: text.trim(), usage };
}

async function geminiText(
  prompt: string,
  options: { temperature?: number; maxOutputTokens?: number; thinkingBudget?: number } = {},
): Promise<string> {
  const { text } = await geminiTextWithUsage(prompt, options);
  return text;
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

export type MacroProposeMarkerDraft = {
  marker: string;
  direction: 'cap' | 'floor';
  dailyTarget: number;
  percentOfEnergy?: number;
  ofEnergy?: 'kcal_eaten';
  note?: string;
};

export type MacroProposeResult = {
  bounds: unknown[];
  markers: MacroProposeMarkerDraft[];
  reasoning: string;
  impliedNotes: string[];
  needsClinician: Array<{ axis: string; question: string }>;
};

/**
 * be-45 — Propose clinic macro bounds (+ optional markers) from rules text.
 * Judgment only; does not write. Caller validates and saves.
 */
export async function proposeClinicMacroOrder(input: {
  rulesRawText: string;
  markersSummary?: string;
}): Promise<MacroProposeResult> {
  const rules = String(input.rulesRawText || '').trim();
  if (!rules) {
    return {
      bounds: [],
      markers: [],
      reasoning: 'Rules text is empty.',
      impliedNotes: [],
      needsClinician: [],
    };
  }

  const prompt = `You are a licensed clinical nutritionist writing a SHORT diet ORDER for one patient.
You are NOT filling a complete P/C/F/kcal plate unless the rules clearly require it.

Return JSON only (no markdown):

{
  "bounds": [
    { "axis": "protein_g", "direction": "floor", "value": 90, "strength": "hard", "kind": "constant" },
    { "axis": "protein_g", "direction": "ceiling", "value": 113, "strength": "hard", "kind": "constant" }
  ],
  "markers": [
    { "marker": "SAT_FAT_G", "direction": "cap", "dailyTarget": 19, "percentOfEnergy": 10, "ofEnergy": "kcal_eaten" }
  ],
  "reasoning": "short clinical English",
  "impliedNotes": [],
  "needsClinician": [{ "axis": "kcal", "question": "…" }]
}

AXES: kcal | protein_g | carb_g | fat_g | fiber_g | net_carb_g
DIRECTION: floor | ceiling
STRENGTH: hard | flex
KIND: constant | percent (percent needs of: kcal_order and resolvedValue in grams)

RULES
- Cover every Food Log axis in bounds: kcal | protein_g | carb_g | fat_g | fiber_g | net_carb_g.
- HARD / floor / ceiling / range only when the rules clearly give a number. FLEX = unlocked axis with NO value field and NO invented grams — example: { "axis": "fat_g", "direction": "ceiling", "kind": "constant", "strength": "flex" }.
- Never invent a number just to fill FLEX. Prefer FLEX-with-no-value over guessing.
- Kind is not HARD/FLEX. Prefer percent on carb_g when rules say share of daily calories; resolve against kcal_order; always fill resolvedValue.
- ENERGY / kcal: when the rules give ONE clear daily energy number (e.g. "קלוריות: 1,690 קק״ל", "1690 kcal", "energy 2000"), ALWAYS emit a HARD kcal ceiling with that value (strip thousands separators). Do NOT leave kcal only in needsClinician when that number is present. Use needsClinician for kcal ONLY when energy is a range with no chosen target, or truly absent.
- TRAINING: one kcal ceiling with activityAddBack { thresholdKcal, capValue } when rules give a higher training allowance. Omit activityAddBack if threshold is unknown — put a needsClinician question instead. Never set followsActivity.
- Markers (SAT_FAT_G, SOLUBLE_FIBER_G, IODINE_MCG, SELENIUM_MCG, …) go in markers[], never in bounds. Prefer percentOfEnergy for sat fat when rules say % of energy. Return markers: [] when rules name none.
- When rules say saturated fat as a share of daily energy (e.g. "פחות מ-7% מסך האנרגיה", "<10% of energy"), ALWAYS return SAT_FAT_G with percentOfEnergy + ofEnergy "kcal_eaten" and a dailyTarget grams fallback at the kcal order (kcal×pct/100/9). Do not leave sat fat as a constant-only grams cap when the rules are clearly %.
- Soluble fiber / iodine / selenium: constant grams or mcg floors/caps as stated. Upsert only what rules name; never delete other markers.
- When a HARD number is missing but required (e.g. % carb with no kcal), omit that HARD bound and add needsClinician — still include the axis as FLEX with no value if you are not locking it.
- Do not parse with regex — read as a clinician.

CLINIC RULES:
"""
${rules.replace(/"/g, "'").slice(0, 12000)}
"""

EXISTING TREATMENT MARKERS (context only — do not wipe; only propose markers the rules clearly set):
${input.markersSummary || '(none)'}
`;

  const raw = await geminiText(prompt, { temperature: 0.2, maxOutputTokens: 4096, thinkingBudget: 0 });
  const parsed = extractJsonObject(raw);
  const bounds = Array.isArray(parsed.bounds) ? parsed.bounds : [];
  const markersRaw = Array.isArray(parsed.markers) ? parsed.markers : [];
  const markers: MacroProposeMarkerDraft[] = [];
  for (const m of markersRaw) {
    if (!m || typeof m !== 'object') continue;
    const row = m as Record<string, unknown>;
    const marker = String(row.marker || '').trim().toUpperCase();
    const direction = row.direction === 'floor' ? 'floor' : row.direction === 'cap' ? 'cap' : null;
    const dailyTarget = Number(row.dailyTarget);
    if (!marker || !direction || !Number.isFinite(dailyTarget) || dailyTarget <= 0) continue;
    const draft: MacroProposeMarkerDraft = { marker, direction, dailyTarget };
    const pct = Number(row.percentOfEnergy);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) {
      draft.percentOfEnergy = pct;
      draft.ofEnergy = 'kcal_eaten';
    }
    if (typeof row.note === 'string' && row.note.trim()) draft.note = row.note.trim().slice(0, 500);
    markers.push(draft);
  }
  const needsClinician = Array.isArray(parsed.needsClinician)
    ? parsed.needsClinician
        .map((n) => {
          if (!n || typeof n !== 'object') return null;
          const row = n as Record<string, unknown>;
          const axis = String(row.axis || '').trim();
          const question = String(row.question || '').trim();
          if (!axis || !question) return null;
          return { axis, question };
        })
        .filter((n): n is { axis: string; question: string } => !!n)
    : [];
  const impliedNotes = Array.isArray(parsed.impliedNotes)
    ? parsed.impliedNotes.map((x) => String(x)).filter(Boolean)
    : [];
  return {
    bounds,
    markers,
    reasoning: String(parsed.reasoning || '').slice(0, 4000),
    impliedNotes,
    needsClinician,
  };
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

function formatLabReports(store: Record<string, string>, limit = CHAT_LAB_REPORT_LIMIT): string | null {
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
  for (const report of reports.slice(0, Math.max(1, limit))) {
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

type MarkerAmounts = Record<string, number>;

type FoodMealItem = {
  name?: string;
  name_local?: string;
  grams?: number;
  kcal?: number;
  protein_g?: number;
  carb_g?: number;
  fat_g?: number;
  fiber_g?: number;
  /** Treatment markers on the item — e.g. SAT_FAT_G (prompt110 / be-41). */
  markers?: MarkerAmounts;
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
  /** Meal-level marker totals (preferred when present). */
  markers?: MarkerAmounts;
};

/** Short labels for clinic mentor food lines (always-English glossary). */
const MARKER_SHORT_FALLBACK: Record<string, string> = {
  SAT_FAT_G: 'SatF',
  CHOLESTEROL_MG: 'Chol',
  SOLUBLE_FIBER_G: 'SolFi',
  OMEGA3_G: 'n3',
  ADDED_SUGAR_G: 'AddSug',
  SODIUM_MG: 'Na',
  POTASSIUM_MG: 'K',
  PHOSPHORUS_MG: 'P',
  IODINE_MCG: 'Iod',
};

let MARKER_SHORT: Record<string, string> = { ...MARKER_SHORT_FALLBACK };

async function refreshMarkerShorts(): Promise<void> {
  try {
    const extra = await markerShortLabelMap();
    MARKER_SHORT = { ...MARKER_SHORT_FALLBACK, ...extra };
  } catch {
    MARKER_SHORT = { ...MARKER_SHORT_FALLBACK };
  }
}

function formatMarkerBits(markers: MarkerAmounts | null | undefined): string {
  if (!markers) return '';
  const bits: string[] = [];
  for (const [rawKey, v] of Object.entries(markers)) {
    if (v == null || !Number.isFinite(v)) continue;
    const k = rawKey.toUpperCase();
    const label = MARKER_SHORT[k] ?? k;
    const rounded = Math.round(v * 10) / 10;
    bits.push(`${label}${rounded}`);
  }
  return bits.length ? bits.join(' ') : '';
}

function sumMarkerMaps(parts: MarkerAmounts[]): MarkerAmounts {
  const out: MarkerAmounts = {};
  for (const part of parts) {
    for (const [rawKey, v] of Object.entries(part)) {
      if (v == null || !Number.isFinite(v)) continue;
      const k = rawKey.toUpperCase();
      out[k] = Math.round(((out[k] ?? 0) + v) * 10) / 10;
    }
  }
  return out;
}

/** Same resolution as the phone Food Log day meter: items first, else meal.markers. */
function resolveMealMarkers(meal: FoodMeal): MarkerAmounts {
  const fromItems = sumMarkerMaps((meal.items ?? []).map((it) => it.markers ?? {}));
  if (Object.keys(fromItems).length > 0) return fromItems;
  if (meal.markers && Object.keys(meal.markers).length > 0) return meal.markers;
  return {};
}

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
  const markBits = formatMarkerBits(item.markers);
  let base: string;
  if (hasGrams && hasKcal && hasMacros) {
    base = `${name}: ${Math.round(grams)}g, ${Math.round(kcal)} kcal, P${Math.round(item.protein_g ?? 0)}g C${Math.round(item.carb_g ?? 0)}g F${Math.round(item.fat_g ?? 0)}g Fi${Math.round(item.fiber_g ?? 0)}g`;
  } else if (hasGrams && hasKcal) {
    base = `${name}: ${Math.round(grams)}g, ${Math.round(kcal)} kcal`;
  } else if (hasGrams) {
    base = `${name}: ${Math.round(grams)}g`;
  } else {
    base = name;
  }
  return markBits ? `${base} | ${markBits}` : base;
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
  const mealMarks = resolveMealMarkers(meal);
  const markBits = formatMarkerBits(mealMarks);
  lines.push(
    `    Total: ${Math.round(meal.totalKcal ?? 0)} kcal | P${Math.round(meal.totalProtein_g ?? 0)}g C${Math.round(meal.totalCarb_g ?? 0)}g F${Math.round(meal.totalFat_g ?? 0)}g Fi${Math.round(meal.totalFiber_g ?? 0)}g` +
      (markBits ? ` | ${markBits}` : ''),
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

/** Current UTC offset for Asia/Jerusalem (minutes east of UTC), e.g. +180 in summer. */
function asiaJerusalemUtcOffsetMinutes(atMs = Date.now()): number {
  const name =
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jerusalem',
      timeZoneName: 'longOffset',
    })
      .formatToParts(new Date(atMs))
      .find((p) => p.type === 'timeZoneName')?.value ?? '';
  const m = name.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) return 180;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
}

/**
 * Infer patient UTC offset from food_log day keys vs meal epoch ms.
 *
 * Day-key match alone ties across many offsets (meals mid-day stay on the same
 * calendar date for ±several hours). Without a tie-break we kept the *first*
 * max score while scanning −720…+840 — i.e. the most negative matching offset.
 * That turned Israel 20:38 into clinic-chat "14:14" (Stav 2026-08-16) and made
 * the mentor deny a meal that was clearly on the Food log tab (browser TZ).
 *
 * Tie-break order among best day-key scores:
 * 1. Asia/Jerusalem if it matches (clinic is IL-first)
 * 2. Most meals in waking hours 06:00–22:59
 * 3. Smallest |offset|
 */
function inferPatientUtcOffsetMinutes(store: Record<string, string>): number {
  type Candidate = { offsetMin: number; dayScore: number; wakeScore: number };
  const candidates: Candidate[] = [];

  for (let offsetMin = -720; offsetMin <= 840; offsetMin += 30) {
    let dayScore = 0;
    let wakeScore = 0;
    for (const [key, raw] of Object.entries(store)) {
      const m = key.match(/^food_log_(\d{4}-\d{2}-\d{2})$/);
      if (!m) continue;
      const expectedDay = m[1]!;
      try {
        const meals = JSON.parse(raw) as FoodMeal[];
        if (!Array.isArray(meals)) continue;
        for (const meal of meals) {
          if (!meal.timestamp) continue;
          if (dayKeyFromMsWithOffset(meal.timestamp, offsetMin) === expectedDay) {
            dayScore += 2;
            const hour = new Date(meal.timestamp + offsetMin * 60_000).getUTCHours();
            if (hour >= 6 && hour <= 22) wakeScore += 1;
          } else {
            dayScore -= 1;
          }
        }
      } catch {
        /* skip corrupt day */
      }
    }
    candidates.push({ offsetMin, dayScore, wakeScore });
  }

  if (!candidates.length) return asiaJerusalemUtcOffsetMinutes();

  const maxDay = Math.max(...candidates.map((c) => c.dayScore));
  const top = candidates.filter((c) => c.dayScore === maxDay);
  const jerusalem = asiaJerusalemUtcOffsetMinutes();
  if (top.some((c) => c.offsetMin === jerusalem)) return jerusalem;

  top.sort(
    (a, b) =>
      b.wakeScore - a.wakeScore || Math.abs(a.offsetMin) - Math.abs(b.offsetMin),
  );
  return top[0]!.offsetMin;
}

/** Multi-day food log for clinic mentor chat — matches Food log tab in portal. */
function formatFoodLogBlock(
  store: Record<string, string>,
  lookbackDays = CHAT_FOOD_LOOKBACK_DAYS,
  utcOffsetMinutes = 0,
  detailDays = CHAT_FOOD_DETAIL_DAYS,
): string | null {
  const byDay = parseFoodLogsFromStore(store);
  if (byDay.size === 0) return null;

  const cutoffKey = dayKeyDaysAgo(lookbackDays, utcOffsetMinutes);
  const detailCutoffKey = dayKeyDaysAgo(Math.min(detailDays, lookbackDays), utcOffsetMinutes);

  const dayKeys = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  const tzLabel = formatUtcOffsetLabel(utcOffsetMinutes);
  const lines: string[] = [
    detailDays >= lookbackDays
      ? `Food log (by day, newest first — meal times patient local ${tzLabel}; full item detail through ${lookbackDays}d; clinic treatment-marker amounts when logged = USER DATA day totals, not estimates):`
      : `Food log (by day, newest first — meal times patient local ${tzLabel}; item detail last ${Math.min(detailDays, lookbackDays)}d, day totals through ${lookbackDays}d; clinic treatment-marker amounts when logged = USER DATA):`,
  ];

  for (const dk of dayKeys) {
    if (dk < cutoffKey) continue;
    const meals = [...(byDay.get(dk) ?? [])].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    if (!meals.length) continue;
    const kcal = meals.reduce((a, m) => a + (m.totalKcal ?? 0), 0);
    const p = meals.reduce((a, m) => a + (m.totalProtein_g ?? 0), 0);
    const c = meals.reduce((a, m) => a + (m.totalCarb_g ?? 0), 0);
    const f = meals.reduce((a, m) => a + (m.totalFat_g ?? 0), 0);
    const dayMarks = sumMarkerMaps(meals.map(resolveMealMarkers));
    const dayMarkBits = formatMarkerBits(dayMarks);
    const detail = dk >= detailCutoffKey;
    lines.push(
      `${dk}: ${meals.length} meals, ${Math.round(kcal)} kcal, P${Math.round(p)} C${Math.round(c)} F${Math.round(f)} g` +
        (dayMarkBits ? ` | ${dayMarkBits}` : '') +
        (detail ? '' : ' (totals only)'),
    );
    if (!detail) continue;
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

function downsampleGlucosePoints(
  dayPts: GlucosePoint[],
  stepMinutes: number,
): GlucosePoint[] {
  if (dayPts.length <= 2 || stepMinutes <= 0) return dayPts;
  const stepMs = stepMinutes * 60_000;
  const out: GlucosePoint[] = [];
  let lastKeptMs = -Infinity;
  for (let i = 0; i < dayPts.length; i++) {
    const p = dayPts[i]!;
    const t = Date.parse(p.timestamp);
    const isLast = i === dayPts.length - 1;
    if (isLast || t - lastKeptMs >= stepMs || out.length === 0) {
      out.push(p);
      lastKeptMs = t;
    }
  }
  return out;
}

function formatDayGlucoseSeries(
  glucose: GlucosePoint[],
  dayKey: string,
  utcOffsetMinutes: number,
  stepMinutes = CHAT_CGM_SERIES_STEP_MIN,
): string | null {
  const dayPts = glucoseOnDay(glucose, dayKey, utcOffsetMinutes).sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  if (!dayPts.length) return null;
  const sampled = downsampleGlucosePoints(dayPts, stepMinutes);
  const readings = sampled.map(
    (p) => `${formatHmFromIsoWithOffset(p.timestamp, utcOffsetMinutes)}=${Math.round(p.value)}`,
  );
  const last = dayPts[dayPts.length - 1]!;
  const sampleNote =
    sampled.length < dayPts.length
      ? `${sampled.length} of ${dayPts.length} samples (~${stepMinutes} min)`
      : `${dayPts.length} samples`;
  return `  CGM readings (${sampleNote}, HH:MM=mg/dL patient local — match Food log meal times): ${readings.join(', ')} | latest ${Math.round(last.value)} mg/dL at ${formatHmFromIsoWithOffset(last.timestamp, utcOffsetMinutes)}`;
}

/** Multi-day CGM for clinic mentor chat — matches dashboard chart data in portal. */
function formatCgmBlock(
  store: Record<string, string>,
  lookbackDays = CHAT_CGM_LOOKBACK_DAYS,
  fullSeriesDays = CHAT_CGM_FULL_SERIES_DAYS,
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
  lookbackDays = CHAT_WORKOUT_LOOKBACK_DAYS,
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

/** Strip AsyncStorage JSON string quotes: `"180"` → `180`. */
function storeScalar(raw: string | undefined): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    const parsed = JSON.parse(s);
    if (typeof parsed === 'string' || typeof parsed === 'number') return String(parsed);
  } catch { /* raw string */ }
  return s.replace(/^"|"$/g, '') || null;
}

function ageYearsFromBirthdate(iso: string): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const age = Math.floor((Date.now() - t) / (365.25 * 86400000));
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Demographics from phone keys (same as clinic Profile tab).
 * Without this, mentor chat invents "height missing" while the portal shows 180 cm.
 */
function formatProfileBlock(store: Record<string, string>): string | null {
  const gender = storeScalar(store.user_gender);
  const heightRaw = storeScalar(store.user_height_cm);
  const heightCm = heightRaw != null ? parseInt(heightRaw, 10) : NaN;
  const birthdate = storeScalar(store.user_birthdate);
  const age = birthdate ? ageYearsFromBirthdate(birthdate) : null;

  const parts: string[] = [];
  if (gender) parts.push(`gender ${gender}`);
  if (Number.isFinite(heightCm) && heightCm > 0) parts.push(`height ${heightCm} cm`);
  if (birthdate) parts.push(`birthdate ${birthdate}`);
  if (age != null) parts.push(`age ${age} y`);
  if (!parts.length) return null;
  return `Profile: ${parts.join(', ')}`;
}

type ClinicMarkerTarget = {
  marker: string;
  direction: string;
  dailyTarget: number;
  unit: string;
  note?: string;
};

function formatTreatmentMarkersTargetsBlock(
  markers: ClinicMarkerTarget[] | null | undefined,
  source: 'clinic overlay' | 'phone snapshot',
): string | null {
  if (!markers?.length) return null;
  const lines = markers.map((m) => {
    const code = String(m.marker ?? '').toUpperCase();
    const short = MARKER_SHORT[code] ?? code;
    const note = m.note?.trim() ? ` — ${m.note.trim()}` : '';
    return `- ${short} (${code}): ${m.direction} ${m.dailyTarget}${m.unit}/day${note}`;
  });
  return (
    `Clinic treatment markers — HARD daily targets (${source}). ` +
    `Food-log day/meal amounts for these codes are logged USER DATA (phone day meter). ` +
    `Default: cite those logged totals. If staff ask for an ingredient estimate, estimate and label it; if they ask to rely on daily logged amounts, use USER DATA only:\n` +
    lines.join('\n')
  );
}

function formatTreatmentMarkersTargetsFromStore(store: Record<string, string>): string | null {
  const raw = store['healthings:treatmentMarkers'];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { markers?: ClinicMarkerTarget[] };
    return formatTreatmentMarkersTargetsBlock(parsed.markers, 'phone snapshot');
  } catch {
    return null;
  }
}

function buildPatientContextBlock(
  exportData: SnapshotExport | null,
  packing: ChatPacking = DEFAULT_CHAT_PACKING,
): string {
  if (!exportData?.asyncStorage) return 'No patient snapshot uploaded yet.';

  const store = exportData.asyncStorage;
  const lines: string[] = [];
  const utcOffsetMinutes = inferPatientUtcOffsetMinutes(store);

  const profileBlock = formatProfileBlock(store);
  if (profileBlock) lines.push(profileBlock);

  const labsBlock = formatLabReports(store, packing.labReportLimit);
  if (labsBlock) lines.push(`Lab reports (newest first):\n${labsBlock}`);

  const withings = parseWithingsStore(store);
  if (withings?.bodyScan) {
    const b = withings.bodyScan;
    lines.push(
      `Body: weight ${b.weightKg ?? '—'} kg, fat ${b.fatMassKg ?? '—'} kg, muscle ${b.muscleMassKg ?? '—'} kg, BMR ${b.bmrKcalDay ?? '—'} kcal`,
    );
  }

  const cgmBlock = formatCgmBlock(
    store,
    packing.cgmLookbackDays,
    packing.cgmFullSeriesDays,
    utcOffsetMinutes,
  );
  if (cgmBlock) lines.push(cgmBlock);

  const foodBlock = formatFoodLogBlock(
    store,
    packing.foodLookbackDays,
    utcOffsetMinutes,
    packing.foodDetailDays,
  );
  if (foodBlock) lines.push(foodBlock);

  const workoutsBlock = formatWorkoutsBlock(store, packing.workoutLookbackDays, utcOffsetMinutes);
  if (workoutsBlock) lines.push(workoutsBlock);

  // Full rules rawText is attached separately in mentorChatReply* — do not duplicate here.

  const macroRaw = store.daily_macro_target;
  if (macroRaw) {
    try {
      const m = JSON.parse(macroRaw) as { kcal?: number; protein_g?: number; carb_g?: number; fat_g?: number };
      lines.push(`Macro targets: ${m.kcal ?? '—'} kcal, P${m.protein_g ?? '—'} C${m.carb_g ?? '—'} F${m.fat_g ?? '—'} g`);
    } catch { /* */ }
  }

  const treatFromPhone = formatTreatmentMarkersTargetsFromStore(store);
  if (treatFromPhone) lines.push(treatFromPhone);

  if (exportData.exportedAt) {
    lines.push(`Snapshot exported: ${exportData.exportedAt}`);
  }

  lines.push(
    packing.foodDetailDays >= packing.foodLookbackDays
      ? `Context window: food items through ${packing.foodLookbackDays}d (full item detail — no totals-only truncation); CGM day stats ${packing.cgmLookbackDays}d, detailed readings last ${packing.cgmFullSeriesDays}d (~${CHAT_CGM_SERIES_STEP_MIN} min); workouts ${packing.workoutLookbackDays}d; labs last ${packing.labReportLimit}.`
      : `Context window: food items last ${packing.foodDetailDays}d (day totals through ${packing.foodLookbackDays}d); CGM day stats ${packing.cgmLookbackDays}d, detailed readings last ${packing.cgmFullSeriesDays}d (~${CHAT_CGM_SERIES_STEP_MIN} min); workouts ${packing.workoutLookbackDays}d; labs last ${packing.labReportLimit}. Ask for a wider window (e.g. last 30 days) if needed.`,
  );

  return lines.length ? lines.join('\n') : 'Snapshot present but sparse.';
}

export async function mentorChatReply(
  mentorType: MentorType,
  message: string,
  history: ClinicChatMessage[],
  patientId: string,
  clinicRules: ClinicUserRules | null,
  clinicLocaleRaw?: string | null,
  clinicMarkers?: ClinicMarkerTarget[] | null,
): Promise<{ text: string; usage: GeminiUsage | null }> {
  const clinicLocale = normalizeClinicChatLocale(clinicLocaleRaw);
  const replyLanguage = CLINIC_LOCALE_NAME[clinicLocale];
  await refreshMarkerShorts();
  const snapshot = await loadLatestSnapshotExport(patientId);
  const packing = CLINIC_CHAT_PACKING;
  let dataBlock = buildPatientContextBlock(snapshot, packing);
  const overlayMarkersBlock = formatTreatmentMarkersTargetsBlock(
    clinicMarkers,
    'clinic overlay',
  );
  if (overlayMarkersBlock) {
    // Live clinic overlay wins over phone snapshot copy of the same targets.
    dataBlock = `${overlayMarkersBlock}\n${dataBlock}`;
  }

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
Use the patient data below. Do not invent labs, weigh-ins, CGM points, or meals that are not listed.
When Profile lists height (cm), gender, birthdate, or age — those values ARE known. Use them for BMI and similar. Never say height (or other Profile fields) is missing when it appears in the Profile line.
When CGM glucose lists a date with avg/min/max or HH:MM readings, that date HAS glucose data — cite it and correlate with Food log meals. Never say glucose/CGM is missing for a date that appears in the CGM block.
When Workouts & activity lists timed sessions for a date/time, that exercise IS logged — cite start/end, duration, and kcal. Correlate walks/workouts with CGM trends after meals. Never say exercise is missing for a date that appears in the Workouts block.

LOGGED TOTALS VS ESTIMATES (HARD):
- Food log includes kcal, macros (P/C/F/Fi), and — when present — **clinic treatment-marker amounts** (any clinic-set code: SatF, Chol, SolFi, n3, …) on day/meal/item lines. Those amounts are exact logged USER DATA (same as the phone day meters).
- Default: when staff discuss a marker/macro that appears in PATIENT DATA, cite the **logged day/meal totals**. Do not claim they are missing. Do not volunteer "הערכה מפירוט מזונות" / food-detail estimates instead of those totals.
- If staff **explicitly ask you to estimate** from foods/ingredients (or for a nutrient not listed in the numbers): estimate from food names + grams (USDA-style), label as estimated — that request is fine even when logged totals also exist.
- If staff **explicitly ask you to rely on daily logged macros/markers**: use only those USER DATA totals.
- Nutrients never listed (e.g. most vitamins, minerals not in the treatment-marker set): estimate from food detail when asked; do not invent that they appear in the log.

CLINIC TONE (HARD): Be a helpful senior clinical nutrition colleague — concise, concrete, respectful. Prefer numbers + named foods over meta talk about the software. If staff say the patient did log food detail, briefly agree and either (a) restate numbers from the log, or (b) estimate when they asked for an estimate — do not defend or describe product limitations. Meal times in PATIENT DATA are patient-local; present them as written. Do not invent labs or meals not listed.

LIVE RULES VS CHAT (HARD):
- Standing dietary rules the patient's app, meal analysis, and later chats follow are ONLY the CLINIC-UPDATED RULES or PATIENT RULES section below (saved on the Rules tab). Chat messages never become live rules, never sync to the phone, and never change meal/coach analysis.
- If staff paste or dictate new standing rules here: treat them as a draft. You may discuss or rephrase the wording. Do NOT confirm, accept, or say you will follow / apply / remember them for data analysis or patient recommendations.
- Tell staff, in ${replyLanguage}, to paste the wording into the Rules tab and Save — only then is it live.
- What-if questions ("if we used this wording, how would today's log look?") are OK as a hypothetical; say it is not live until Saved on the Rules tab.

REPLY LANGUAGE (HARD): Write your entire reply in ${replyLanguage} (clinic portal locale: ${clinicLocale}).
A patient may have rules, meal names, or notes in another language — quote those snippets as written when needed, but your explanation, greeting, and recommendations MUST be in ${replyLanguage}.
Do NOT mirror the patient's app language. Do NOT switch to Hebrew/Arabic/etc. just because patient-authored text is in that language.

PATIENT DATA:
${dataBlock}

${rulesBlock}

RECENT CHAT:
${historyText || '(none)'}

Clinic staff message:
${message}

Reply as the ${MENTOR_LABEL[mentorType]} mentor in ${replyLanguage} (plain text, no JSON).`;

  try {
    return await geminiTextWithUsage(prompt, {
      temperature: 0.4,
      maxOutputTokens: 8192,
      thinkingBudget: CHAT_THINKING_BUDGET,
    });
  } catch (e) {
    return { text: e instanceof Error ? e.message : 'AI chat unavailable', usage: null };
  }
}

/**
 * Patient chatting as themselves on /account/ (not clinic staff).
 * Reply language follows appLocale (passed as locale), not clinicLocale.
 */
export async function mentorChatReplyForPatient(
  mentorType: MentorType,
  message: string,
  history: ClinicChatMessage[],
  patientId: string,
  localeRaw?: string | null,
): Promise<{ text: string; usage: GeminiUsage | null }> {
  const locale = normalizeClinicChatLocale(localeRaw);
  const replyLanguage = CLINIC_LOCALE_NAME[locale];
  const snapshot = await loadLatestSnapshotExport(patientId);
  const packing = packingForPatientMessage(message);
  const dataBlock = buildPatientContextBlock(snapshot, packing);

  let snapRules: ClinicUserRules | null = null;
  const rulesRaw = snapshot?.asyncStorage?.user_rules;
  if (rulesRaw) {
    try {
      const parsed = JSON.parse(rulesRaw) as ClinicUserRules;
      if (parsed?.rawText?.trim()) snapRules = parsed;
    } catch { /* */ }
  }

  const rulesBlock = snapRules
    ? `YOUR RULES:\n${snapRules.rawText}\n${(snapRules.constraints ?? []).map((c) => `- ${c}`).join('\n')}`
    : '';

  const historyText = history
    .slice(-12)
    .map((m) => `${m.role === 'user' ? 'Patient' : MENTOR_LABEL[mentorType]}: ${m.text}`)
    .join('\n');

  const prompt = `You are the ${MENTOR_LABEL[mentorType]} AI mentor in a clinical nutrition app.
The patient is chatting with you about their own health data. Answer in clear, practical prose in second person ("you").
Use the patient data below. Do not invent labs, weigh-ins, CGM points, or meals that are not listed.
When Profile lists height (cm), gender, birthdate, or age — those values ARE known. Use them for BMI and similar. Never say height (or other Profile fields) is missing when it appears in the Profile line.
When CGM glucose lists a date with avg/min/max or HH:MM readings, that date HAS glucose data — cite it and correlate with Food log meals. Never say glucose/CGM is missing for a date that appears in the CGM block.
When Workouts & activity lists timed sessions for a date/time, that exercise IS logged — cite start/end, duration, and kcal. Correlate walks/workouts with CGM trends after meals. Never say exercise is missing for a date that appears in the Workouts block.

LOGGED TOTALS VS ESTIMATES (HARD):
- Food log includes kcal, macros (P/C/F/Fi), and — when present — clinic treatment-marker amounts on day/meal/item lines (USER DATA).
- Default: cite logged day/meal totals when discussing those markers/macros; do not claim they are missing or volunteer food-detail estimates instead.
- If the user **asks you to estimate** from foods: estimate and label as estimated — fine even when logged totals exist.
- If the user **asks you to rely on daily logged macros/markers**: use those USER DATA totals.
- Nutrients never listed: estimate from food detail when asked.

LIVE RULES VS CHAT (HARD):
- Standing dietary rules are ONLY the YOUR RULES section below (saved on the Rules tab / in the app). Chat does not save rules and does not change meal/coach analysis.
- If the user writes new standing rules here: discuss them as a draft. Do NOT confirm they are now in force. Tell them to paste into the Rules tab (or My Rules in the app) and Save.

REPLY LANGUAGE (HARD): Write your entire reply in ${replyLanguage} (patient app language: ${locale}).
Quote patient-authored snippets as written when needed, but your explanation and recommendations MUST be in ${replyLanguage}.

PATIENT DATA:
${dataBlock}

${rulesBlock}

RECENT CHAT:
${historyText || '(none)'}

Patient message:
${message}

Reply as the ${MENTOR_LABEL[mentorType]} mentor in ${replyLanguage} (plain text, no JSON).`;

  try {
    return await geminiTextWithUsage(prompt, {
      temperature: 0.4,
      maxOutputTokens: 8192,
      thinkingBudget: CHAT_THINKING_BUDGET,
    });
  } catch (e) {
    return { text: e instanceof Error ? e.message : 'AI chat unavailable', usage: null };
  }
}
