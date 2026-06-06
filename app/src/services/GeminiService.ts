/**
 * Gemini 2.5 Flash — food photo analysis + conversational correction.
 * Calls the REST API directly (no Node SDK needed on-device).
 */

import { GEMINI_API_KEY } from '@env';
import type { MentorType, DailyMacroTarget, BodyTarget, UserRules, CoachMessage, CoachActionItem, AutoCheckType, ChatMessage, UserLanguage } from './TargetService';
import type { TimePoint } from './SamsungHealthService';
import {
  buildYesterdayWorkoutRollup,
  buildPeriodReviewBlock,
  detectPeriodReviewQuery,
  PERIOD_REVIEW_CHAT_INSTRUCTION,
} from './ReviewService';

/** Returns a language instruction line to append to any AI prompt. */
function langInstruction(lang?: UserLanguage | null): string {
  if (!lang || lang.code === 'en') return '';
  return `\nRespond entirely in ${lang.label} (${lang.code}). All text in the response must be in ${lang.label}.`;
}

/** Stronger instruction for JSON coach responses — action item text often copied from English examples. */
function coachJsonLangInstruction(lang?: UserLanguage | null): string {
  if (!lang || lang.code === 'en') return '';
  return `\nLANGUAGE (mandatory): Write "text" AND every actionItems[].text in ${lang.label} (${lang.code}) only. Keep autoCheckType values exactly as English keys (carbs_under_target, etc.). Do NOT use English for user-visible strings.`;
}

function coachJsonExample(ctx: CoachContext): string {
  const carb = Math.round(ctx.macroTarget?.carb_g ?? 35);
  const protein = Math.round(ctx.macroTarget?.protein_g ?? 140);
  const kcal = Math.round(ctx.macroTarget?.kcal ?? 1950);
  const code = ctx.lang?.code ?? 'en';
  const hasCoach = ctx.mentors.includes('coach');
  const hasNut = ctx.mentors.includes('nutritionist');
  const coachEx =
    code === 'he'
      ? '{"text":"הליכה קצרה או מתיחות","autoCheckType":null}'
      : '{"text":"Short walk or stretch","autoCheckType":null}';
  const parts: string[] = [];
  if (hasNut) {
    parts.push(
      code === 'he'
        ? `{"text":"להישאר מתחת ל-${carb}g פחמימות","autoCheckType":"carbs_under_target"}`
        : `{"text":"Stay under ${carb}g carbs today","autoCheckType":"carbs_under_target"}`,
    );
    parts.push(
      code === 'he'
        ? `{"text":"להגיע ל-${protein}g חלבון","autoCheckType":"protein_over_target"}`
        : `{"text":"Hit ${protein}g protein","autoCheckType":"protein_over_target"}`,
    );
  }
  if (hasCoach) parts.push(coachEx);
  if (hasNut) {
    parts.push(
      code === 'he'
        ? '{"text":"לרשום את הארוחה הבאה","autoCheckType":"meal_logged"}'
        : '{"text":"Log next meal","autoCheckType":"meal_logged"}',
    );
  }
  if (parts.length === 0) parts.push(coachEx);
  const text =
    code === 'he'
      ? `אכלת 0 מתוך ${kcal} קק״ל.`
      : '2 sentences max. Specific numbers.';
  return `{"text":"${text}","actionItems":[${parts.join(',')}]}`;
}

function isCoachActionItem(item: CoachActionItem): boolean {
  if (item.autoCheckType != null) return false;
  return /muscle|training|walk|workout|stretch|movement|composition|שריר|אימון|הליכה|מתיחות|תנועה|composition|fat loss|ירידה/i.test(
    item.text,
  );
}

function buildCoachActionItem(ctx: CoachContext): CoachActionItem {
  const code = ctx.lang?.code ?? 'en';
  const hour = new Date().getHours();
  const earlyMorning = hour < 6;
  const muscle = ctx.muscleMass_kg;
  const targetMuscle = ctx.bodyTarget?.targetMuscleMass_kg;
  const targetWeight = ctx.bodyTarget?.targetWeight_kg;
  const ts = Date.now();

  if (code === 'he') {
    if (earlyMorning) {
      return { id: `coach-${ts}`, text: 'לתכנן תנועה/אימון להיום', done: false, autoCheckType: null };
    }
    if (muscle != null && targetMuscle != null) {
      return {
        id: `coach-${ts}`,
        text: `לשמור על השריר (${Math.round(muscle)}→${Math.round(targetMuscle)}kg)`,
        done: false,
        autoCheckType: null,
      };
    }
    if (targetWeight != null) {
      return {
        id: `coach-${ts}`,
        text: `להתקדם ליעד ${Math.round(targetWeight)}kg`,
        done: false,
        autoCheckType: null,
      };
    }
    return { id: `coach-${ts}`, text: 'הליכה קצרה או מתיחות', done: false, autoCheckType: null };
  }

  if (earlyMorning) {
    return { id: `coach-${ts}`, text: 'Plan movement or training today', done: false, autoCheckType: null };
  }
  if (muscle != null && targetMuscle != null) {
    return {
      id: `coach-${ts}`,
      text: `Protect muscle (${Math.round(muscle)}→${Math.round(targetMuscle)}kg)`,
      done: false,
      autoCheckType: null,
    };
  }
  if (targetWeight != null) {
    return {
      id: `coach-${ts}`,
      text: `Progress toward ${Math.round(targetWeight)}kg`,
      done: false,
      autoCheckType: null,
    };
  }
  return { id: `coach-${ts}`, text: 'Short walk or stretch', done: false, autoCheckType: null };
}

function ensureMentorActionItems(items: CoachActionItem[], ctx: CoachContext): CoachActionItem[] {
  if (!ctx.mentors.includes('coach')) return items.slice(0, 4);
  if (items.some(isCoachActionItem)) return items.slice(0, 4);
  const coachItem = buildCoachActionItem(ctx);
  const merged = items.length >= 4 ? [...items.slice(0, 3), coachItem] : [...items, coachItem];
  return merged.slice(0, 4);
}

