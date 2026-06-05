/**
 * Gemini 2.5 Flash — food photo analysis + conversational correction.
 * Calls the REST API directly (no Node SDK needed on-device).
 */

import { GEMINI_API_KEY } from '@env';
import type { MentorType, DailyMacroTarget, BodyTarget, UserRules, CoachMessage, CoachActionItem, AutoCheckType, ChatMessage, UserLanguage } from './TargetService';

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

const COACH_JSON_EXAMPLES: Record<string, string> = {
  en: '{"text":"2 sentences max. Specific numbers.","actionItems":[{"text":"Stay under 20g carbs today","autoCheckType":"carbs_under_target"},{"text":"Add 20g protein at dinner","autoCheckType":null},{"text":"Log next meal","autoCheckType":"meal_logged"}]}',
  he: '{"text":"אכלת 1039 מתוך 1950 קק״ל. נשארו 911 קק״ל ליום.","actionItems":[{"text":"להישאר מתחת ל-20g פחמימות","autoCheckType":"carbs_under_target"},{"text":"להוסיף 20g חלבון בארוחת ערב","autoCheckType":null},{"text":"לרשום את הארוחה הבאה","autoCheckType":"meal_logged"}]}',
};

function coachJsonExample(lang?: UserLanguage | null): string {
  return COACH_JSON_EXAMPLES[lang?.code ?? 'en'] ?? COACH_JSON_EXAMPLES.en;
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
  const labels =
    code === 'he'
      ? {
          carbs: carb != null ? `להישאר מתחת ל-${Math.round(carb)}g פחמימות` : 'לשמור על יעד הפחמימות',
          protein: protein != null ? `להגיע ל-${Math.round(protein)}g חלבון` : 'להגיע ליעד החלבון',
          meal: 'לרשום את הארוחה הבאה',
        }
      : {
          carbs: carb != null ? `Stay under ${Math.round(carb)}g carbs` : 'Stay within carb target',
          protein: protein != null ? `Hit ${Math.round(protein)}g protein` : 'Hit protein target',
          meal: 'Log your next meal',
        };
  return [
    { id: `fb-${ts}-0`, text: labels.carbs, done: false, autoCheckType: 'carbs_under_target' },
    { id: `fb-${ts}-1`, text: labels.protein, done: false, autoCheckType: 'protein_over_target' },
    { id: `fb-${ts}-2`, text: labels.meal, done: false, autoCheckType: 'meal_logged' },
  ];
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
  return parsed.length >= 2 ? parsed : buildFallbackActionItems(ctx);
}
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
  // targets
  macroTarget: DailyMacroTarget | null;
  bodyTarget: BodyTarget | null;
  userRules: UserRules | null;
};

function buildCoachDataBlock(ctx: CoachContext): string {
  const n = (v: number | null, unit = '') => v != null ? `${v}${unit}` : '—';
  const summaryLines = [
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

  return [...summaryLines, '', mealSection].join('\n');
}

/** Detect meal-review questions in any supported language. */
export function isMealReviewQuery(text: string): boolean {
  const t = text.toLowerCase();
  return /meal|ארוחה|comida|repas|mahlzeit|وجبة|приём|manger|essen|food log|last eat/i.test(t);
}

export async function generateCoachMessage(ctx: CoachContext): Promise<CoachMessage> {
  const systemPrompt = buildMentorSystemPrompt(ctx.mentors);
  const dataBlock = buildCoachDataBlock(ctx);

  const jsonExample = coachJsonExample(ctx.lang);

  const prompt = `${systemPrompt}

USER DATA:
${dataBlock}

Respond with JSON only (no markdown, no prose):
${jsonExample}

Rules:
- text: max 2 sentences, cite specific numbers from the data, no generic advice
- actionItems: 2–4 items, max 8 words each, concrete and actionable today — same language as text
- autoCheckType: use "carbs_under_target", "protein_over_target", "calorie_deficit", "meal_logged", or null (always English keys)
- If event is meal: focus on remaining macros for the day
- If event is weigh-in: focus on trend vs target, muscle vs start
- If event is workout: focus on calorie budget impact
- Do NOT repeat data the user already sees on the dashboard${coachJsonLangInstruction(ctx.lang)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
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
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
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
  const dataBlock = buildCoachDataBlock(ctx);
  const yesterdayLine = yesterdaySummary ? `\nYesterday: ${yesterdaySummary}` : '';

  const systemText = `${systemPrompt}${yesterdayLine}

CURRENT USER DATA:
${dataBlock}

You are responding in a free chat. Be concise, specific, and supportive.
The MEAL LOG section contains every food item logged today with grams and macros. When the user asks about their last meal or any meal, review that data directly — never say you lack meal details if MEAL LOG is present.
Ignore any earlier chat messages where you said meal details were unavailable; always use the current MEAL LOG block.${langInstruction(ctx.lang)}`;

  // Build history turns (max last 20 messages)
  const recentHistory = history.slice(-20);

  // For meal-review questions, repeat meal log in the user turn so the model cannot miss it
  let userMessage = message;
  if (isMealReviewQuery(message) && ctx.todayMealsDetail) {
    userMessage = `${message}\n\nUse this meal log (already in your context — cite specific foods and numbers):\n${ctx.todayMealsDetail}`;
  }

  const contents = [
    { role: 'user', parts: [{ text: `SYSTEM CONTEXT:\n${systemText}\n\nAcknowledge.` }] },
    { role: 'model', parts: [{ text: 'Understood. I have full meal log access and will use it.' }] },
    ...recentHistory.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const body = {
    contents,
    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
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
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!raw) throw new Error('Empty response from mentor chat');
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
    generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) return '';

  const json = await response.json();
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return raw.trim().slice(0, 200);
}
