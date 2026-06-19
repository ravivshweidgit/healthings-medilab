/**
 * Generate structured recipe plans for nutritionist chat (prompt40a).
 */

import { GEMINI_API_KEY } from '@env';
import { formatFoodLogHistoryForMealAi } from './foodLogMealHistory';
import { finalizeRecipePlan, type RecipeIngredient, type RecipePlan } from './mealPlanTypes';
import { formatUserRulesBlock } from './userRulesContext';
import type { MealSlashCommand } from './chatIntent';
import { getRecentMeals, foodLogDayKey, getDailyMacros } from '../services/FoodLogService';
import {
  getLanguage,
  getMacroTarget,
  getUserRules,
  type DailyMacroTarget,
  type UserLanguage,
} from '../services/TargetService';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export type RecipePlanMode = 'eat_now' | 'recipe';

export type GenerateRecipePlanOpts = {
  userMessage: string;
  hint?: string;
  mode: RecipePlanMode;
  command?: MealSlashCommand;
  lang?: UserLanguage | null;
  macroTarget?: DailyMacroTarget | null;
  todayEaten?: {
    kcal: number;
    protein_g: number;
    carb_g: number;
    fat_g: number;
    fiber_g: number;
  } | null;
};

function kitchenUnitsInstruction(lang?: UserLanguage | null): string {
  const label = lang?.label ?? 'English';
  const code = lang?.code ?? 'en';
  const sameLang = code === 'en';
  return `
USER DISPLAY LANGUAGE: ${label} (${code})

Per item (mandatory):
- "name": English canonical (nutrition lookup).
- "name_local": short label in ${label}.
- "amount_display": kitchen measure in ENGLISH — scoop/tsp/tbsp/cup/count/halves for powders, nuts, seeds, spices; grams only for meat/fish bulk portions. NEVER "14g" or "10g" alone for nuts or powders.
- "amount_display_local": REQUIRED — same measure in ${label}, natural kitchen wording for that locale.${sameLang ? ' May equal amount_display.' : ''}
- "grams": numeric weight always (for food log).

The app shows amount_display_local to the user. Do not put gram-only labels in amount_display_local when a kitchen unit exists.

Unit logic (independent of language):
- Whey / protein powder → scoop
- Spices, psyllium, cocoa → tsp or tbsp
- Nuts → count or halves (not gram-only)
- Small seeds → tsp or tbsp
- Liquids → cup or tbsp
- Chicken, salmon, etc. → grams in both display fields`;
}

function langInstruction(lang?: UserLanguage | null): string {
  return kitchenUnitsInstruction(lang);
}

function remainingMacrosBlock(
  target: DailyMacroTarget | null | undefined,
  eaten: GenerateRecipePlanOpts['todayEaten'],
): string {
  if (!target) return 'MACRO TARGET: not set — use reasonable portions.';
  const e = eaten ?? { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0 };
  const rem = {
    kcal: target.kcal - e.kcal,
    protein_g: target.protein_g - e.protein_g,
    carb_g: target.carb_g - e.carb_g,
    fat_g: target.fat_g - e.fat_g,
    fiber_g: (target.fiber_g ?? 0) - e.fiber_g,
  };
  return `DAILY MACRO TARGET: ${target.kcal} kcal · P${target.protein_g} · C${target.carb_g} · F${target.fat_g} · Fi${target.fiber_g ?? 0}
EATEN TODAY: ${Math.round(e.kcal)} kcal · P${Math.round(e.protein_g)} · C${Math.round(e.carb_g)} · F${Math.round(e.fat_g)}
REMAINING TODAY: ${Math.round(rem.kcal)} kcal · P${Math.round(rem.protein_g)} · C${Math.round(rem.carb_g)} · F${Math.round(rem.fat_g)}`;
}

