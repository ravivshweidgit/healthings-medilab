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

function buildPatientContextBlock(exportData: SnapshotExport | null): string {
  if (!exportData?.asyncStorage) return 'No patient snapshot uploaded yet.';

  const store = exportData.asyncStorage;
  const lines: string[] = [];

  const labsBlock = formatLabReports(store);
  if (labsBlock) lines.push(`Lab reports (newest first):\n${labsBlock}`);

  const withingsRaw = store['healthings:withingsStore'];
  if (withingsRaw) {
    try {
      const w = JSON.parse(withingsRaw) as { bodyScan?: { weightKg?: number; fatMassKg?: number; muscleMassKg?: number; bmrKcalDay?: number } };
      if (w.bodyScan) {
        lines.push(
          `Body: weight ${w.bodyScan.weightKg ?? '—'} kg, fat ${w.bodyScan.fatMassKg ?? '—'} kg, muscle ${w.bodyScan.muscleMassKg ?? '—'} kg, BMR ${w.bodyScan.bmrKcalDay ?? '—'} kcal`,
        );
      }
    } catch { /* */ }
  }

  const cgmRaw = store['healthings:lastMetrics'];
  if (cgmRaw) {
    try {
      const cgm = JSON.parse(cgmRaw) as { glucose?: Array<{ timestamp: string; value: number }> };
      const g = cgm.glucose ?? [];
      if (g.length) {
        const recent = g.slice(-120);
        const avg = recent.reduce((a, p) => a + p.value, 0) / recent.length;
        lines.push(`CGM: ${g.length} points, recent avg ${Math.round(avg)} mg/dL`);
      }
    } catch { /* */ }
  }

  const today = new Date();
  const dk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const foodRaw = store[`food_log_${dk}`];
  if (foodRaw) {
    try {
      const meals = JSON.parse(foodRaw) as Array<{ totalKcal?: number; totalProtein_g?: number; totalCarb_g?: number; totalFat_g?: number }>;
      const kcal = meals.reduce((a, m) => a + (m.totalKcal ?? 0), 0);
      const p = meals.reduce((a, m) => a + (m.totalProtein_g ?? 0), 0);
      const c = meals.reduce((a, m) => a + (m.totalCarb_g ?? 0), 0);
      const f = meals.reduce((a, m) => a + (m.totalFat_g ?? 0), 0);
      lines.push(`Today food: ${meals.length} meals, ${Math.round(kcal)} kcal, P${Math.round(p)} C${Math.round(c)} F${Math.round(f)} g`);
    } catch { /* */ }
  }

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
  const rulesBlock = clinicRules
    ? `CLINIC-UPDATED RULES (authoritative):\n${clinicRules.rawText}\n${clinicRules.constraints.map((c) => `- ${c}`).join('\n')}`
    : '';

  const historyText = history
    .slice(-12)
    .map((m) => `${m.role === 'user' ? 'Clinic staff' : MENTOR_LABEL[mentorType]}: ${m.text}`)
    .join('\n');

  const prompt = `You are the ${MENTOR_LABEL[mentorType]} AI mentor in a clinical nutrition app.
The clinic staff is chatting on behalf of reviewing this patient's data. Answer in clear, practical prose.
Use the patient data below. Do not invent labs or meals not listed.

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