function actionItemTextForCheck(
  type: AutoCheckType,
  ctx: CoachContext,
): string | null {
  const code = ctx.lang?.code ?? 'en';
  const carb = ctx.macroTarget?.carb_g;
  const protein = ctx.macroTarget?.protein_g;
  const kcal = ctx.macroTarget?.kcal;
  if (type === 'carbs_under_target' && carb != null) {
    const c = Math.round(carb);
    return code === 'he' ? `להישאר מתחת ל-${c}g פחמימות` : `Stay under ${c}g carbs`;
  }
  if (type === 'protein_over_target' && protein != null) {
    const p = Math.round(protein);
    return code === 'he' ? `להגיע ל-${p}g חלבון` : `Hit ${p}g protein`;
  }
  if (type === 'calorie_deficit' && kcal != null) {
    const k = Math.round(kcal);
    return code === 'he' ? `לצרוך לפחות ${k} קק״ל` : `Eat at least ${k} kcal`;
  }
  if (type === 'meal_logged') {
    return code === 'he' ? 'לרשום את הארוחה הבאה' : 'Log your next meal';
  }
  return null;
}

function alignActionItemToMacroTarget(item: CoachActionItem, ctx: CoachContext): CoachActionItem {
  if (!item.autoCheckType) return item;
  const aligned = actionItemTextForCheck(item.autoCheckType, ctx);
  return aligned ? { ...item, text: aligned } : item;
}

function isValidActionItemText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.startsWith('<')) return false;
  if (/user language|short action/i.test(t)) return false;
  return true;
}

function buildFallbackActionItems(ctx: CoachContext): CoachActionItem[] {
  const code = ctx.lang?.code ?? 'en';
  const carb = ctx.macroTarget?.carb_g;
  const protein = ctx.macroTarget?.protein_g;
  const ts = Date.now();
  const hasCoach = ctx.mentors.includes('coach');
  const hasNutritionist = ctx.mentors.includes('nutritionist');
  const labels =
    code === 'he'
      ? {
          carbs: carb != null ? `להישאר מתחת ל-${Math.round(carb)}g פחמימות` : 'לשמור על יעד הפחמימות',
          protein: protein != null ? `להגיע ל-${Math.round(protein)}g חלבון` : 'להגיע ליעד החלבון',
          meal: 'לרשום את הארוחה הבאה',
          coach: 'לשמור על השריר בירידה במשקל',
        }
      : {
          carbs: carb != null ? `Stay under ${Math.round(carb)}g carbs` : 'Stay within carb target',
          protein: protein != null ? `Hit ${Math.round(protein)}g protein` : 'Hit protein target',
          meal: 'Log your next meal',
          coach: 'Protect muscle during deficit',
        };
  const items: CoachActionItem[] = [];
  if (hasNutritionist) {
    items.push({ id: `fb-${ts}-0`, text: labels.carbs, done: false, autoCheckType: 'carbs_under_target' });
    items.push({ id: `fb-${ts}-1`, text: labels.protein, done: false, autoCheckType: 'protein_over_target' });
    items.push({ id: `fb-${ts}-2`, text: labels.meal, done: false, autoCheckType: 'meal_logged' });
  }
  if (hasCoach) {
    items.push({
      id: `fb-${ts}-c`,
      text: labels.coach,
      done: false,
      autoCheckType: null,
    });
  }
  if (items.length === 0) {
    items.push(
      { id: `fb-${ts}-0`, text: labels.meal, done: false, autoCheckType: 'meal_logged' },
    );
  }
  return items.slice(0, 4);
}

function normalizeCoachActionItems(
  raw: Array<{ text: string; autoCheckType: string | null }> | undefined,
  ctx: CoachContext,
): CoachActionItem[] {
  const parsed = (raw ?? [])
    .filter((item) => isValidActionItemText(String(item.text ?? '')))
    .slice(0, 4)
    .map((item, i) => ({
      id: `ai-${Date.now()}-${i}`,
      text: String(item.text).trim(),
      done: false,
      autoCheckType: (['carbs_under_target', 'protein_over_target', 'calorie_deficit', 'meal_logged'].includes(item.autoCheckType ?? '')
        ? item.autoCheckType as AutoCheckType
        : null),
    }));
  const items = parsed.length >= 2 ? parsed : buildFallbackActionItems(ctx);
  const aligned = items.map((item) => alignActionItemToMacroTarget(item, ctx));
  return ensureMentorActionItems(aligned, ctx);
}
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

type GeminiPart = { text?: string; thought?: boolean };

/** v1 endpoint — no thinkingConfig (v1beta-only). Rely on stripLeakedThinking instead. */
function geminiGenerationConfig(config: { temperature: number; maxOutputTokens: number }) {
  return config;
}

/** Prefer non-thought parts; fall back to all text parts if the model only returned thought parts. */
function extractGeminiText(candidate: { content?: { parts?: GeminiPart[] } } | undefined): string {
  const parts = candidate?.content?.parts ?? [];
  const allText = parts
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text!.trim())
    .filter(Boolean);
  const visible = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text!.trim())
    .filter(Boolean);

  const primary = (visible.length > 0 ? visible : allText).join('\n\n').trim();
  return stripLeakedThinking(primary);
}

/** Remove chain-of-thought that leaked into the text part (THOUGHT:, numbered analysis). */
function stripLeakedThinking(text: string): string {
  let t = text.trim();
  if (!t) return t;

  t = t.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

  const paragraphs = t.split(/\n\n+/);
  while (paragraphs.length > 0 && isLeakedThinkingParagraph(paragraphs[0]!)) {
    paragraphs.shift();
  }
  t = paragraphs.join('\n\n').trim();

  // Drop leading numbered internal planning (1. **Analyze…** …)
  while (/^\d+\.\s+\*\*(Analyze|Recalculate|Compare|Determine|Action|Review)/i.test(t)) {
    t = t.replace(/^\d+\.\s+\*\*[^*]+\*\*[^\n]*\n?/m, '').trim();
  }

  return t;
}

function isLeakedThinkingParagraph(p: string): boolean {
  const s = p.trim();
  return (
    /^THOUGHT:/i.test(s) ||
    /^Thought:/i.test(s) ||
    /^\d+\.\s+\*\*(Analyze|Recalculate|Compare|Determine|Action|Review)/i.test(s) ||
    /^\*\*Action:\*\*/i.test(s)
  );
}

/** Set to true during development to skip real API calls. */
const MOCK_MODE = false;

// ─── Types ──────────────────────────────────────────────────────────────────

export type FoodItem = {
  name: string;
  name_local?: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
};

export type GeminiAnalysisResult = {
  items: FoodItem[];
  confidence: 'high' | 'medium' | 'low';
  description: string;
  suggestion?: string;
};

export type GeminiTurn = {
  role: 'user' | 'model';
  text: string;
  imageBase64?: string;
  imageMimeType?: string;
};

// ─── System prompt ───────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a nutrition AI. Identify food and return macros as JSON ONLY.
No text before or after the JSON. No markdown. No explanation.