function buildRecipePrompt(
  opts: GenerateRecipePlanOpts,
  userRules: Awaited<ReturnType<typeof getUserRules>>,
  foodLogHistory: string | null,
): string {
  const hint = opts.hint?.trim() || opts.userMessage.trim();
  const modeLine =
    opts.mode === 'eat_now'
      ? 'MODE: eat_now — suggest ONE meal/snack appropriate for RIGHT NOW; scale portions to fit REMAINING macros when possible.'
      : 'MODE: recipe — give a faithful recipe; do not force-fit remaining kcal unless user asked.';

  const rulesBlock = userRules ? formatUserRulesBlock(userRules) : 'My Rules: (none)';

  return `You are a clinical nutritionist AI. Output ONLY valid JSON — no markdown outside JSON.

${modeLine}
USER REQUEST: ${hint}
${remainingMacrosBlock(opts.macroTarget, opts.todayEaten)}

${rulesBlock}

${foodLogHistory ? `${foodLogHistory}\n\nWhen the user references a past meal: COPY items from FOOD LOG HISTORY — same foods and macros unless they specify a change. Set source_note to the matched date/time. Re-derive kitchen units in amount_display / amount_display_local; do not copy gram-only labels.` : ''}

${kitchenUnitsInstruction(opts.lang)}

OUTPUT JSON (exact keys):
{"title":"...","title_local":"...","servings":1,"items":[{"name":"whey protein","name_local":"...","amount_display":"1 scoop","amount_display_local":"...","grams":30,"kcal":120,"protein_g":24,"carb_g":3,"fat_g":1,"fiber_g":0}],"steps":["..."],"total_kcal":0,"total_protein_g":0,"total_carb_g":0,"total_fat_g":0,"total_fiber_g":0,"confidence":"high","source_note":""}

RULES:
- items[] required; at least 1 item.
- Every item MUST have amount_display AND amount_display_local with kitchen units (not gram-only) for powders, nuts, seeds, spices.
- Sum totals from items (round total_kcal integer).
- steps optional (max 4 short lines).
- confidence: high | medium | low.
- source_note: empty string if not from history.
- title_local in ${opts.lang?.label ?? 'English'}.`;
}

function parseRecipeJson(raw: string): RecipePlan {
  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Recipe JSON not found');
  const parsed = JSON.parse(stripped.slice(start, end + 1)) as Partial<RecipePlan> & {
    items?: RecipeIngredient[];
  };
  if (!parsed.items?.length) throw new Error('Recipe has no items');
  return finalizeRecipePlan({
    ...parsed,
    items: parsed.items,
  });
}

async function fetchRecipeJson(prompt: string): Promise<string> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
    },
  };
  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Recipe API ${response.status}: ${err.slice(0, 200)}`);
  }
  const json = await response.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p: { text?: string }) => typeof p.text === 'string')
    .map((p: { text: string }) => p.text.trim())
    .join('\n')
    .trim();
  if (!text) throw new Error('Empty recipe response');
  return text;
}

export async function loadTodayEatenTotals(): Promise<GenerateRecipePlanOpts['todayEaten']> {
  const day = await getDailyMacros(foodLogDayKey(Date.now()));
  if (day.entries.length === 0) return null;
  return {
    kcal: day.totalKcal,
    protein_g: day.totalProtein_g,
    carb_g: day.totalCarb_g,
    fat_g: day.totalFat_g,
    fiber_g: day.totalFiber_g,
  };
}

export async function generateRecipePlan(opts: GenerateRecipePlanOpts): Promise<RecipePlan> {
  const [userRules, macroTarget, meals, lang] = await Promise.all([
    getUserRules(),
    opts.macroTarget !== undefined ? Promise.resolve(opts.macroTarget) : getMacroTarget(),
    getRecentMeals(14),
    opts.lang !== undefined ? Promise.resolve(opts.lang) : getLanguage(),
  ]);
  const todayEaten =
    opts.todayEaten !== undefined ? opts.todayEaten : await loadTodayEatenTotals();
  const foodLogHistory = formatFoodLogHistoryForMealAi(meals, { lookbackDays: 14 });
  const prompt = buildRecipePrompt(
    { ...opts, lang, macroTarget, todayEaten },
    userRules,
    foodLogHistory,
  );
  const raw = await fetchRecipeJson(prompt);
  return parseRecipeJson(raw);
}
