/**
 * Gemini 2.5 Flash — food photo analysis + conversational correction.
 * Calls the REST API directly (no Node SDK needed on-device).
 */

import { GEMINI_API_KEY } from '@env';
import type { MentorType } from './TargetService';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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
): Promise<{ result: GeminiAnalysisResult; updatedHistory: GeminiTurn[] }> {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 800));
    const newTurn: GeminiTurn = { role: 'user', text: userText, imageBase64: imageBase64 ?? undefined };
    const modelTurn: GeminiTurn = { role: 'model', text: JSON.stringify(MOCK_RESULT) };
    return { result: MOCK_RESULT, updatedHistory: [...history, newTurn, modelTurn] };
  }

  // Prepend system prompt as a synthetic user/model exchange (compatible with all API versions).
  const systemTurns = history.length === 0 ? [
    { role: 'user', parts: [{ text: `INSTRUCTIONS:\n${SYSTEM_PROMPT}\n\nConfirm you understand.` }] },
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
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
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
  const rawText: string = candidate?.content?.parts?.[0]?.text ?? '';

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
    { role: 'user', text: `INSTRUCTIONS:\n${SYSTEM_PROMPT}\n\nConfirm you understand.` },
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
export async function suggestBodyTargets(input: BodyTargetInput): Promise<BodyTargetSuggestion> {
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
- Pace 0.3-0.5 kg/week`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
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
  const raw: string = candidate?.content?.parts?.[0]?.text ?? '';

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

// ─── Mentor system prompt ─────────────────────────────────────────────────────

const MENTOR_PERSONAS: Record<MentorType, string> = {
  doctor:
    'You are a medical doctor AI. Prioritise health risk reduction, evidence-based guidelines, and patient safety. Be conservative and clinically precise.',
  nutritionist:
    'You are a certified nutritionist AI. Focus on food quality, macronutrient balance, micronutrients, and sustainable eating patterns.',
  coach:
    'You are a professional fitness coach AI. Focus on body composition, muscle preservation, progressive fat loss, and performance goals.',
};

const MENTOR_PRIORITY: MentorType[] = ['doctor', 'nutritionist', 'coach'];

export function buildMentorSystemPrompt(mentors: MentorType[]): string {
  const ordered = MENTOR_PRIORITY.filter((m) => mentors.includes(m));
  if (ordered.length === 1) return MENTOR_PERSONAS[ordered[0]];
  const parts = ordered.map((m) => MENTOR_PERSONAS[m]);
  const conjunction = ordered.length === 2
    ? `${parts[0]} ${parts[1]}`
    : parts.join(' ');
  return `You are a combined AI advisor with multiple roles. ${conjunction} When advice conflicts, prioritise: safety (Doctor) > food quality (Nutritionist) > performance (Coach).`;
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
): Promise<UserRulesSummary> {
  const systemPrompt = buildMentorSystemPrompt(mentors);

  const prompt = `${systemPrompt}

The user described their dietary and lifestyle preferences. Extract and structure into JSON only, no markdown:
{"summary":"Keto · IF 16:8","constraints":["< 50g carbs/day","eating window 12–8pm"],"aiContext":"Ketogenic diet with 16:8 intermittent fasting."}

Rules:
- summary: max 5 words, use · separator
- constraints: max 5 items, max 8 words each
- aiContext: max 20 words, used in future AI prompts

User text: "${rawText.replace(/"/g, "'")}"`; 

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
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
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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

export async function suggestDailyMacros(input: MacroSuggestionInput): Promise<MacroSuggestion> {
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
5. diet_label: Ketogenic/Vegan/High Protein/Mediterranean/Balanced/Custom`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
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
  const raw: string = candidate?.content?.parts?.[0]?.text ?? '';
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