FORMAT (always exactly this):
{"items":[{"name":"...","name_local":"...","grams":0,"kcal":0,"protein_g":0.0,"carb_g":0.0,"fat_g":0.0}],"confidence":"high","description":"...","suggestion":"..."}

RULES:
- Estimate grams from plate size (standard plate = 26cm).
- Split dishes into ingredients. Use USDA values.
- For corrections: return full updated JSON, keep all items.
- If unsure: best guess with confidence "low".`;

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_RESULT: GeminiAnalysisResult = {
  items: [
    { name: 'Shakshuka', name_local: 'שקשוקה', grams: 300, kcal: 280, protein_g: 18.0, carb_g: 14.0, fat_g: 16.0 },
    { name: 'Pita bread', name_local: 'פיתה', grams: 80, kcal: 216, protein_g: 7.2, carb_g: 43.5, fat_g: 1.8 },
  ],
  confidence: 'high',
  description: 'Two eggs in tomato sauce with a side pita, standard restaurant portion.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeTotals(items: FoodItem[]): { totalKcal: number; totalProtein_g: number; totalCarb_g: number; totalFat_g: number } {
  return items.reduce(
    (acc, item) => ({
      totalKcal: acc.totalKcal + item.kcal,
      totalProtein_g: acc.totalProtein_g + item.protein_g,
      totalCarb_g: acc.totalCarb_g + item.carb_g,
      totalFat_g: acc.totalFat_g + item.fat_g,
    }),
    { totalKcal: 0, totalProtein_g: 0, totalCarb_g: 0, totalFat_g: 0 }
  );
}

function parseGeminiJson(raw: string, finishReason = 'STOP'): GeminiAnalysisResult {
  try {
    // Strip markdown fences, then find the first { ... } block in case Gemini
    // prepends prose like "Here is the analysis:" before the JSON.
    const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
    const parsed = JSON.parse(cleaned);
    const items: FoodItem[] = Array.isArray(parsed.items) ? parsed.items.map((it: Partial<FoodItem>) => ({
      name: String(it.name ?? 'Unknown food'),
      name_local: it.name_local,
      grams: Number(it.grams ?? 0),
      kcal: Math.round(Number(it.kcal ?? 0)),
      protein_g: Math.round(Number(it.protein_g ?? 0) * 10) / 10,
      carb_g: Math.round(Number(it.carb_g ?? 0) * 10) / 10,
      fat_g: Math.round(Number(it.fat_g ?? 0) * 10) / 10,
    })) : [];
    return {
      items,
      confidence: (parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low')
        ? parsed.confidence
        : 'medium',
      description: String(parsed.description ?? ''),
      suggestion: parsed.suggestion ? String(parsed.suggestion) : undefined,
    };
  } catch {
    // Include first 80 chars of rawText so we can diagnose what Gemini sent.
    const preview = raw.length > 0 ? raw.slice(0, 80).replace(/\n/g, ' ') : '(empty)';
    return {
      items: [{ name: 'Unknown food', grams: 0, kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 }],
      confidence: 'low',
      description: `Parse error [${finishReason}]: ${preview}`,
      suggestion: 'Try describing the meal in text.',
    };
  }
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Analyze a meal photo and/or text description.
 * Pass the full conversation history for correction turns.
 *
 * @param imageBase64      - JPEG/PNG base64 (before-meal photo). Null for text-only.
 * @param userText         - User's message or correction text.
 * @param history          - All previous turns (empty for first call).
 * @param afterImageBase64 - Optional after-meal photo. When provided, AI estimates
 *                           only what was consumed (before minus leftovers).
 * @returns Updated history + parsed result.
 */
export async function analyzeFood(
  imageBase64: string | null,
  userText: string,
  history: GeminiTurn[],
  afterImageBase64?: string | null,
  lang?: UserLanguage | null,
): Promise<{ result: GeminiAnalysisResult; updatedHistory: GeminiTurn[] }> {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 800));
    const newTurn: GeminiTurn = { role: 'user', text: userText, imageBase64: imageBase64 ?? undefined };
    const modelTurn: GeminiTurn = { role: 'model', text: JSON.stringify(MOCK_RESULT) };
    return { result: MOCK_RESULT, updatedHistory: [...history, newTurn, modelTurn] };
  }

  const langNote = langInstruction(lang);
  const systemPromptWithLang = langNote
    ? `${SYSTEM_PROMPT}${langNote}\nIMPORTANT: food item "name" field should be in ${lang!.label}, "name_local" can stay in original script.`
    : SYSTEM_PROMPT;

  // Prepend system prompt as a synthetic user/model exchange (compatible with all API versions).
  const systemTurns = history.length === 0 ? [
    { role: 'user', parts: [{ text: `INSTRUCTIONS:\n${systemPromptWithLang}\n\nConfirm you understand.` }] },
    { role: 'model', parts: [{ text: '{"items":[],"confidence":"high","description":"Ready to analyze food."}' }] },
  ] : [];

  // Build the user message text — add before/after context when two images are provided.
  // Always remind Gemini to respond in JSON to prevent plain-text responses.
  const JSON_REMINDER = ' Respond ONLY with the JSON format specified in your instructions. No markdown, no prose.';
  const effectiveText = afterImageBase64
    ? (userText || ('The FIRST image is the full plate before eating. The SECOND image is what was left after eating. Estimate only what was actually consumed (the difference). Give me the macros for what was eaten.' + JSON_REMINDER))
    : (userText || ('What food is in this photo? Give me the macros.' + JSON_REMINDER));

  const contents = [
    ...systemTurns,
    ...history.map((turn) => {
      const parts: object[] = [];
      if (turn.imageBase64) {
        parts.push({ inline_data: { mime_type: turn.imageMimeType ?? 'image/jpeg', data: turn.imageBase64 } });
      }
      parts.push({ text: turn.text });
      return { role: turn.role, parts };
    }),
    {
      role: 'user',
      parts: [
        ...(imageBase64 ? [{ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }] : []),
        ...(afterImageBase64 ? [{ inline_data: { mime_type: 'image/jpeg', data: afterImageBase64 } }] : []),
        { text: effectiveText },
      ],
    },
  ];

  const body = {
    contents,
    generationConfig: geminiGenerationConfig({
      temperature: 0.2,
      maxOutputTokens: 8192,
    }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    let readable = errText;
    try {
      const parsed = JSON.parse(errText);
      readable = parsed?.error?.message ?? errText;
    } catch { /* not JSON */ }
    if (__DEV__) {
      console.warn('[Gemini] API error', response.status, errText);
    }
    throw new Error(readable || `Gemini error ${response.status}`);
  }

  const json = await response.json();
  const candidate = json?.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? 'UNKNOWN';
  const rawText: string = extractGeminiText(candidate);

  // Surface any non-STOP finish reason as an explicit error.
  if (finishReason === 'SAFETY') {
    throw new Error('Gemini blocked the request (safety filter). Try a different photo or describe the meal in text.');
  }
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini response was cut off (MAX_TOKENS). The system prompt may be too long.');
  }
  if (!rawText) {
    throw new Error(`Gemini returned empty response (finishReason: ${finishReason}). Check API key.`);
  }

  const result = parseGeminiJson(rawText, finishReason);

  const newUserTurn: GeminiTurn = { role: 'user', text: userText, imageBase64: imageBase64 ?? undefined };
  const modelTurn: GeminiTurn = { role: 'model', text: rawText };

  // Persist system turns into history so corrections keep the full context.
  const systemHistoryTurns: GeminiTurn[] = history.length === 0 ? [
    { role: 'user', text: `INSTRUCTIONS:\n${systemPromptWithLang}\n\nConfirm you understand.` },
    { role: 'model', text: '{"items":[],"confidence":"high","description":"Ready to analyze food."}' },
  ] : [];

  return {
    result,
    updatedHistory: [...systemHistoryTurns, ...history, newUserTurn, modelTurn],
  };
}

export { computeTotals };

// ─── Body composition target suggestion ──────────────────────────────────────

export type BodyTargetInput = {
  weight_kg: number;
  fatPct: number;
  muscleMass_kg: number;
  bmr_kcal: number;
  heightCm: number;
  age: number;
  gender: string;
  bmi: number;
  weeklyWeightChange_kg?: number | null;
  avgDailyDeficit_kcal?: number | null;
};

export type BodyTargetSuggestion = {
  targetWeight_kg: number;
  targetFatPct: number;
  targetMuscleMass_kg: number;
  reasoning: string;
  estimatedWeeks: number;
  bmi_current: number;
  bmi_target: number;
};

/**
 * Asks Gemini to suggest body composition targets.
 * Single non-conversational call — returns structured JSON.
 */
export async function suggestBodyTargets(input: BodyTargetInput, lang?: UserLanguage | null): Promise<BodyTargetSuggestion> {
  const lines = [
    `Weight: ${input.weight_kg} kg`,
    `Fat%: ${input.fatPct}%`,
    `Muscle mass: ${input.muscleMass_kg} kg`,
    `BMR: ${input.bmr_kcal} kcal/day`,
    `Height: ${input.heightCm} cm`,
    `Age: ${input.age}`,
    `Gender: ${input.gender}`,
    `BMI: ${input.bmi.toFixed(1)}`,
    input.weeklyWeightChange_kg != null
      ? `Weekly weight change: ${input.weeklyWeightChange_kg > 0 ? '+' : ''}${input.weeklyWeightChange_kg.toFixed(2)} kg/week`
      : null,
    input.avgDailyDeficit_kcal != null
      ? `Average daily energy deficit: ${Math.round(input.avgDailyDeficit_kcal)} kcal`
      : null,
  ].filter(Boolean).join('\n');

  const prompt = `Fitness coach AI. Output ONLY valid JSON, no markdown, no explanation outside JSON.

METRICS:
${lines}

OUTPUT (fill real values, keep keys exactly as shown):
{"targetWeight_kg":80.0,"targetFatPct":16.0,"targetMuscleMass_kg":65.0,"reasoning":"Max 12 words about fat loss while preserving muscle.","estimatedWeeks":14,"bmi_current":26.8,"bmi_target":25.2}

RULES:
- Healthy BMI 18.5-25 (higher ok if muscular)
- Fat% men 10-18%, women 18-28%
- Muscle target >= current
- Pace 0.3-0.5 kg/week${langInstruction(lang)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0.2, maxOutputTokens: 8192 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const json = await response.json();
  const candidate = json?.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? 'UNKNOWN';
  const raw: string = extractGeminiText(candidate);

  if (!raw) throw new Error(`Empty AI response (${finishReason}). Check API key.`);

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  try {
    return JSON.parse(cleaned) as BodyTargetSuggestion;
  } catch {
    // Only mention truncation if that was the reason
    const hint = finishReason === 'MAX_TOKENS' ? ' (response truncated)' : '';
    throw new Error(`Could not parse AI response${hint}: ${raw.slice(0, 120)}`);
  }
}

// ─── Mentor system prompt (7 combinations: 3 singles + 3 pairs + all 3) ─────

const MENTOR_PERSONAS: Record<MentorType, string> = {
  doctor:
    'You are a medical doctor AI. Prioritise health risk reduction, evidence-based guidelines, and patient safety. When CGM data (TODAY/RECENT/MEAL GLUCOSE blocks) is present, interpret avg/min/max mg/dL and flag concerning patterns — exclude sensor warm-up false lows.',
  nutritionist:
    'You are a certified clinical nutritionist AI with CGM expertise. Continuous glucose is a PRIMARY input equal to macros — you MUST relate food, meal timing, and carbs to glucose response whenever CGM data is in context. Quote avg/min/max mg/dL; assess if glucose looks good or needs improvement; link spikes to foods when meals are logged.',
  coach:
    'You are a professional fitness coach AI. Focus on body composition, muscle preservation, progressive fat loss, training recovery, and performance goals.',
};

const MENTOR_PRIORITY: MentorType[] = ['doctor', 'nutritionist', 'coach'];

const MENTOR_LABELS: Record<MentorType, string> = {
  doctor: 'Doctor 🩺',
  nutritionist: 'Nutritionist 🥗',
  coach: 'Coach 💪',
};

/** Stable key for the 7 mentor combinations (doctor < nutritionist < coach). */
export function mentorComboKey(mentors: MentorType[]): string {
  return MENTOR_PRIORITY.filter((m) => mentors.includes(m)).join('+');
}

const MENTOR_COMBO_PROMPTS: Record<string, string> = {
  doctor: MENTOR_PERSONAS.doctor,

  nutritionist: MENTOR_PERSONAS.nutritionist,

  coach: MENTOR_PERSONAS.coach,

  'doctor+nutritionist': `You advise as Doctor 🩺 AND Nutritionist 🥗 — both active; both must inform every reply.
Doctor: safety, clinical risk, conservative limits; interpret CGM avg/min/max when present.
Nutritionist: food quality, macros, meal structure, glycemic impact — CGM is mandatory when data is in context.
In "text": at least one safety/clinical note AND one nutrition+CGM note (2 sentences max).
In actionItems: mix safety-aware food actions — never aggressive unsafe deficits.`,

  'doctor+coach': `You advise as Doctor 🩺 AND Coach 💪 — both active; both must inform every reply.
Doctor: health risk, safe rate of loss, red flags, recovery; CGM when present.
Coach: body composition, muscle preservation, training, performance, deficit strategy.
In "text": at least one clinical/safety note AND one composition/training note (2 sentences max).
In actionItems: mix safe health guardrails with body-composition actions.`,

  'nutritionist+coach': `You advise as Nutritionist 🥗 AND Coach 💪 — both active; BOTH must speak in every reply.
Nutritionist lens: food quality, macros, meal timing, CGM glycemic response (avg/min/max when data present) — NOT optional.
Coach lens: body composition, muscle mass, training recovery, progressive fat loss, performance — NOT just food.
CRITICAL: Do NOT let nutrition dominate. The Coach must always have a visible angle (muscle, composition, movement, recovery, tomorrow's training).
In "text": one sentence from Nutritionist (include CGM numbers when block present) AND one from Coach (2 sentences max).
In actionItems: include at least one food/macro or CGM-aware item AND at least one body-composition or activity item.
If conflict: food quality (Nutritionist) > reckless deficit (Coach) — but Coach still contributes.`,

  'doctor+nutritionist+coach': `You advise as Doctor 🩺, Nutritionist 🥗, AND Coach 💪 — all three active; each must inform every reply.
Priority when advice conflicts: safety (Doctor) > food quality + CGM (Nutritionist) > performance (Coach).
Nutritionist MUST use CGM data when in context — avg/min/max mg/dL, good vs needs improvement.
In "text": weave clinical safety, nutrition+CGM, and body-composition/training (2 sentences max — hit all three angles briefly).
In actionItems: spread across safety-aware eating, macro/CGM targets, and composition/training — at least one item per active mentor angle where possible.`,
};

export function buildMentorSystemPrompt(mentors: MentorType[]): string {
  const ordered = MENTOR_PRIORITY.filter((m) => mentors.includes(m));
  if (ordered.length === 0) return MENTOR_COMBO_PROMPTS.coach;
  const key = mentorComboKey(ordered);
  return MENTOR_COMBO_PROMPTS[key] ?? MENTOR_PERSONAS[ordered[0]!];
}

/** Rules appended when CGM data is available — Nutritionist/Doctor must use it. */
function buildCgmMentorRules(ctx: CoachContext): string {
  const hasCgm =
    Boolean(ctx.todayMealGlucoseDetail) ||
    (ctx.glucoseHistory != null && ctx.glucoseHistory.length > 0);
  if (!hasCgm) return '';
  const hasNut = ctx.mentors.includes('nutritionist');
  const hasDoc = ctx.mentors.includes('doctor');
  if (!hasNut && !hasDoc) {
    return '\n- CGM data is in USER DATA — cite avg/min/max mg/dL when relevant.';
  }
  return `
- CGM (TODAY / RECENT / MEAL GLUCOSE blocks) is a PRIMARY input — never ignore it
- Nutritionist 🥗 MUST interpret glucose in every reply: quote avg, min, max (mg/dL); cite range % (below 70 / 70–100 / above 100) and low-day count when present
- Mention compression lows if relevant: sleeping on the sensor can falsely lower readings — isolated low days may be artifact
- Exclude sensor warm-up (first 24h after install) and statistically excluded rare sensor-error days — see filter lines in USER DATA
- Without meal logs: still assess CGM; urge logging meals to link spikes to specific foods
- Do NOT give vague CGM summaries ("elevated days") without numbers`;
}

export function formatActiveMentorsLine(mentors: MentorType[]): string {
  const ordered = MENTOR_PRIORITY.filter((m) => mentors.includes(m));
  const labels = ordered.map((m) => MENTOR_LABELS[m]).join(' + ');
  if (ordered.length <= 1) return `ACTIVE MENTORS: ${labels}`;
  return `ACTIVE MENTORS: ${labels} — every reply must reflect ALL selected mentors (see system prompt).`;
}

// ─── User rules summarisation ─────────────────────────────────────────────────

export type UserRulesSummary = {
  summary: string;
  constraints: string[];
  aiContext: string;
};

export async function summariseUserRules(
  rawText: string,
  mentors: MentorType[],
  lang?: UserLanguage | null,
): Promise<UserRulesSummary> {
  const systemPrompt = buildMentorSystemPrompt(mentors);

  const prompt = `${systemPrompt}

The user described their dietary and lifestyle preferences. Extract and structure into JSON only, no markdown:
{"summary":"Keto · IF 16:8","constraints":["< 50g carbs/day","eating window 12–8pm"],"aiContext":"Ketogenic diet with 16:8 intermittent fasting."}

Rules:
- summary: max 5 words, use · separator
- constraints: max 5 items, max 8 words each
- aiContext: max 20 words, used in future AI prompts

User text: "${rawText.replace(/"/g, "'")}"${langInstruction(lang)}`; 

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0.1, maxOutputTokens: 8192 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const raw: string = extractGeminiText(json?.candidates?.[0]);
  if (!raw) throw new Error('Empty response from Gemini');

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  try {
    return JSON.parse(cleaned) as UserRulesSummary;
  } catch {
    throw new Error(`Could not parse rules summary: ${raw.slice(0, 100)}`);
  }
}

// ─── Daily macro suggestion ───────────────────────────────────────────────────

export type MacroSuggestionInput = {
  weight_kg: number;
  fatMass_kg: number;
  muscleMass_kg: number;
  bmr_kcal: number;
  estimatedBurn_kcal: number | null;
  heightCm: number;
  age: number;
  gender: string;
  bodyTarget: { targetWeight_kg: number; targetFatPct: number; targetMuscleMass_kg: number } | null;
  rulesContext: string;
  mentors: MentorType[];
};

export type MacroSuggestion = {
  protein_g: number;
  fat_g: number;
  carb_g: number;
  kcal: number;
  diet_label: string;
  reasoning: string;
};

export async function suggestDailyMacros(input: MacroSuggestionInput, lang?: UserLanguage | null): Promise<MacroSuggestion> {
  const systemPrompt = buildMentorSystemPrompt(input.mentors);
  const leanMass = input.weight_kg - input.fatMass_kg;
  const fatPct = (input.fatMass_kg / input.weight_kg) * 100;

  const lines = [
    `Weight: ${input.weight_kg} kg | Lean mass: ${leanMass.toFixed(1)} kg | Fat%: ${fatPct.toFixed(1)}%`,
    `BMR: ${input.bmr_kcal} kcal | Est. daily burn: ${input.estimatedBurn_kcal ?? 'unknown'} kcal`,
    `Age: ${input.age} | Gender: ${input.gender} | Height: ${input.heightCm} cm`,
    input.bodyTarget
      ? `Goal: ${input.bodyTarget.targetWeight_kg} kg / ${input.bodyTarget.targetFatPct}% fat / ${input.bodyTarget.targetMuscleMass_kg} kg muscle`
      : 'Goal: general health and body composition improvement',
    input.rulesContext ? `⚠️ HARD DIETARY CONSTRAINT (must not be violated): ${input.rulesContext}` : null,
  ].filter(Boolean).join('\n');

  const prompt = `${systemPrompt}

METRICS:
${lines}

OUTPUT (JSON only, no markdown):
{"protein_g":160,"fat_g":140,"carb_g":30,"kcal":1960,"diet_label":"Ketogenic","reasoning":"Max 15 words."}

RULES (apply in strict priority order):
1. DIETARY RULES ARE HARD CONSTRAINTS — they override everything else. If the user says "< 20g carbs", carb_g MUST be ≤ 20. If the user says "keto", carb_g MUST be ≤ 20g. Never violate these.
2. Protein: 1.6–2.2g × lean_mass_kg (preserve muscle)
3. Calorie deficit 300–500 kcal below estimated burn for fat loss
4. Fill remaining calories with fat after protein and carbs are set
5. diet_label: Ketogenic/Vegan/High Protein/Mediterranean/Balanced/Custom${langInstruction(lang)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0.2, maxOutputTokens: 8192 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const candidate = json?.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? 'UNKNOWN';
  const raw: string = extractGeminiText(candidate);
  if (!raw) throw new Error(`Empty AI response (${finishReason})`);

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  try {
    return JSON.parse(cleaned) as MacroSuggestion;
  } catch {
    const hint = finishReason === 'MAX_TOKENS' ? ' (truncated)' : '';
    throw new Error(`Could not parse macro suggestion${hint}: ${raw.slice(0, 100)}`);
  }
}

// ─── Coach context & message generation ───────────────────────────────────────

export type CoachTriggerEvent = 'meal' | 'weigh-in' | 'workout' | 'day-close';

export type CoachContext = {
  mentors: MentorType[];
  event: CoachTriggerEvent;
  lang?: UserLanguage | null;
  // user profile
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  // body
  weightKg: number | null;
  fatPct: number | null;
  muscleMass_kg: number | null;
  bmr_kcal: number | null;
  startWeight_kg: number | null;
  startMuscle_kg: number | null;
  // today food
  todayEaten: number | null;
  todayBurn: number | null;
  todayProtein_g: number | null;
  todayFat_g: number | null;
  todayCarb_g: number | null;
  mealCount: number;
  lastMealSummary: string | null;
  todayMealsDetail: string | null;
  /** Per-meal or today-only CGM summary when glucose samples exist. */
  todayMealGlucoseDetail: string | null;
  /** Same CGM series as the dashboard chart (HC sync + CareSens CSV). */
  glucoseHistory: TimePoint[];
  // yesterday food (chat only — optional rollup + on-demand meal detail)
  yesterdayDate?: string | null;
  yesterdayEaten?: number | null;
  yesterdayProtein_g?: number | null;
  yesterdayCarb_g?: number | null;
  yesterdayFat_g?: number | null;
  yesterdayMealCount?: number;
  yesterdayMealsDetail?: string | null;
  // targets
  macroTarget: DailyMacroTarget | null;
  bodyTarget: BodyTarget | null;
  userRules: UserRules | null;
};

type DayPhase = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'late_evening';

function getDayPhase(hour: number): DayPhase {
  if (hour < 6) return 'early_morning';
  if (hour < 11) return 'morning';
  if (hour < 15) return 'midday';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'late_evening';
}

function formatLocalTimeContext(now = new Date()): { clockLine: string; guidance: string } {
  const hour = now.getHours();
  const phase = getDayPhase(hour);
  const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const clockLine = `LOCAL TIME NOW: ${dateStr}, ${timeStr} (${phase.replace(/_/g, ' ')})`;

  const guidanceByPhase: Record<DayPhase, string> = {
    early_morning:
      'Early morning / just after midnight. The calendar day just started — 0 meals and 0 kcal TODAY is normal, not a crisis. Do NOT warn about a dangerous deficit from today\'s empty log. Be calm and supportive. Prefer closing yesterday, planning later today, or rest — not urgent "log now" pressure.',
    morning: 'Morning — breakfast and day planning fit naturally. Encouraging tone, not alarming.',
    midday: 'Midday — lunch window. Compare morning intake to targets with a practical tone.',
    afternoon: 'Afternoon — snack or pre-dinner. Stay moderate and specific.',
    evening: 'Evening — dinner and closing daily macros. Can be more direct about what remains today.',
    late_evening:
      'Late evening — avoid harsh pressure. Summarise today or gently prep for tomorrow.',
  };

  return { clockLine, guidance: guidanceByPhase[phase] };
}

function buildCoachDataBlock(ctx: CoachContext): string {
  const { clockLine, guidance } = formatLocalTimeContext();
  const n = (v: number | null, unit = '') => v != null ? `${v}${unit}` : '—';
  const summaryLines = [
    clockLine,
    `TIME-AWARE COACHING: ${guidance}`,
    formatActiveMentorsLine(ctx.mentors),
    `EVENT: ${ctx.event}`,
    `Weight: ${n(ctx.weightKg, ' kg')} (start: ${n(ctx.startWeight_kg, ' kg')}, target: ${n(ctx.bodyTarget?.targetWeight_kg ?? null, ' kg')})`,
    `Muscle: ${n(ctx.muscleMass_kg, ' kg')} (start: ${n(ctx.startMuscle_kg, ' kg')}, target: ${n(ctx.bodyTarget?.targetMuscleMass_kg ?? null, ' kg')})`,
    `Today eaten: ${n(ctx.todayEaten, ' kcal')} / ${n(ctx.macroTarget?.kcal ?? null, ' kcal target')} | P: ${n(ctx.todayProtein_g, 'g')}/${n(ctx.macroTarget?.protein_g ?? null, 'g')} | C: ${n(ctx.todayCarb_g, 'g')}/${n(ctx.macroTarget?.carb_g ?? null, 'g')} | F: ${n(ctx.todayFat_g, 'g')}/${n(ctx.macroTarget?.fat_g ?? null, 'g')}`,
    `Today burned: ${n(ctx.todayBurn, ' kcal')} | Balance: ${ctx.todayEaten != null && ctx.todayBurn != null ? Math.round(ctx.todayEaten - ctx.todayBurn) + ' kcal' : '—'}`,
    `Meals logged today: ${ctx.mealCount}`,
    ctx.userRules?.aiContext ? `Dietary rules: ${ctx.userRules.aiContext}` : null,
  ].filter(Boolean);

  const mealSection = ctx.todayMealsDetail
    ? [
        '=== MEAL LOG (full detail — use this when reviewing meals) ===',
        ctx.todayMealsDetail,
        ctx.lastMealSummary ? `Most recent meal (summary): ${ctx.lastMealSummary}` : null,
        '=== END MEAL LOG ===',
      ].filter(Boolean).join('\n')
    : '=== MEAL LOG ===\nNo meals logged today.\n=== END MEAL LOG ===';

  const glucoseSection = ctx.todayMealGlucoseDetail
    ? ['', ctx.todayMealGlucoseDetail].join('\n')
    : null;

  return [...summaryLines, '', mealSection, glucoseSection].filter(Boolean).join('\n');
}

function formatYesterdayRollup(ctx: CoachContext): string | null {
  if (!ctx.yesterdayDate) return null;
  const n = (v: number | null | undefined, unit = '') =>
    v != null ? `${Math.round(v)}${unit}` : '—';
  const date = ctx.yesterdayDate;
  const count = ctx.yesterdayMealCount ?? 0;
  if (count === 0) {
    return `YESTERDAY (${date}): no meals logged`;
  }
  const mt = ctx.macroTarget;
  return [
    `YESTERDAY (${date}):`,
    `eaten ${n(ctx.yesterdayEaten, ' kcal')}${mt?.kcal != null ? ` / ${mt.kcal} target` : ''}`,
    `P: ${n(ctx.yesterdayProtein_g, 'g')}${mt?.protein_g != null ? `/${mt.protein_g}g` : ''}`,
    `C: ${n(ctx.yesterdayCarb_g, 'g')}${mt?.carb_g != null ? `/${mt.carb_g}g` : ''}`,
    `F: ${n(ctx.yesterdayFat_g, 'g')}${mt?.fat_g != null ? `/${mt.fat_g}g` : ''}`,
    `${count} meals`,
  ].join(' | ');
}

/** Chat context — today block plus compact yesterday rollup. */
function buildChatDataBlock(ctx: CoachContext): string {
  const base = buildCoachDataBlock(ctx);
  const rollup = formatYesterdayRollup(ctx);
  return rollup ? `${base}\n\n${rollup}` : base;
}

/** Detect meal-review questions in any supported language. */
export function isMealReviewQuery(text: string): boolean {
  const t = text.toLowerCase();
  return /meal|ארוחה|comida|repas|mahlzeit|وجبة|приём|manger|essen|food log|last eat/i.test(t);
}

/** Detect questions about yesterday / last night. */
export function isYesterdayQuery(text: string): boolean {
  return /yesterday|אתמול|אמש|last night|ayer|hier|gestern|вчера|أمس/i.test(text);
}

export async function generateCoachMessage(ctx: CoachContext): Promise<CoachMessage> {
  const systemPrompt = buildMentorSystemPrompt(ctx.mentors);
  const dataBlock = buildCoachDataBlock(ctx);
  const yesterdayWorkouts = await buildYesterdayWorkoutRollup();

  const jsonExample = coachJsonExample(ctx);
  const carbTarget = ctx.macroTarget?.carb_g;
  const proteinTarget = ctx.macroTarget?.protein_g;

  const prompt = `${systemPrompt}

USER DATA:
${dataBlock}

${yesterdayWorkouts}

Respond with JSON only (no markdown, no prose):
${jsonExample}

Rules:
- Match tone and action items to LOCAL TIME NOW and TIME-AWARE COACHING above
- When Coach 💪 is in ACTIVE MENTORS, actionItems MUST include at least one Coach item (autoCheckType null): movement, muscle, training, or body-composition — not food macros
- Reflect ALL active mentors in ACTIVE MENTORS — do not silence Coach when Nutritionist is also selected (and vice versa)
- text: max 2 sentences, cite specific numbers from the data, no generic advice
- actionItems: 2–4 items, max 8 words each, concrete and actionable for THIS time of day — same language as text
- autoCheckType: use "carbs_under_target", "protein_over_target", "calorie_deficit", "meal_logged", or null (always English keys)
- carbs_under_target MUST cite carb target ${carbTarget != null ? `${Math.round(carbTarget)}g` : 'from USER DATA C:/target line'} — never use generic 20g keto defaults
- protein_over_target MUST cite protein target ${proteinTarget != null ? `${Math.round(proteinTarget)}g` : 'from USER DATA P:/target line'}
- Dietary rules in USER DATA override any generic diet assumptions
- If event is meal: focus on remaining macros for the day
- If event is weigh-in: focus on trend vs target, muscle vs start
- If event is workout: focus on calorie budget impact and HR during session vs resting baseline when YESTERDAY WORKOUTS includes HR lines
- Do NOT repeat data the user already sees on the dashboard
- If Nutritionist 🥗 is active and CGM blocks are in USER DATA, "text" MUST include glucose avg/min/max (mg/dL) and good-vs-needs-improvement verdict${coachJsonLangInstruction(ctx.lang)}`;

  const glucoseCoachRule = buildCgmMentorRules(ctx);

  const body = {
    contents: [{ role: 'user', parts: [{ text: `${prompt}${glucoseCoachRule}` }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0.3, maxOutputTokens: 8192 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini coach error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const raw: string = extractGeminiText(json?.candidates?.[0]);
  if (!raw) throw new Error('Empty AI response for coach message');

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  let parsed: { text: string; actionItems: Array<{ text: string; autoCheckType: string | null }> };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse coach message: ${raw.slice(0, 100)}`);
  }

  const actionItems = normalizeCoachActionItems(parsed.actionItems, ctx);

  return {
    id: `coach-${Date.now()}`,
    text: String(parsed.text ?? ''),
    actionItems,
    triggerEvent: ctx.event,
    generatedAt: new Date().toISOString(),
    mealCountAtGeneration: ctx.mealCount,
    generatedLangCode: ctx.lang?.code ?? 'en',
  };
}

// ─── Free chat with mentors ────────────────────────────────────────────────────

export async function chatWithMentors(
  message: string,
  history: ChatMessage[],
  ctx: CoachContext,
  yesterdaySummary: string | null,
): Promise<string> {
  const systemPrompt = buildMentorSystemPrompt(ctx.mentors);
  const dataBlock = buildChatDataBlock(ctx);
  const yesterdayWorkouts = await buildYesterdayWorkoutRollup();
  const periodRequest = detectPeriodReviewQuery(message);
  const periodBlock = periodRequest
    ? await buildPeriodReviewBlock(periodRequest, ctx.macroTarget, ctx.glucoseHistory)
    : '';
  const yesterdayChatLine = yesterdaySummary ? `\nYesterday chat summary: ${yesterdaySummary}` : '';
  const yesterdayMealSection = ctx.yesterdayMealsDetail
    ? `\n\n=== YESTERDAY MEAL LOG (${ctx.yesterdayDate}) ===\n${ctx.yesterdayMealsDetail}\n=== END YESTERDAY MEAL LOG ===`
    : '';
  const periodSection = periodBlock ? `\n\n${periodBlock}\n\n${PERIOD_REVIEW_CHAT_INSTRUCTION}` : '';

  const systemText = `${systemPrompt}${yesterdayChatLine}

CURRENT USER DATA:
${dataBlock}
${yesterdayWorkouts}${yesterdayMealSection}${periodSection}

You are responding in a free chat. Be concise, specific, and supportive.
Match your tone to LOCAL TIME NOW and TIME-AWARE COACHING in the data — early morning means gentle, not alarmist.
When multiple mentors are active (see ACTIVE MENTORS), include each mentor's perspective — especially Coach 💪 body-composition angle when Coach is selected.
Reply directly to the user — never output THOUGHT, internal reasoning, numbered analysis steps, or planning in English unless the user wrote in English.
The MEAL LOG section is today's food. YESTERDAY WORKOUTS shows yesterday's training sessions from Withings with HR during each session when watch data exists.
When MEAL GLUCOSE, TODAY CGM, or RECENT CGM blocks are in USER DATA, Nutritionist 🥗 MUST lead with glucose interpretation (avg/min/max mg/dL) — this is core nutritionist work, not optional. Doctor 🩺 adds clinical safety on the same numbers. With meals, name foods before spikes; without meals, assess trend and urge food logging.
YESTERDAY rollup/meal lines are yesterday's food — use for אתמול / yesterday questions.
When PERIOD REVIEW block is present, analyze the full snapshot (body, energy, HR, food, workouts): what went well, what to improve, specific next steps.
When GLUCOSE & FOOD IMPACT is in PERIOD REVIEW, Nutritionist and Doctor must cite which foods preceded spikes and recommend swaps for repeat offenders.
Users can request any window via slash commands: /1 or /yesterday, /7, /30, /100 (up to 128 days).
When the user asks about their last meal or any meal today, review today's MEAL LOG directly — never say you lack meal details if MEAL LOG is present.
When YESTERDAY MEAL LOG is present, cite specific foods and numbers from it for yesterday questions.
Ignore any earlier chat messages where you said yesterday's data was unavailable; always use the YESTERDAY blocks above.${langInstruction(ctx.lang)}`;

  // Build history turns (max last 20 messages)
  const recentHistory = history.slice(-20);

  // Repeat meal logs in the user turn so the model cannot miss them
  let userMessage = message;
  if (periodRequest) {
    userMessage = `${message}\n\nUse the PERIOD REVIEW block in context. Each active mentor: what was good, what to improve, 2–4 concrete suggestions. For GLUCOSE: quote period avg, min, max (mg/dL) from the block; ignore sensor warm-up (first 24h) lows; do NOT give vague CGM summaries.`;
  } else if (ctx.mentors.includes('nutritionist') && (ctx.todayMealGlucoseDetail || (ctx.glucoseHistory?.length ?? 0) > 0)) {
    userMessage = `${message}\n\nNutritionist: address CGM in USER DATA first — quote recent avg/min/max (mg/dL) and say if glucose looks good or needs improvement.`;
  } else if (isMealReviewQuery(message) && !isYesterdayQuery(message) && ctx.todayMealsDetail) {
    const glucoseHint = ctx.todayMealGlucoseDetail
      ? '\n\nUse TODAY CGM / MEAL GLUCOSE in context: say if glucose looks good or needs improvement (specific mg/dL).'
      : '';
    userMessage = `${message}\n\nUse today's meal log (already in your context — cite specific foods and numbers):\n${ctx.todayMealsDetail}${glucoseHint}`;
  } else if (isYesterdayQuery(message) && ctx.yesterdayMealsDetail) {
    userMessage = `${message}\n\nUse yesterday's meal log (already in your context — cite specific foods and numbers):\n${ctx.yesterdayMealsDetail}`;
  } else if (isYesterdayQuery(message) && ctx.yesterdayDate) {
    userMessage = `${message}\n\nUse the YESTERDAY rollup in your context for macro totals (protein, carbs, kcal).`;
  }

  const contents = [
    { role: 'user', parts: [{ text: `SYSTEM CONTEXT:\n${systemText}\n\nAcknowledge.` }] },
    { role: 'model', parts: [{ text: 'Understood. I will use local time, food, workouts, and period reviews when provided.' }] },
    ...recentHistory.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.role === 'assistant' ? stripLeakedThinking(m.text) : m.text }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = {
    contents,
    generationConfig: geminiGenerationConfig({ temperature: 0.4, maxOutputTokens: 8192 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini chat error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const raw: string = extractGeminiText(json?.candidates?.[0]);
  if (!raw.trim()) {
    const code = ctx.lang?.code ?? 'en';
    return code === 'he'
      ? 'סליחה, לא הצלחתי להשיב הפעם. נסה/י שוב בעוד רגע.'
      : 'Sorry, I could not reply this time. Please try again in a moment.';
  }
  return raw.trim();
}

// ─── Summarise yesterday's chat ────────────────────────────────────────────────

export async function summariseChatDay(history: ChatMessage[]): Promise<string> {
  if (history.length === 0) return '';

  const transcript = history
    .map((m) => `${m.role === 'user' ? 'User' : 'Mentor'}: ${m.text}`)
    .join('\n')
    .slice(0, 3000);

  const prompt = `Summarise this health coaching chat in one sentence (max 20 words). Focus on key outcomes or advice.\n\n${transcript}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0.2, maxOutputTokens: 256 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) return '';

  const json = await response.json();
  const raw: string = extractGeminiText(json?.candidates?.[0]);
  return raw.trim().slice(0, 200);
}
