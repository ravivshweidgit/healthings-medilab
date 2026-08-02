import { buildAppHelpKnowledgeBlock } from '../help/AppHelpKnowledge';
import { GEMINI_API_KEY } from '@env';
import { geminiUsageFromResponse, reportAiUsage, type GeminiUsageReport } from './UsageApiService';
import { assertCanSpendCredits, OutOfCreditsError } from './UsageQueueService';

export { OutOfCreditsError };
import {
  combineMentorLines,
  extractMentorLinesFromParsed,
  hasSeparateMentorVoices,
  normalizeMentorChatText,
  resolveMentorReplyText,
  type MentorLines,
} from '../logic/mentorChatText';
import {
  CHAT_HISTORY_MAX_MESSAGES,
  type MentorType,
  type DailyMacroTarget,
  type BodyTarget,
  type UserRules,
  type CoachMessage,
  type CoachActionItem,
  type AutoCheckType,
  type ChatMessage,
  type UserLanguage,
  type Gender,
} from './TargetService';
import type { ParsedLabPdf, LabPanelType, LabResult, LabResultFlag } from './LabLogService';
import type { TimePoint } from './HealthConnectService';
import type { UnitsPrefs } from './UnitsPreferenceService';
import {
  buildPeriodReviewBlock,
  detectPeriodReviewQuery,
  PERIOD_REVIEW_CHAT_INSTRUCTION,
  type PeriodReviewRequest,
} from './ReviewService';
import { detectChatIntent, isGlucoseDeepDiveQuery, isGlucoseQuery, type ChatIntent } from '../logic/chatIntent';
import { resolveMentorGender } from '../logic/mentorLabels';
import { formatUserRulesLines, formatUserRulesBlock, formatMacroRevisionRulesBlock, MEAL_FAT_RULE_FLAGGING_GUIDANCE } from '../logic/userRulesContext';
import { formatDirectiveAndRulesForChecks } from '../logic/nutritionDirectiveContext';

/**
 * Unit symbols stay English in every language (language-policy glossary).
 * Prevents Hebrew unit leak into EN replies when JSON-safety examples taught קק"ל / מ"ג/ד"ל.
 */
function unitsGlossaryInstruction(): string {
  return (
    '\nUNITS / GLOSSARY (mandatory, every language): Write unit symbols in English only — ' +
    'kcal, kJ, mg/dL, mmol/L, g, kg, lb, cm, ml, floz. Never localize units ' +
    '(no קק"ל / קק\'ל, מ"ג/ד"ל / מ\'ג/ד\'ל, ק"ג / ק\'ג, etc.). ' +
    'Brand and acronyms stay English too (CGM, BMR, AI, Withings).'
  );
}

/** Returns a language instruction line to append to any AI prompt. */
function langInstruction(lang?: UserLanguage | null): string {
  const units = unitsGlossaryInstruction();
  if (!lang || lang.code === 'en') {
    return `\nRespond entirely in English. All prose in the response must be English.${units}`;
  }
  return (
    `\nRespond entirely in ${lang.label} (${lang.code}). All prose in the response must be in ${lang.label}.` +
    ` Keep unit symbols English (see UNITS / GLOSSARY).${units}`
  );
}

/**
 * PART F — gender awareness for chat. Two axes: user sex (clinical + address) and the
 * mentor's own voice (self-reference in gendered languages). Grammatical-gender block only
 * for Hebrew/Arabic; other languages get a one-line clinical note.
 */
function genderInstruction(ctx: CoachContext): string {
  const userSex = ctx.gender ?? 'unknown';
  const voice = resolveMentorGender(ctx.mentorGender, ctx.gender as Gender | null);
  const code = ctx.lang?.code;
  const facts = `\nGENDER — USER SEX: ${userSex} | MENTOR VOICE (your own gender): ${voice}.`;
  if (code === 'he' || code === 'ar') {
    const addressForms =
      userSex === 'male'
        ? 'MASCULINE only: אתה, שים לב, היית, צרכת, זכור, המשך, שלך (זכר). Never use feminine forms (את, שימי, היית feminine, זכרי).'
        : userSex === 'female'
          ? 'FEMININE only: את, שימי לב, היית, צרכת, זכרי, המשיכי, שלך (נקבה). Never use masculine forms (אתה, שים, זכור, המשך).'
          : 'USER SEX is unknown — prefer neutral phrasing and avoid gendered verbs where possible.';
    return `${facts}
- USER ADDRESS (mandatory, every sentence): ${addressForms}
- Pick the one set matching USER SEX and use it for EVERY verb and pronoun directed at the user. Never mix masculine and feminine in the same reply.
- When you refer to yourself, use your MENTOR VOICE gender (female: אני ממליצה, שמחה לעזור | male: אני ממליץ, שמח לעזור) — this is independent of USER SEX.
- Use USER SEX for clinical/nutrition interpretation (healthy fat% range, BMR, glucose context).`;
  }
  const gendered =
    code === 'es' ||
    code === 'fr' ||
    code === 'ru' ||
    code === 'de' ||
    code === 'pt' ||
    code === 'it' ||
    code === 'tr';
  if (gendered) {
    return `${facts}
- If your reply language uses grammatical gender, address the user matching USER SEX and refer to yourself matching MENTOR VOICE — consistently within the thread.
- Use USER SEX for clinical/nutrition interpretation (healthy fat% range, BMR, glucose context).`;
  }
  return `${facts}
- Use USER SEX for clinical/nutrition interpretation (healthy fat% range, BMR, glucose context).`;
}

/** Stronger instruction for JSON coach responses — action item text often copied from English examples. */
function coachJsonLangInstruction(lang?: UserLanguage | null): string {
  if (!lang || lang.code === 'en') return unitsGlossaryInstruction();
  return (
    `\nLANGUAGE (mandatory): Write "summary", every wins[]/improve[] bullet, AND every actionItems[].text in ${lang.label} (${lang.code}) only. ` +
    `Keep mentor tags and autoCheckType values exactly as English keys (nutritionist/coach/doctor, carbs_under_target, etc.). ` +
    `Do NOT use English for user-visible prose — but unit symbols stay English (kcal, mg/dL, kg, g).` +
    unitsGlossaryInstruction()
  );
}

/** Mandatory language for meal JSON — name_local is the display name shown in the app. */
function foodJsonLangInstruction(lang?: UserLanguage | null): string {
  if (!lang || lang.code === 'en') return '';
  return `\nLANGUAGE (mandatory): Write "description", "suggestion", and "rule_message" in ${lang.label} (${lang.code}).
For each item: "name" = canonical ENGLISH name (for nutrition lookup); "name_local" = the SAME food written in ${lang.label} (${lang.code}) — REQUIRED, this is the name shown to the user in the app. Never leave "name_local" in English when the app language is not English. Keep "name_local" SHORT for on-screen lists (~25–35 characters when possible): drop filler words (e.g. "בטעם"), abbreviate flavor, but keep protein source if it matters (whey vs casein). Put longer detail in "description", not name_local. Keep numbers (grams, kcal, macros) unchanged.`;
}

export function buildFoodSystemPrompt(
  lang?: UserLanguage | null,
  userRules?: UserRules | null,
  foodLogHistory?: string | null,
): string {
  const langNote = foodJsonLangInstruction(lang);
  let prompt = langNote ? `${SYSTEM_PROMPT}${langNote}` : SYSTEM_PROMPT;
  if (userRules) {
    prompt += `\n\nUSER DIETARY RULES (same as Nutritionist mentor — apply on every analysis):\n${formatMacroRevisionRulesBlock(userRules)}`;
    prompt += `\n\n${MEAL_FAT_RULE_FLAGGING_GUIDANCE}`;
  }
  if (foodLogHistory?.trim()) {
    prompt += `\n\n${foodLogHistory.trim()}`;
    prompt += `\n\nFOOD HISTORY RULES:
- When the user references a past meal ("last evening", "yesterday", "usual", "same as", "my regular shake", "הוסף את השייק מאתמול", "אותה ארוחת עוף"): copy items from FOOD LOG HISTORY — same name, name_local, grams, kcal, and macros unless they specify a change.
- Prefer the closest match by time + food names; use FREQUENT MEALS for "usual" / "regular".
- In "description", cite which history meal you matched (date/time or frequent label).
- If no match: best estimate from text; confidence "low".
- If the user is correcting the CURRENT meal in the conversation (change grams, add/remove an item like "הוסף כף קינמון", "chicken 100→200"): use the conversation JSON, not FOOD LOG HISTORY.`;
  }
  return prompt;
}

function defaultFoodAnalysisPrompt(
  lang?: UserLanguage | null,
  opts?: { beforeAfter?: boolean },
): string {
  const jsonReminder = ' Respond ONLY with the JSON format specified in your instructions. No markdown, no prose.';
  if (opts?.beforeAfter) {
    if (lang?.code === 'he') {
      return `התמונה הראשונה — צלחת לפני הארוחה. השנייה — מה שנשאר. העריך/י רק מה שנאכל בפועל (ההפרש).${jsonReminder}`;
    }
    if (lang?.code === 'ar') {
      return `الصورة الأولى قبل الوجبة والثانية بعدها. قدّر ما تم أكله فقط (الفرق).${jsonReminder}`;
    }
    return 'The FIRST image is the full plate before eating. The SECOND image is what was left after eating. Estimate only what was actually consumed (the difference). Give me the macros for what was eaten.' + jsonReminder;
  }
  if (lang?.code === 'he') {
    return `מה יש בארוחה? החזר/י מקרו ב-JSON.${jsonReminder}`;
  }
  if (lang?.code === 'ar') {
    return `ما الطعام في هذه الوجبة؟ أعد الماكروز بصيغة JSON.${jsonReminder}`;
  }
  return 'What food is in this photo? Give me the macros.' + jsonReminder;
}

function coachJsonExample(ctx: CoachContext): string {
  const carb = Math.round(ctx.macroTarget?.carb_g ?? 35);
  const protein = Math.round(ctx.macroTarget?.protein_g ?? 140);
  const code = ctx.lang?.code ?? 'en';
  const he = code === 'he';
  const active = MENTOR_PRIORITY.filter((m) => ctx.mentors.includes(m));

  const summary = he
    ? 'משפט-שניים שמסכמים את היום עם מספרים.'
    : 'One or two sentences summarizing the day with numbers.';

  const winsBy: Record<MentorType, string> = {
    nutritionist: he ? 'גלוקוז ממוצע 92 — בטווח' : 'Glucose avg 92 — in range',
    coach: he ? 'נרשמה הליכה 45 דק׳' : 'Walk logged 45 min',
    doctor: he ? 'אין ערכים מתחת ל-70 היום' : 'No lows below 70 today',
  };
  const improveBy: Record<MentorType, string> = {
    nutritionist: he ? `חלבון 68g מול יעד ${protein}g` : `Protein 68g vs ${protein}g target`,
    coach: he ? 'אין אימון כוח השבוע' : 'No strength session this week',
    doctor: he ? 'לעקוב אחרי ערכים נמוכים' : 'Watch for low readings',
  };
  const actionBy: Record<MentorType, string> = {
    nutritionist: he
      ? `{"text":"להגיע ל-${protein}g חלבון","mentor":"nutritionist","autoCheckType":"protein_over_target"}`
      : `{"text":"Hit ${protein}g protein","mentor":"nutritionist","autoCheckType":"protein_over_target"}`,
    coach: he
      ? '{"text":"הליכה 20 דק׳ אחרי הארוחה","mentor":"coach","autoCheckType":null}'
      : '{"text":"20-min walk after dinner","mentor":"coach","autoCheckType":null}',
    doctor: he
      ? '{"text":"לבדוק סוכר שעתיים אחרי ארוחה","mentor":"doctor","autoCheckType":null}'
      : '{"text":"Recheck glucose 2h post-meal","mentor":"doctor","autoCheckType":null}',
  };

  const winsObj: Record<string, string[]> = {};
  const improveObj: Record<string, string[]> = {};
  const actionParts: string[] = [];
  for (const m of active) {
    winsObj[m] = [winsBy[m]];
    improveObj[m] = [improveBy[m]];
    actionParts.push(actionBy[m]);
  }
  // Show the nutritionist a second auto-checkable item so carbs_under_target appears.
  if (ctx.mentors.includes('nutritionist')) {
    actionParts.push(
      he
        ? `{"text":"להישאר מתחת ל-${carb}g פחמימות","mentor":"nutritionist","autoCheckType":"carbs_under_target"}`
        : `{"text":"Stay under ${carb}g carbs","mentor":"nutritionist","autoCheckType":"carbs_under_target"}`,
    );
  }
  if (actionParts.length === 0) actionParts.push(actionBy.coach);

  return `{"summary":"${summary}","wins":${JSON.stringify(winsObj)},"improve":${JSON.stringify(improveObj)},"actionItems":[${actionParts.join(',')}]}`;
}

function buildCoachActionItem(ctx: CoachContext): CoachActionItem {
  const code = ctx.lang?.code ?? 'en';
  const he = code === 'he';
  const hour = new Date().getHours();
  const earlyMorning = hour < 6;
  const muscle = ctx.muscleMass_kg;
  const targetMuscle = ctx.bodyTarget?.targetMuscleMass_kg;
  const targetWeight = ctx.bodyTarget?.targetWeight_kg;

  let text: string;
  if (earlyMorning) {
    text = he ? 'לתכנן תנועה/אימון להיום' : 'Plan movement or training today';
  } else if (muscle != null && targetMuscle != null) {
    text = he
      ? `לשמור על השריר (${Math.round(muscle)}→${Math.round(targetMuscle)}kg)`
      : `Protect muscle (${Math.round(muscle)}→${Math.round(targetMuscle)}kg)`;
  } else if (targetWeight != null) {
    text = he ? `להתקדם ליעד ${Math.round(targetWeight)}kg` : `Progress toward ${Math.round(targetWeight)}kg`;
  } else {
    text = he ? 'הליכה קצרה או מתיחות' : 'Short walk or stretch';
  }
  return { id: `coach-${Date.now()}`, text, done: false, autoCheckType: null, mentor: 'coach' };
}

/** Doctor safety fallback (prompt25) — injected when Doctor active but model gave no doctor item. */
function buildDoctorActionItem(ctx: CoachContext): CoachActionItem {
  const he = ctx.lang?.code === 'he';
  const text = he ? 'לבדוק סוכר שעתיים אחרי ארוחה' : 'Recheck glucose 2h post-meal';
  return { id: `doctor-${Date.now()}`, text, done: false, autoCheckType: null, mentor: 'doctor' };
}

/** prompt25 — guarantee each ACTIVE mentor has at least one action item. */
function ensureMentorActionItems(items: CoachActionItem[], ctx: CoachContext): CoachActionItem[] {
  const out = [...items];
  for (const m of MENTOR_PRIORITY.filter((x) => ctx.mentors.includes(x))) {
    if (out.some((i) => i.mentor === m)) continue;
    if (m === 'coach') out.push(buildCoachActionItem(ctx));
    else if (m === 'doctor') out.push(buildDoctorActionItem(ctx));
    else if (m === 'nutritionist') out.push(...buildNutritionistActionItems(ctx));
  }
  return out;
}

/** prompt25 — cap action items at `perMentor` per mentor; untagged items pass through. */
function capPerMentor(
  items: CoachActionItem[],
  mentors: MentorType[],
  perMentor: number,
): CoachActionItem[] {
  const counts: Partial<Record<MentorType, number>> = {};
  const out: CoachActionItem[] = [];
  for (const item of items) {
    const m = item.mentor;
    if (!m || !mentors.includes(m)) {
      out.push(item);
      continue;
    }
    const n = (counts[m] ?? 0) + 1;
    counts[m] = n;
    if (n <= perMentor) out.push(item);
  }
  return out;
}

/** Nutritionist fallbacks (carbs + protein), tagged for the nutritionist. */
function buildNutritionistActionItems(ctx: CoachContext): CoachActionItem[] {
  const code = ctx.lang?.code ?? 'en';
  const he = code === 'he';
  const carb = ctx.macroTarget?.carb_g;
  const protein = ctx.macroTarget?.protein_g;
  const ts = Date.now();
  const items: CoachActionItem[] = [];
  items.push({
    id: `nut-${ts}-c`,
    text: he
      ? carb != null ? `להישאר מתחת ל-${Math.round(carb)}g פחמימות` : 'לשמור על יעד הפחמימות'
      : carb != null ? `Stay under ${Math.round(carb)}g carbs` : 'Stay within carb target',
    done: false,
    autoCheckType: 'carbs_under_target',
    mentor: 'nutritionist',
  });
  items.push({
    id: `nut-${ts}-p`,
    text: he
      ? protein != null ? `להגיע ל-${Math.round(protein)}g חלבון` : 'להגיע ליעד החלבון'
      : protein != null ? `Hit ${Math.round(protein)}g protein` : 'Hit protein target',
    done: false,
    autoCheckType: 'protein_over_target',
    mentor: 'nutritionist',
  });
  return items;
}

/** Map a raw mentor string from the model to an active MentorType, else undefined. */
function resolveActionItemMentor(raw: unknown, ctx: CoachContext): MentorType | undefined {
  if (typeof raw !== 'string') return undefined;
  const k = raw.toLowerCase().replace(/[^a-z]/g, '');
  const m = k === 'doctor' || k === 'nutritionist' || k === 'coach' ? (k as MentorType) : undefined;
  return m && ctx.mentors.includes(m) ? m : undefined;
}

/** Mentor from AI tag or autoCheckType only — no keyword scan of item text. */
function inferActionItemMentor(item: CoachActionItem, ctx: CoachContext): MentorType | undefined {
  if (item.autoCheckType != null && ctx.mentors.includes('nutritionist')) return 'nutritionist';
  return undefined;
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
    // Unit symbol stays English (kcal) in every language — glossary.
    return code === 'he' ? `לצרוך לפחות ${k} kcal` : `Eat at least ${k} kcal`;
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
    items.push({ id: `fb-${ts}-0`, text: labels.carbs, done: false, autoCheckType: 'carbs_under_target', mentor: 'nutritionist' });
    items.push({ id: `fb-${ts}-1`, text: labels.protein, done: false, autoCheckType: 'protein_over_target', mentor: 'nutritionist' });
  }
  if (hasCoach) {
    items.push({ id: `fb-${ts}-c`, text: labels.coach, done: false, autoCheckType: null, mentor: 'coach' });
  }
  if (ctx.mentors.includes('doctor')) {
    items.push(buildDoctorActionItem(ctx));
  }
  if (items.length === 0) {
    items.push({ id: `fb-${ts}-0`, text: labels.meal, done: false, autoCheckType: 'meal_logged', mentor: 'nutritionist' });
  }
  return items;
}

/** Last resort: split a blended reply into per-mentor lines via a short JSON call. */
async function splitBlendedMentorReply(
  blendedText: string,
  ctx: CoachContext,
): Promise<MentorLines | null> {
  if (ctx.mentors.length < 2 || !blendedText.trim()) return null;

  const keys = MENTOR_PRIORITY.filter((m) => ctx.mentors.includes(m));
  const keyExample = keys.map((k) => `"${k}":"one sentence"`).join(',');
  const prompt = `Split this health coaching message into separate mentor voices. Return JSON only:
{"mentorLines":{${keyExample}}}
Active mentors: ${keys.join(', ')}. One sentence per key. No emoji in values. Same language as original.

Original:
${blendedText.slice(0, 1200)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0.1, maxOutputTokens: 1024 }),
  };

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const raw: string = extractGeminiText(json?.candidates?.[0]);
    const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
    const lines = extractMentorLinesFromParsed(parsed, ctx.mentors);
    if (!lines) return null;
    const count = ctx.mentors.filter((m) => lines[m]?.trim()).length;
    return count >= 2 ? lines : null;
  } catch {
    return null;
  }
}

async function resolveCoachReplyText(
  parsed: Record<string, unknown>,
  ctx: CoachContext,
): Promise<{ text: string; mentorLines?: MentorLines }> {
  let mentorLines = extractMentorLinesFromParsed(parsed, ctx.mentors);
  const textField = typeof parsed.text === 'string' ? parsed.text : undefined;
  let text = mentorLines
    ? combineMentorLines(mentorLines, ctx.mentors) || resolveMentorReplyText(undefined, textField, ctx.mentors)
    : resolveMentorReplyText(undefined, textField, ctx.mentors);

  if (ctx.mentors.length >= 2 && !hasSeparateMentorVoices(text, mentorLines ?? undefined, ctx.mentors)) {
    const split = await splitBlendedMentorReply(text, ctx);
    if (split) {
      mentorLines = split;
      text = combineMentorLines(split, ctx.mentors);
    }
  }

  const lineCount = mentorLines ? ctx.mentors.filter((m) => mentorLines![m]?.trim()).length : 0;
  return {
    text,
    mentorLines: lineCount >= 2 ? (mentorLines ?? undefined) : undefined,
  };
}

function normalizeCoachActionItems(
  raw: Array<{ text: string; autoCheckType: string | null; mentor?: string }> | undefined,
  ctx: CoachContext,
): CoachActionItem[] {
  const parsed: CoachActionItem[] = (raw ?? [])
    .filter((item) => isValidActionItemText(String(item.text ?? '')))
    .map((item, i) => {
      const autoCheckType: AutoCheckType = ['carbs_under_target', 'protein_over_target', 'calorie_deficit', 'meal_logged'].includes(item.autoCheckType ?? '')
        ? (item.autoCheckType as AutoCheckType)
        : null;
      const base: CoachActionItem = {
        id: `ai-${Date.now()}-${i}`,
        text: String(item.text).trim(),
        done: false,
        autoCheckType,
      };
      base.mentor = resolveActionItemMentor(item.mentor, ctx) ?? inferActionItemMentor(base, ctx);
      return base;
    });
  const items = parsed.length >= 1 ? parsed : buildFallbackActionItems(ctx);
  const aligned = items.map((item) => alignActionItemToMacroTarget(item, ctx));
  const ensured = ensureMentorActionItems(aligned, ctx);
  return capPerMentor(ensured, ctx.mentors, 2);
}

/** prompt25 — parse per-mentor wins/improve bullet maps; keep active mentors only, ≤3 each. */
function parseMentorBulletMap(
  raw: unknown,
  ctx: CoachContext,
): Partial<Record<MentorType, string[]>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<MentorType, string[]>> = {};
  for (const m of MENTOR_PRIORITY.filter((x) => ctx.mentors.includes(x))) {
    const list = (raw as Record<string, unknown>)[m];
    if (!Array.isArray(list)) continue;
    const bullets = list
      .map((b) => String(b ?? '').trim())
      .filter((b) => isValidActionItemText(b))
      .slice(0, 3);
    if (bullets.length > 0) out[m] = bullets;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

type GeminiPart = { text?: string; thought?: boolean };

type GeminiGenOptions = {
  temperature: number;
  maxOutputTokens: number;
  /** 0 = off; -1 = dynamic. Default 0 (JSON/vision). Chat uses -1. */
  thinkingBudget?: number;
  /** Force a structured JSON response (e.g. 'application/json'). */
  responseMimeType?: string;
  /** Optional response schema enforced by the API when responseMimeType is JSON. */
  responseSchema?: object;
};

/** v1beta — thinkingConfig keeps reasoning out of the user-visible response. */
function geminiGenerationConfig(config: GeminiGenOptions) {
  const thinkingBudget = config.thinkingBudget ?? 0;
  const out: Record<string, unknown> = {
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    thinkingConfig: {
      thinkingBudget,
      includeThoughts: false,
    },
  };
  if (config.responseMimeType) out.responseMimeType = config.responseMimeType;
  if (config.responseSchema) out.responseSchema = config.responseSchema;
  return out;
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
  fiber_g: number;
  /** True when this item violates the user's My Rules (set by Gemini). */
  rule_conflict?: boolean;
  /** Short reason when rule_conflict is true. */
  rule_message?: string;
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
{"items":[{"name":"...","name_local":"...","grams":0,"kcal":0,"protein_g":0.0,"carb_g":0.0,"fat_g":0.0,"fiber_g":0.0,"rule_conflict":false,"rule_message":""}],"confidence":"high","description":"...","suggestion":"..."}

RULES:
- "name" = canonical English food name; "name_local" = short display label in the user's app language (compact ~25–35 chars when possible; full detail goes in "description").
- Estimate grams from plate size (standard plate = 26cm).
- Split dishes into ingredients. Use USDA values.
- "fiber_g" = dietary fiber only (not total carbs); estimate per ingredient.
- For corrections: return full updated JSON, keep all items; keep both name fields in the correct languages.
- If unsure: best guess with confidence "low".
- When USER DIETARY RULES are provided: evaluate EACH item line — set rule_conflict true only if THAT item violates rules (not because the meal lacks something). Read name_local carefully (e.g. plant protein מהצומח vs whey מי גבינה). rule_message = one short sentence why. Otherwise rule_conflict false and rule_message "".`;

/** History seed when editing a saved meal — includes language-aware system prompt. */
export function seedMealEditHistory(entry: { items: FoodItem[] }, lang?: UserLanguage | null): GeminiTurn[] {
  const systemPrompt = buildFoodSystemPrompt(lang);
  const seedJson = JSON.stringify({
    items: entry.items,
    confidence: 'high',
    description: lang?.code === 'he' ? 'ארוחה שמורה.' : lang?.code === 'ar' ? 'وجبة محفوظة.' : 'Previously saved meal.',
  });
  const readyLine =
    lang?.code === 'he'
      ? '{"items":[],"confidence":"high","description":"מוכן לניתוח ארוחות."}'
      : lang?.code === 'ar'
        ? '{"items":[],"confidence":"high","description":"جاهز لتحليل الوجبات."}'
        : '{"items":[],"confidence":"high","description":"Ready to analyze food."}';
  const editIntro =
    lang?.code === 'he'
      ? 'זו הארוחה השמורה שלי. אולי ארצה לתקן אותה.'
      : lang?.code === 'ar'
        ? 'هذه وجبتي المحفوظة. قد أريد تصحيحها.'
        : 'Here is the current meal I already saved. I may want to correct it.';
  return [
    { role: 'user', text: `INSTRUCTIONS:\n${systemPrompt}\n\nConfirm you understand.` },
    { role: 'model', text: readyLine },
    { role: 'user', text: editIntro },
    { role: 'model', text: seedJson },
  ];
}

// ─── Mock data ───────────────────────────────────────────────────────────────

const MOCK_RESULT: GeminiAnalysisResult = {
  items: [
    { name: 'Shakshuka', name_local: 'שקשוקה', grams: 300, kcal: 280, protein_g: 18.0, carb_g: 14.0, fat_g: 16.0, fiber_g: 4.0 },
    { name: 'Pita bread', name_local: 'פיתה', grams: 80, kcal: 216, protein_g: 7.2, carb_g: 43.5, fat_g: 1.8, fiber_g: 2.5 },
  ],
  confidence: 'high',
  description: 'Two eggs in tomato sauce with a side pita, standard restaurant portion.',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeTotals(items: FoodItem[]): { totalKcal: number; totalProtein_g: number; totalCarb_g: number; totalFat_g: number; totalFiber_g: number } {
  return items.reduce(
    (acc, item) => ({
      totalKcal: acc.totalKcal + item.kcal,
      totalProtein_g: acc.totalProtein_g + item.protein_g,
      totalCarb_g: acc.totalCarb_g + item.carb_g,
      totalFat_g: acc.totalFat_g + item.fat_g,
      totalFiber_g: acc.totalFiber_g + (item.fiber_g ?? 0),
    }),
    { totalKcal: 0, totalProtein_g: 0, totalCarb_g: 0, totalFat_g: 0, totalFiber_g: 0 }
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
      fiber_g: Math.round(Number(it.fiber_g ?? 0) * 10) / 10,
      rule_conflict: Boolean(it.rule_conflict),
      rule_message: it.rule_message ? String(it.rule_message) : undefined,
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
      items: [{ name: 'Unknown food', grams: 0, kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0 }],
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
  userRules?: UserRules | null,
  foodLogHistory?: string | null,
): Promise<{ result: GeminiAnalysisResult; updatedHistory: GeminiTurn[] }> {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 800));
    const newTurn: GeminiTurn = { role: 'user', text: userText, imageBase64: imageBase64 ?? undefined };
    const modelTurn: GeminiTurn = { role: 'model', text: JSON.stringify(MOCK_RESULT) };
    return { result: MOCK_RESULT, updatedHistory: [...history, newTurn, modelTurn] };
  }

  await assertCanSpendCredits('ai_meal');

  const systemPromptWithLang = buildFoodSystemPrompt(lang, userRules, foodLogHistory);

  // Prepend system prompt as a synthetic user/model exchange (compatible with all API versions).
  const readyLine =
    lang?.code === 'he'
      ? '{"items":[],"confidence":"high","description":"מוכן לניתוח ארוחות."}'
      : lang?.code === 'ar'
        ? '{"items":[],"confidence":"high","description":"جاهز لتحليل الوجبات."}'
        : '{"items":[],"confidence":"high","description":"Ready to analyze food."}';
  const systemTurns = history.length === 0 ? [
    { role: 'user', parts: [{ text: `INSTRUCTIONS:\n${systemPromptWithLang}\n\nConfirm you understand.` }] },
    { role: 'model', parts: [{ text: readyLine }] },
  ] : [];

  const JSON_REMINDER = lang?.code === 'he'
    ? ' החזר/י JSON בלבד לפי ההוראות.'
    : lang?.code === 'ar'
      ? ' JSON فقط حسب التعليمات.'
      : ' Respond ONLY with the JSON format specified in your instructions. No markdown, no prose.';
  const langTail = foodJsonLangInstruction(lang);
  const rulesTail = userRules && history.length > 0
    ? `\n\nApply USER DIETARY RULES above; set rule_conflict and rule_message on violating items in JSON.`
    : '';
  const effectiveText = (() => {
    let base: string;
    if (afterImageBase64) {
      base = userText || defaultFoodAnalysisPrompt(lang, { beforeAfter: true });
    } else {
      base = userText || defaultFoodAnalysisPrompt(lang);
    }
    if (!userText && !afterImageBase64 && !imageBase64) {
      return base;
    }
    if (userText && !base.includes('JSON')) {
      return base + JSON_REMINDER;
    }
    return base;
  })();
  const userTextWithLang = (() => {
    let text = langTail && history.length > 0 ? `${effectiveText}${langTail}` : effectiveText;
    if (rulesTail) text += rulesTail;
    return text;
  })();

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
        { text: userTextWithLang },
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
  reportAiUsage('ai_meal', undefined, geminiUsageFromResponse(json, GEMINI_MODEL));

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
    'You are a medical doctor AI. Prioritise health risk reduction, evidence-based guidelines, and patient safety. When CGM data is present, give qualitative safety assessment by default; cite avg/min/max only when user asks for numbers or pattern is clinically urgent — exclude sensor warm-up false lows.',
  nutritionist:
    'You are a certified clinical nutritionist AI with CGM expertise. Continuous glucose is a PRIMARY input — always consider it when advising on food and meal timing. DEFAULT reply: one short qualitative glucose verdict (stable / in range / a bit high / on the low side / worth watching) — NO mg/dL unless the user asks for numbers or deep analysis. FIBER ↔ CARB: fiber is inside total carbs on labels — fiber_g must never exceed carb_g; default target ≈ 55%×carb_g (e.g. 66g C → ~36g Fi); My Rules gram floors override.',
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
Doctor: safety, clinical risk, conservative limits; CGM qualitatively unless user asks for numbers.
Nutritionist: food quality, macros, meal structure, glycemic impact — qualitative CGM by default.
Use mentorLines with separate "doctor" and "nutritionist" keys — one sentence each. NEVER one blended paragraph.`,

  'doctor+coach': `You advise as Doctor 🩺 AND Coach 💪 — both active; both must inform every reply.
Doctor: health risk, safe rate of loss, red flags, recovery; CGM when present.
Coach: body composition, muscle preservation, training, performance, deficit strategy.
Use mentorLines with separate "doctor" and "coach" keys — one sentence each with numbers. NEVER one blended paragraph.`,

  'nutritionist+coach': `You advise as Nutritionist 🥗 AND Coach 💪 — both active; BOTH must speak in every reply.
Nutritionist lens: food quality, macros, meal timing, qualitative CGM (stable/elevated/etc.) — NOT optional; numbers only if user asks.
Coach lens: body composition, muscle mass, training recovery, progressive fat loss, performance — NOT just food.
CRITICAL: Do NOT let nutrition dominate. The Coach must always have a visible angle (muscle, composition, movement, recovery, tomorrow's training).
Use mentorLines with separate "nutritionist" and "coach" keys — one sentence each. NEVER one blended paragraph.
In actionItems: include at least one food/macro or CGM-aware item AND at least one body-composition or activity item.
If conflict: food quality (Nutritionist) > reckless deficit (Coach) — but Coach still contributes.`,

  'doctor+nutritionist+coach': `You advise as Doctor 🩺, Nutritionist 🥗, AND Coach 💪 — all three active; each must inform every reply.
Priority when advice conflicts: safety (Doctor) > food quality + CGM (Nutritionist) > performance (Coach).
Nutritionist: qualitative CGM by default; mg/dL only when user asks for numbers or analysis.
Use mentorLines with separate "doctor", "nutritionist", and "coach" keys — one sentence each. NEVER one blended paragraph.
In actionItems: spread across safety-aware eating, macro/CGM targets, and composition/training — at least one item per active mentor angle where possible.`,
};

export function buildMentorSystemPrompt(mentors: MentorType[]): string {
  const ordered = MENTOR_PRIORITY.filter((m) => mentors.includes(m));
  if (ordered.length === 0) return MENTOR_COMBO_PROMPTS.coach;
  const key = mentorComboKey(ordered);
  return MENTOR_COMBO_PROMPTS[key] ?? MENTOR_PERSONAS[ordered[0]!];
}

/** Rules appended when CGM data is available — Nutritionist/Doctor must use it. */
function buildCgmMentorRules(ctx: CoachContext, opts?: { glucoseDeepDive?: boolean }): string {
  const hasCgm =
    Boolean(ctx.todayMealGlucoseDetail) ||
    (ctx.glucoseHistory != null && ctx.glucoseHistory.length > 0);
  if (!hasCgm) return '';
  const hasNut = ctx.mentors.includes('nutritionist');
  const hasDoc = ctx.mentors.includes('doctor');
  const deepDive = opts?.glucoseDeepDive === true;
  if (!hasNut && !hasDoc) {
    return deepDive
      ? '\n- CGM data is in USER DATA — cite avg/min/max mg/dL when relevant.'
      : '\n- CGM data is in USER DATA — mention glucose qualitatively (stable/elevated) when relevant; no mg/dL unless user asked for numbers.';
  }
  const deepDiveRules = deepDive
    ? `
- DEEP DIVE (user asked for numbers/analysis): quote avg, min, max (mg/dL), range %, day/night averages when in block; name foods if MEAL GLUCOSE links spikes`
    : `
- DEFAULT (headline): one short qualitative glucose verdict — stable / in range / a bit high / on the low side / worth watching. NO mg/dL, avg/min/max, or range % in the reply
- Offer detail only when something looks off OR user may want more — e.g. "רוצה פירוט?" / "Want the numbers?" — do NOT dump stats unprompted`;
  return `
- CGM (TODAY / RECENT / MEAL GLUCOSE blocks) is a PRIMARY input — read it every turn; relate food advice to glycemic impact internally
- NEVER say "no CGM data" (or equivalent) when USER DATA includes MEAL GLUCOSE, TODAY CGM, or RECENT CGM with samples — CGM is synced; say post-meal window not ready yet if Meals with usable window is 0/N
- When MEAL GLUCOSE shows "CGM samples in sync" but usable window is 0/N, give a qualitative today assessment; cite avg/min/max only in DEEP DIVE mode — do NOT claim CGM is unavailable
- First message in this tab today: qualitative glucose headline only — NOT a stats block${deepDiveRules}
- For reviews ≤7 days you ALSO have CGM ALL READINGS (HH:MM=mg/dL) and CGM DAY vs NIGHT — use for DEEP DIVE only; never say you only have daily summaries when these lines are present
- On follow-ups about food targets, hunger, fat/protein, or food-science (omega, vitamins, nutrients) without a glucose question: answer that topic directly — NO glucose opener; weave glucose qualitatively at most; do NOT re-open with CGM stats
- Mention compression lows if relevant: sleeping on the sensor can falsely lower readings — isolated low days may be artifact
- Exclude sensor warm-up (first 24h after install) and statistically excluded rare sensor-error days — see filter lines in USER DATA
- Without meal logs: still note glucose qualitatively; urge logging meals to link spikes to specific foods
- Qualitative verdicts must be grounded in the data — never generic if you read concerning patterns; switch to DEEP DIVE numbers when clinically urgent (symptomatic lows)`;
}

/** Rules appended on the Coach tab — mirror the CGM pattern so coach is not under-constrained. */
function buildCoachMentorRules(ctx: CoachContext): string {
  if (!ctx.mentors.includes('coach')) return '';
  return `
- TODAY WORKOUTS in USER DATA lists today's Withings sessions — cite by name when discussing activity or daily progress
- On today-progress questions: [activity if any] → [P/C/F vs target] → [balance/deficit] → one concrete next step
- Do NOT claim workouts are missing when TODAY WORKOUTS lists sessions
- Do NOT repeat the same macro numbers verbatim if your prior reply in this tab already stated them unchanged`;
}

export function formatActiveMentorsLine(mentors: MentorType[]): string {
  const ordered = MENTOR_PRIORITY.filter((m) => mentors.includes(m));
  const labels = ordered.map((m) => MENTOR_LABELS[m]).join(' + ');
  if (ordered.length <= 1) return `ACTIVE MENTORS: ${labels}`;
  return `ACTIVE MENTORS: ${labels} — every reply must reflect ALL selected mentors (see system prompt).`;
}

/** JSON rules summary — keys stay English; string values follow app language. */
function rulesJsonLangInstruction(lang?: UserLanguage | null): string {
  if (!lang || lang.code === 'en') return '';
  return `\nLANGUAGE: Write JSON string values (summary, context, each constraints[] item) in ${lang.label} (${lang.code}). Keys must stay exactly "summary", "constraints", and optional "context". Output ONLY valid JSON — no markdown, no prose before or after.`;
}

function parseUserRulesSummary(raw: string, finishReason = 'UNKNOWN'): UserRulesSummary {
  const stripped = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  const normalize = (parsed: Partial<UserRulesSummary>): UserRulesSummary => ({
    summary: String(parsed.summary ?? '').trim(),
    constraints: (Array.isArray(parsed.constraints) ? parsed.constraints : [])
      .map((c) => String(c).trim())
      .filter(Boolean)
      .slice(0, 5),
    ...(String(parsed.context ?? '').trim()
      ? { context: String(parsed.context).trim() }
      : {}),
  });

  try {
    const parsed = normalize(JSON.parse(cleaned) as UserRulesSummary);
    if (parsed.summary || parsed.constraints.length > 0) return parsed;
  } catch {
    /* regex fallback */
  }

  const pickString = (key: string): string | null => {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
    const m = cleaned.match(re);
    return m ? m[1]!.replace(/\\"/g, '"').trim() : null;
  };

  const constraints: string[] = [];
  const arr = cleaned.match(/"constraints"\s*:\s*\[([\s\S]*?)\]/);
  if (arr) {
    const re = /"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(arr[1]!)) !== null) {
      const item = m[1]!.replace(/\\"/g, '"').trim();
      if (item) constraints.push(item);
    }
  }

  const summary = pickString('summary') ?? '';
  const context = pickString('context') ?? undefined;
  if (summary || constraints.length > 0) {
    return normalize({ summary, constraints, context });
  }

  const hint = finishReason === 'MAX_TOKENS' ? ' (truncated)' : '';
  throw new Error(`Could not parse rules summary${hint}: ${raw.slice(0, 120)}`);
}

export type UserRulesSummary = {
  summary: string;
  constraints: string[];
  /** One-line goal framing (stored as aiContext) — not a diet label like keto. */
  context?: string;
};

export async function summariseUserRules(
  rawText: string,
  _mentors: MentorType[],
  lang?: UserLanguage | null,
): Promise<UserRulesSummary> {
  const prompt = `You are a clinical nutritionist assistant. Extract the user's dietary rules into JSON only.

Schema (English keys only):
{"summary":"High cholesterol · IF 16:8","context":"Lower LDL; heart-healthy fats; kidney-aware protein","constraints":["avoid entrecôte","prefer salmon and nuts"]}

Rules:
- summary: max 5 words, · separator — user's framing (cholesterol, kidney, IF, etc.)
- context: optional ONE short sentence — primary goals (e.g. cholesterol, kidney) — NOT a diet brand name
- constraints: max 5 items, max 8 words each — actionable bullets from user text only
- ALWAYS copy explicit gram targets verbatim into constraints (e.g. "carbs at least 65g", "fiber at least 35g") — these are HARD floors/caps
- Do NOT label as keto, ketogenic, or קטוגנית unless the user explicitly wrote keto/קטו/קטוגנית
- Do NOT invent carb gram caps the user did not state
- Do NOT drop or soften numeric minimums the user stated (carbs, fiber, protein)
- "סיבים מירקות וזרעים" / fiber from vegetables & seeds = food quality — NOT low-carb/keto diet

User text:
"""
${rawText.replace(/"/g, "'")}
"""${rulesJsonLangInstruction(lang)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0, maxOutputTokens: 2048 }),
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
  if (!raw) throw new Error('Empty response from Gemini');

  return parseUserRulesSummary(raw, finishReason);
}

// ─── Meal save rule check (same My Rules block as mentor chat) ────────────────

export type MealRuleCheckIssue = {
  itemName: string;
  severity: 'warning' | 'critical';
  message: string;
};

export async function checkMealAgainstUserRules(
  items: FoodItem[],
  userRules: UserRules | null,
  lang?: UserLanguage | null,
  nutritionDirectiveContext?: string | null,
): Promise<MealRuleCheckIssue[]> {
  if (MOCK_MODE || items.length === 0) return [];
  if (!userRules?.rawText?.trim() && !nutritionDirectiveContext?.trim()) return [];

  const itemLines = items
    .map((item) => {
      const label = item.name_local ?? item.name;
      return `- ${label} (${item.name}): ${item.grams}g, ${item.kcal} kcal, P${item.protein_g}g C${item.carb_g}g F${item.fat_g}g Fi${item.fiber_g ?? 0}g`;
    })
    .join('\n');

  const rulesCombined = formatDirectiveAndRulesForChecks(
    nutritionDirectiveContext,
    userRules?.rawText?.trim()
      ? formatMacroRevisionRulesBlock(userRules)
      : '=== MY RULES ===\n(none — apply NUTRITIONIST DIRECTIVE only)',
  );

  const prompt = `You are the Nutritionist mentor. The user is about to SAVE this meal to their food log.
Check EVERY item line independently against the NUTRITIONIST DIRECTIVE (if present) and MY RULES. Flag only lines that VIOLATE — never flag because something is missing from the meal.

${rulesCombined}

${MEAL_FAT_RULE_FLAGGING_GUIDANCE}

MEAL TO SAVE (check each line):
${itemLines}

Return JSON ONLY (no markdown):
{"issues":[{"itemName":"<display name from meal list>","severity":"critical"|"warning","message":"<one short sentence why THIS item violates rules>"}]}

Rules for your response:
- Apply NUTRITIONIST DIRECTIVE first on conflict, then MY RULES.
- Apply ONLY what the blocks say — verbatim Original may allow exceptions (e.g. whey isolate while limiting other animal fats).
- Plant-fat items pass when rules favor unsaturated sources; flag animal/dairy fat only when rules forbid it without an exception.
- Do NOT flag "missing" preferred foods. Do NOT flag psyllium/fiber for fat.
- itemName must match the violating line's label (before the English name in parentheses).
- If no line violates, return {"issues":[]}
- Max 5 issues.${langInstruction(lang)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0.1, maxOutputTokens: 1024 }),
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
  if (!raw) return [];

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  try {
    const parsed = JSON.parse(cleaned) as { issues?: MealRuleCheckIssue[] };
    return Array.isArray(parsed.issues) ? parsed.issues : [];
  } catch {
    return [];
  }
}

// ─── Lab report PDF parsing ───────────────────────────────────────────────────

export type LabPdfParseResult = {
  parsed: ParsedLabPdf;
  confidence: 'high' | 'low';
};

const LAB_PARSE_MOCK: ParsedLabPdf = {
  labProvider: 'clalit',
  patientName: 'רביב שוויד',
  patientId: '24667792',
  collectedAt: '2026-06-16T10:10:00+03:00',
  printedAt: '2026-06-16T15:52:00+03:00',
  panelType: 'chemistry',
  results: [
    { code: 'GLUCOSE', name: 'Glucose', nameOriginal: 'GLUCOSE', value: 91, unit: 'mg/dL', flag: 'unknown' },
    { code: 'CHOLESTEROL', name: 'Total cholesterol', nameOriginal: 'CHOLESTEROL', value: 225.6, unit: 'mg/dL', flag: 'high', referenceText: 'ערך רצוי קטן מ 200' },
    { code: 'CHOLESTEROL_LDL', name: 'LDL cholesterol', nameOriginal: 'CHOLESTEROL-LDL calc', value: 170, unit: 'mg/dL', flag: 'high', referenceText: 'ערך רצוי קטן מ 100' },
    { code: 'CHOLESTEROL_HDL', name: 'HDL cholesterol', nameOriginal: 'CHOLESTEROL- HDL', value: 44, unit: 'mg/dL', flag: 'unknown' },
    { code: 'TRIGLYCERIDES', name: 'Triglycerides', nameOriginal: 'TRIGLYCERIDES', value: 60, unit: 'mg/dL', flag: 'unknown' },
  ],
};

function normalizeLabFlag(v: unknown): LabResultFlag {
  if (v === 'low' || v === 'high' || v === 'normal') return v;
  return 'unknown';
}

function normalizePanelType(v: unknown): LabPanelType {
  if (v === 'chemistry' || v === 'cbc') return v;
  return 'other';
}

/** True when value sits on a printed range endpoint (classic gauge mix-up). */
function valueEqualsBound(value: number, bound: number | undefined): boolean {
  if (bound == null || !Number.isFinite(bound)) return false;
  return Math.abs(value - bound) < 1e-9;
}

/**
 * Pure math (no text parsing): recompute flag from value vs numeric range.
 * Catches gauge-layout mixups where a range bound was extracted as the value
 * (e.g. Meuhedet TSH "0.35 low" when 0.35 was the scale minimum).
 */
function flagFromRange(
  value: number,
  refLow: number | undefined,
  refHigh: number | undefined,
  extracted: LabResult['flag'],
): LabResult['flag'] {
  if (refLow == null || refHigh == null || !(refLow < refHigh)) return extracted;
  // Value on a bound is almost always a gauge OCR mistake — never trust "low"/"high".
  if (valueEqualsBound(value, refLow) || valueEqualsBound(value, refHigh)) {
    return 'unknown';
  }
  const math: LabResult['flag'] =
    value < refLow ? 'low' : value > refHigh ? 'high' : 'normal';
  return math;
}

function normalizeLabResults(raw: unknown): LabResult[] {
  if (!Array.isArray(raw)) return [];
  const out: LabResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const value = Number(o.value);
    if (!Number.isFinite(value)) continue;
    const code = String(o.code ?? o.nameOriginal ?? 'UNKNOWN').trim().replace(/\s+/g, '_').toUpperCase();
    const refLowRaw = Number(o.refLow);
    const refHighRaw = Number(o.refHigh);
    const refLow = Number.isFinite(refLowRaw) ? refLowRaw : undefined;
    const refHigh = Number.isFinite(refHighRaw) ? refHighRaw : undefined;
    const extractedFlag = normalizeLabFlag(o.flag);
    out.push({
      code,
      name: String(o.name ?? code),
      nameOriginal: o.nameOriginal != null ? String(o.nameOriginal) : undefined,
      value,
      unit: String(o.unit ?? '').trim(),
      flag: flagFromRange(value, refLow, refHigh, extractedFlag),
      referenceText: o.referenceText != null ? String(o.referenceText) : undefined,
      ...(refLow != null ? { refLow } : {}),
      ...(refHigh != null ? { refHigh } : {}),
    });
  }
  return out;
}

function isGaugeBoundCollision(r: LabResult): boolean {
  return (
    (r.refLow != null && r.refHigh != null && r.refLow < r.refHigh)
    && (valueEqualsBound(r.value, r.refLow) || valueEqualsBound(r.value, r.refHigh))
  );
}

/**
 * Second pass when first extract set value == refLow/refHigh (Meuhedet gauge bug).
 * Re-asks Gemini only for those codes; keeps first-pass row if repair fails.
 */
async function repairGaugeBoundCollisions(
  pdfBase64: string,
  results: LabResult[],
): Promise<LabResult[]> {
  const bad = results.filter(isGaugeBoundCollision);
  if (bad.length === 0) return results;

  const codes = bad.map((r) => r.code).join(', ');
  const prompt = `You re-read a medical lab PDF. The first pass wrongly used a REFERENCE RANGE endpoint as the test RESULT for these codes: ${codes}.

GAUGE LAYOUT (Meuhedet / similar): each test is a horizontal scale.
- Numbers at the LEFT and RIGHT ends of the scale = refLow and refHigh only.
- The RESULT is the number printed at the vertical marker, usually ABOVE the scale (often blue/bold).
- HARD example: TSH scale ends 0.35 … 4.94 with marker label 3.64 above → value=3.64, refLow=0.35, refHigh=4.94. NEVER value=0.35 or 4.94.

For EACH listed code, find that row again and output JSON only:
{"results":[{"code":"TSH","value":3.64,"unit":"µIU/mL","refLow":0.35,"refHigh":4.94,"flag":"normal"}]}

Rules:
- value MUST NOT equal refLow or refHigh.
- Copy digits exactly; skip a code if the marker value is unreadable.
- Include only the codes listed above that you can fix.`;

  try {
    const body = {
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
          { text: prompt },
        ],
      }],
      generationConfig: geminiGenerationConfig({ temperature: 0, maxOutputTokens: 4096 }),
    };
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return results;
    const json = await response.json();
    const raw: string = extractGeminiText(json?.candidates?.[0]);
    if (!raw) return results;
    const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return results;
    }
    const repaired = normalizeLabResults(data.results);
    if (repaired.length === 0) return results;

    const byCode = new Map(repaired.map((r) => [r.code, r]));
    return results.map((r) => {
      if (!isGaugeBoundCollision(r)) return r;
      const fix = byCode.get(r.code);
      if (!fix || isGaugeBoundCollision(fix)) return r;
      return {
        ...r,
        value: fix.value,
        unit: fix.unit || r.unit,
        flag: flagFromRange(fix.value, fix.refLow ?? r.refLow, fix.refHigh ?? r.refHigh, fix.flag),
        refLow: fix.refLow ?? r.refLow,
        refHigh: fix.refHigh ?? r.refHigh,
      };
    });
  } catch {
    return results;
  }
}

/**
 * Lab PDF → structured rows. Data parse, NOT a chat reply: output is canonical
 * English regardless of app language (prompt99 — a Russian-app import painted
 * the clinic portal with Russian test names the clinician couldn't read).
 */
export async function parseLabReportPdf(
  pdfBase64: string,
  _lang?: UserLanguage | null,
  useMock = false,
): Promise<LabPdfParseResult> {
  if (useMock || MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 600));
    return { parsed: LAB_PARSE_MOCK, confidence: 'high' };
  }

  const prompt = `You are a medical lab report parser. Extract structured data from this PDF lab printout (any provider, any language — Israeli HMO formats like Clalit, Meuhedet, Maccabi, Leumit are common).

Output JSON only, no markdown:
{"labProvider":"meuhedet","patientName":"...","patientId":"...","collectedAt":"2026-06-16T10:10:00+03:00","printedAt":"2026-06-16T15:52:00+03:00","panelType":"chemistry","panelNote":null,"results":[{"code":"TSH","name":"TSH","nameOriginal":"TSH","value":3.64,"unit":"µIU/mL","flag":"normal","refLow":0.35,"refHigh":4.94,"referenceText":null}]}

Rules:
- Extract EVERY numeric test row; do not invent tests not in the PDF.
- **Values are sacred:** copy each number EXACTLY as printed (digits and decimal point). Never round, estimate, or invent. If unreadable, skip that row.
- **GAUGE / SCALE LAYOUTS (Meuhedet and similar) — HARD:**
  Each test is often a horizontal ruler/slider.
  • LEFT end number = refLow only. RIGHT end number (+ unit) = refHigh only.
  • RESULT = the number at the vertical marker, almost always printed ABOVE the scale (blue/bold).
  • HARD EXAMPLE that must not be misread: TSH with scale ends 0.35 and 4.94 µIU/mL and marker label 3.64 above → {"value":3.64,"refLow":0.35,"refHigh":4.94,"flag":"normal"}. Writing value:0.35 is WRONG.
  • HARD RULE: \`value\` MUST NOT equal \`refLow\` or \`refHigh\`. If it does, you grabbed a bound — look again for the marker number above the scale.
  Plain table layouts (Clalit): value is its own column; range is a separate "norm" cell like "0.35 - 4.94".
- **\`refLow\` / \`refHigh\`:** always fill when the report prints a range (scale ends or norm column).
- **Self-check:** value < refLow → flag low; value > refHigh → high; else normal. If flag text (e.g. "low") disagrees with this math, you mixed value and bound — re-read.
- **\`name\` is ALWAYS canonical clinical English** (e.g. "Glucose", "TSH") — never Hebrew/Russian/app language. Clinicians read this JSON worldwide.
- **\`nameOriginal\` = verbatim PDF label** (any language).
- Specimen date/time → ISO 8601 with local offset.
- panelType: "chemistry", "cbc", or "other".
- **Canonical \`code\` when present:** CREATININE, UREA (or BUN), CHOLESTEROL_LDL, CHOLESTEROL, CHOLESTEROL_HDL, TRIGLYCERIDES, GLUCOSE, HBA1C, TSH. Map any-language labels to these codes — the app matches codes only.
- Other tests: spaces/hyphens → underscore, UPPERCASE.
- flag: "high", "low", "normal", or "unknown".
- Skip non-numeric QC rows (HEMOLYTIC, LIPEMIC, ICTERIC) — put text in panelNote if needed.
- referenceText stays verbatim when present.
- labProvider: "clalit" (כללית), "meuhedet" (מאוחדת), "maccabi" (מכבי), "leumit" (לאומית), else "unknown".`;

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: geminiGenerationConfig({ temperature: 0.1, maxOutputTokens: 8192 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini lab PDF error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const raw: string = extractGeminiText(json?.candidates?.[0]);
  if (!raw) throw new Error('Empty response parsing lab PDF');

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error(`Could not parse lab PDF JSON: ${raw.slice(0, 120)}`);
  }

  let results = normalizeLabResults(data.results);
  if (results.length === 0) {
    throw new Error('No lab results found in PDF — try exporting again from Clalit');
  }
  // Meuhedet gauges: first pass often sets value=refLow; repair those rows.
  results = await repairGaugeBoundCollisions(pdfBase64, results);

  const knownProviders = new Set(['clalit', 'meuhedet', 'maccabi', 'leumit']);
  const providerRaw = String(data.labProvider ?? '').toLowerCase();
  const parsed: ParsedLabPdf = {
    labProvider: knownProviders.has(providerRaw)
      ? (providerRaw as ParsedLabPdf['labProvider'])
      : 'unknown',
    patientName: data.patientName != null ? String(data.patientName) : undefined,
    patientId: data.patientId != null ? String(data.patientId) : undefined,
    collectedAt: String(data.collectedAt ?? new Date().toISOString()),
    printedAt: data.printedAt != null ? String(data.printedAt) : undefined,
    panelType: normalizePanelType(data.panelType),
    results,
    panelNote: data.panelNote != null ? String(data.panelNote) : undefined,
  };

  const stillBad = results.some(isGaugeBoundCollision);
  return {
    parsed,
    confidence: stillBad ? 'low' : results.length >= 5 ? 'high' : 'low',
  };
}

// ─── Nutritionist session PDF ─────────────────────────────────────────────────

export type ParsedNutritionDirectivePdf = {
  title: string;
  sessionDate: string | null;
  fullText: string;
  lang: 'he' | 'en' | 'mixed' | null;
};

export async function parseNutritionDirectivePdf(
  pdfBase64: string,
  lang?: UserLanguage | null,
  useMock = false,
): Promise<ParsedNutritionDirectivePdf> {
  if (useMock || MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 600));
    return {
      title: 'סיכום מפגש ראשון',
      sessionDate: '2026-07-02',
      fullText: 'סיכום מפגש ראשון\n\nיעדים:\n- LDL <100\n- שמירה על ירידה במשקל\n\nיעדי תפריט:\n- חלבון 1.2–1.5 g/kg\n\nארוחת בוקר:\n- …\n\nארוחת צהריים:\n- …\n\nסיכום מאקרו:\n1690 kcal · P112\n\nמשימות:\n- בדיקות ויטמין D',
      lang: 'he',
    };
  }

  const prompt = `You transcribe a nutritionist session report PDF into plain text for the patient app.

Your #1 job is LAYOUT: reproduce the PDF's visual structure with line breaks — not one long paragraph.

Output JSON only, no markdown fences:
{"title":"…","sessionDate":"YYYY-MM-DD or null","fullText":"…","lang":"he|en|mixed|null"}

fullText rules (most important):
1. Copy every word/number exactly as written (Hebrew/English). Do not summarize, paraphrase, omit, or reorder.
2. Blank line between sections: whenever the PDF shows a new block (title, goals, menu targets, sample meals, macro totals, guidelines, tasks, contact), insert TWO line breaks (\\n\\n) before that block.
3. One line per bullet: each bullet or numbered item must be on its own line; separate items with a single \\n.
4. Meal blocks: put "ארוחת בוקר", "ארוחת צהריים", "ארוחת ערב" (or English equivalents) each on their own line, with a blank line before each meal section if the PDF separates them.
5. In JSON, encode line breaks as \\n inside the fullText string (not spaces). A report with 8 sections should have many \\n characters — if fullText is one continuous line, you failed the layout task; fix before responding.

Example shape (content is illustrative — yours must match the PDF):
{"title":"סיכום מפגש ראשון","sessionDate":"2026-07-02","fullText":"סיכום מפגש ראשון\\n\\nיעדים:\\n- LDL <100\\n- …\\n\\nיעדי תפריט:\\n- חלבון …\\n\\nארוחת בוקר:\\n- …\\n\\nארוחת צהריים:\\n- …\\n\\nסיכום מאקרו:\\n1690 kcal …\\n\\nמשימות:\\n- …\\n\\nמיכל · 054-…","lang":"he"}

Other fields:
- title: document title or first heading line.
- sessionDate: parse DD.MM.YY or header date → ISO YYYY-MM-DD, or null.
- lang: "he", "en", "mixed", or null.

Before you output: scan fullText — confirm blank lines (\\n\\n) between major sections and one item per line.${langInstruction(lang)}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: geminiGenerationConfig({ temperature: 0.1, maxOutputTokens: 8192 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini directive PDF error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const raw: string = extractGeminiText(json?.candidates?.[0]);
  if (!raw) throw new Error('Empty response parsing nutritionist PDF');

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error(`Could not parse directive PDF JSON: ${raw.slice(0, 120)}`);
  }

  const fullText = String(data.fullText ?? '').trim();
  if (!fullText) throw new Error('No text extracted from PDF — try a clearer export');

  const langRaw = data.lang != null ? String(data.lang) : null;
  const parsedLang =
    langRaw === 'he' || langRaw === 'en' || langRaw === 'mixed' ? langRaw : null;

  const titleRaw = String(data.title ?? '').trim();
  const title =
    titleRaw ||
    fullText.split('\n').map((s) => s.trim()).find(Boolean)?.slice(0, 80) ||
    'Nutritionist report';

  return {
    title,
    sessionDate: data.sessionDate != null ? String(data.sessionDate).slice(0, 10) : null,
    fullText,
    lang: parsedLang,
  };
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
  fiber_g: number;
  /** Derived C − Fi after post-process; optional on raw model JSON. */
  net_carb_g?: number;
  kcal: number;
  diet_label: string;
  reasoning: string;
  /** Computed clinical profile — echo CLINICAL PROFILE block; e.g. "lipid-primary + kidney cap". */
  clinical_profile?: string;
  /** Macro derivation order after kcal — echo CLINICAL PROFILE block. */
  macro_order?: string;
  /** P/C/F priority after kcal — echo CLINICAL PROFILE block, e.g. "P (cap) → C+Fi → F (fill)". */
  pcf_priority?: string;
  /** Set only when My Rules should be edited; omitted when rules fit labs/CGM/food/weight. */
  rules_advice?: string;
};

function normalizeRulesAdvice(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  return s;
}

const FIBER_CARB_RULE = `
## Fiber ↔ carb (mandatory)
- Dietary fiber is counted INSIDE total carbohydrates on food labels — \`fiber_g\` must NEVER exceed \`carb_g\`.
- **Priority:** (1) verbatim **My Rules** gram floors for carb_g / fiber_g — HARD; (2) LDL/cholesterol soft band ~55% fiber/carbs when no fiber rule; (3) generic default below.
- Generic default: \`fiber_g\` ≈ round(55% × \`carb_g\`) from high-fiber whole foods (avocado, vegetables, seeds, psyllium); min **30g** when \`carb_g\` ≥ 55g (e.g. 66g C → ~36g Fi).
- **"סיבים ממקורות דלי פחמימה"** means prefer fiber-rich **foods** that are not sugary/refined — it does **NOT** mean minimize total \`carb_g\` or a ketogenic diet.`;

const MACRO_REVISION_PROMPT = `## Role
You are a certified clinical nutritionist revising **daily macro targets** (not meal advice).

${FIBER_CARB_RULE}

## Energy / kcal (do this FIRST — before P/C/F)
**Explicit daily calories are HARD (Gemini judgment — no keyword/regex parse):**
1. **NUTRITIONIST DIRECTIVE** (active) — e.g. summary line \`קלוריות: 1,690\` / daily calorie total in the macro summary → set JSON \`kcal\` to that integer (ignore thousands separators).
2. Else **My Rules** verbatim — same if they state daily kcal / קלוריות.
3. Else **ENERGY BALANCE (computed)** — monitoring-driven fallback (watch burn, scale trend).
4. CGM lows (&lt;70 trusted day) may require holding higher than a deep cut — explain in \`reasoning\`.

On conflict: **directive wins over My Rules**; both beat ENERGY BALANCE.

ENERGY BALANCE (when used) is based on:
- **Smartwatch** 7d avg burn (TDEE anchor — not BMR)
- **Smart scale** 14d weight trend (adaptive deficit/surplus)
- **Food log** 7d eaten avg (context only — do not raise kcal above burn on a loss goal when using this fallback)

Textbook method (already applied in computed block when fallback applies):
- Loss rate targets: **0.3% BW/week** near goal · **0.5%** moderate gap · **0.7%** far (max)
- Energy: **7700 kcal ≈ 1 kg** body-weight change → daily deficit/surplus
- **% TDEE caps**: ~5–7% near goal / on-track · up to **12%** mid-gap · **20%** (500 kcal) absolute max
- **Adaptive**: if scale shows loss **faster than target** → **do not deepen** cut toward TDEE **unless** 7d eaten avg is already well below burn (then keep textbook deficit — see ENERGY BALANCE block).
- Absolute floor: sex/age minimum + never below **75%** of measured burn

Work order:
1. Set \`kcal\` from directive / My Rules / ENERGY BALANCE (priority above).
2. **Clinical profile** — lab synthesis, primary driver + constraints, macro derivation order (section below).
3. Set \`protein_g\`, \`carb_g\`, \`fiber_g\`, then \`fat_g\` fills remaining kcal per chosen order.
4. In \`reasoning\`: cite whether kcal came from nutritionist summary, My Rules, or ENERGY BALANCE → then P/C/F/Fi.

## Clinical profile & macro order (after kcal — before grams)
Before setting P/C/F/Fi, build a short clinical profile from the **NUTRITIONIST DIRECTIVE** (if present), My Rules, full **LAB RESULTS**, CGM 7d block, weight goal, and computed GUIDANCE blocks — use blocks for caps/bands; do not re-derive what they already state.

### A — Lab synthesis (textbook)
- Scan the **latest** chemistry + CBC draw; cite abnormal values in \`reasoning\`.
- Note **pattern** when relevant (e.g. high LDL + normal TG/glucose → isolated LDL elevation, not metabolic syndrome).
- **Secondary** flags (iron, phosphorus, liver enzymes, uric acid): mention in \`reasoning\` or \`rules_advice\` when nutrition-relevant — they do not override P/C/F unless clearly tied to macros.

### B — Profile (primary + constraints)
Pick **one primary** macro driver and list **secondary constraints**:

| Primary | When |
| lipid | LDL/total chol high OR My Rules center cholesterol / כולסטרול |
| glycemic | Fasting glucose or HbA1c high OR CGM poorly controlled (per GLYCEMIC GUIDANCE) |
| weight | Labs/rules OK; body-composition goal dominates |
| explicit_low_carb | User **raw** rules text explicitly requests low-carb / keto |

Secondary constraints (can stack): **kidney** (creatinine/urea high → protein cap), **energy_cautious** (scale losing faster than ENERGY BALANCE target), CGM lows (&lt;70).

When multiple apply: primary sets **macro derivation order**; secondaries apply **caps/bands** (lab conflict order: kidney → glycemic → lipid → CARB GUIDANCE).

### C — Macro derivation order (after \`kcal\`)
| Profile | Order for grams |
| **directive / My Rules set net carbs** | **PRIORITY (Gemini):** fiber → **net-carb cap** → \`carb_g = net + fiber\` → protein → fat fills |
| kidney constraint + lipid primary | protein cap (KIDNEY GUIDANCE) → carbs/fiber → fat fills remaining kcal |
| glycemic primary | carbs/fiber (GLYCEMIC + habit CARB GUIDANCE) → protein → fat fills remaining kcal |
| weight-only / balanced | protein → carbs/fiber → fat fills remaining kcal |
| explicit_low_carb (only if user/directive clearly says so — Gemini judgment) | carb/net cap per text → protein → fat fills remaining kcal |

When directive/My Rules state net or total carbs, those beat habit CARB GUIDANCE bands.

**Always:** \`fat_g\` = remaining kcal after P/C/Fi (÷9, round). Fat **quality** still governed by My Rules and LIPID GUIDANCE — high \`fat_g\` from math is OK when unsaturated-focused.

State profile and order in \`reasoning\` (user language OK in \`reasoning\` only).

**JSON profile fields (\`clinical_profile\`, \`macro_order\`, \`pcf_priority\`):** professional **medical English only** — echo CLINICAL PROFILE block exactly; never Hebrew in these fields.

### D — \`diet_label\`
Describe goals (cholesterol, kidney, weight, IF) — never "keto/ketogenic" unless user raw text explicitly says keto.
When lipid-primary: center lipids and heart-healthy fats in \`diet_label\` and \`reasoning\` — not carb minimization.

## Fat (derivation)
After profile order: \`fat_g\` typically **fills** remaining kcal toward the chosen \`kcal\` target (directive / My Rules / ENERGY BALANCE).
When lipid-primary OR LDL/total cholesterol high in labs:
- Favor **unsaturated** fats per My Rules (salmon, nuts, seeds, olive oil); respect saturated-fat / cholesterol-food limits in rules.
- High \`fat_g\` from kcal math is OK if fats are rule-aligned — do **not** slash \`carb_g\` just to lower fat grams when cholesterol (not keto) is the goal.
- Cite lipid lab values in \`reasoning\` when LAB RESULTS present.

## Carbs (derivation)
Read **NUTRITIONIST DIRECTIVE** and **My Rules** first for total carbs / net carbs (Gemini judgment).
**CARB GUIDANCE** is habit/lab context only when those texts do not set carb or net numbers.

Professional habit tiers (only when no explicit carb/net in directive/My Rules):
- **7d eaten avg ≥ 50g/day** → habit anchor **±10g**.
- **7d eaten avg &lt; 50g** + lipid labs actionable → suggest **50–80g** soluble-fiber carbs unless CGM or user chose low-carb.
- CGM meal-spike lines may justify **specific** lowering — not blanket carb cuts for cholesterol alone.

## CGM (7-day block)
Context: GLUCOSE & FOOD IMPACT + MEAL GLUCOSE in the data section below.
- MUST cite period avg, min, max (mg/dL) in \`reasoning\` when CGM present.
- Use meal-spike / problem-food lines to justify carb and fiber targets.
- Lows &lt;70 (trusted days): do not cut kcal further — note in \`reasoning\`.

## Kidney (lab results)
Scope: **KIDNEY GUIDANCE (computed)** when present; else creatinine / urea on latest draw in LAB RESULTS.
- When creatinine or urea is flagged **high**: \`protein_g\` ≤ round(2.2 × lean mass kg); if lean mass missing use round(2.0 × weight kg).
- Cite exact lab values in \`reasoning\`; do not raise protein above 7d eaten protein avg without strong justification.
- If My Rules omit kidney/protein limits while these labs are high: set \`rules_advice\` with one concrete sentence the user can paste into My Rules.

## Lipids (lab results)
Use **LIPID GUIDANCE (computed)** when present — fat quality and fiber, **not** carb minimization for LDL alone.

## Glycemic (lab results + CGM)
Use **GLYCEMIC GUIDANCE (computed)** when present; cross-check **CGM 7-day block** (labs alone are not enough for daily carb targets).

## Priority rules
1. **NUTRITIONIST DIRECTIVE** (when present) — macro summary numbers (kcal, protein, net carbs, fiber, total carbs, saturated fat notes, etc.) are **HARD** via Gemini reading of the text; beat ENERGY BALANCE and habit bands. Wins over My Rules on conflict. **No code/regex parse** — you extract the numbers.
2. **My Rules verbatim text** — same: explicit kcal / P / C / Fi / net / caps/floors are **HARD** by Gemini judgment only.
3. **Net carbs** (when stated in directive or My Rules): after kcal, prefer order fiber → net cap → \`carb_g = net + fiber\`; do not exceed the net cap (smaller is OK). Raise fiber to meet a total-carb floor without raising net.
4. **Energy balance**: \`kcal\` from **ENERGY BALANCE (computed)** only when directive/My Rules do **not** state daily calories.
5. **Lab conflict order**: kidney protein cap (lab math) → glycemic caution → lipid fat quality → habit CARB GUIDANCE band (skipped when directive/My Rules set carbs/net).
6. Labs: informational only — not a diagnosis.
7. kcal must align with 4×P + 4×C + 9×F within ~50 kcal.

## My Rules integrity
Compare the My Rules block to labs, CGM, 7d food log, and weight goal.
- If rules fit the data: **omit** \`rules_advice\` entirely — stay silent.
- If rules conflict with data or recent meals (e.g. "avoid X" but X logged): set \`rules_advice\` to one short paragraph — suggest concrete rule text edits only.
- Do **not** repeat rules that already match; do **not** relabel the diet (e.g. keto/ketogenic) unless the user's **raw** rules text says so — quote constraint bullets, not AI summary labels alone.
- \`diet_label\`: describe goals (cholesterol, IF, etc.) — never "keto/ketogenic" unless user raw text explicitly says keto.

## Output format
Return **JSON only** — no markdown, no preamble. Every numeric field must be a positive integer **derived from the data block**, not copied from the schema below.

\`\`\`json
{"protein_g":integer,"fat_g":integer,"carb_g":integer,"fiber_g":integer,"kcal":integer,"diet_label":"string","clinical_profile":"string — medical English, echo CLINICAL PROFILE","macro_order":"string — medical English, echo CLINICAL PROFILE","pcf_priority":"string — echo CLINICAL PROFILE P/C/F line","reasoning":"string — (1) lab synthesis + profile + macro order, (2) burn/deficit/kcal, (3) P/C/F/Fi with cited labs/CGM","rules_advice":"omit when aligned; else string"}
\`\`\``;

/** Nutritionist-only Gemini revision — input is full MACRO REVISION context block. */
export function buildMacroRevisionGeminiPrompt(
  contextBlock: string,
  lang?: UserLanguage | null,
): string {
  return `${MACRO_REVISION_PROMPT}${langInstruction(lang)}

---

## Macro revision data

${contextBlock}`;
}

/** Nutritionist-only Gemini revision — input is full MACRO REVISION context block. */
export async function reviseMacroTargetsWithGemini(
  contextBlock: string,
  lang?: UserLanguage | null,
): Promise<MacroSuggestion> {
  const prompt = buildMacroRevisionGeminiPrompt(contextBlock, lang);

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({ temperature: 0, maxOutputTokens: 8192 }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini macro revision error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  const candidate = json?.candidates?.[0];
  const finishReason: string = candidate?.finishReason ?? 'UNKNOWN';
  const raw: string = extractGeminiText(candidate);
  if (!raw) throw new Error(`Empty AI macro revision (${finishReason})`);

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  try {
    const parsed = JSON.parse(cleaned) as MacroSuggestion & { rules_advice?: unknown };
    const rules_advice = normalizeRulesAdvice(parsed.rules_advice);
    const clinical_profile = String(parsed.clinical_profile ?? '').trim() || undefined;
    const macro_order = String(parsed.macro_order ?? '').trim() || undefined;
    const pcf_priority = String(parsed.pcf_priority ?? '').trim() || undefined;
    return {
      protein_g: Math.round(Number(parsed.protein_g) || 0),
      fat_g: Math.round(Number(parsed.fat_g) || 0),
      carb_g: Math.round(Number(parsed.carb_g) || 0),
      fiber_g: Math.round(Number(parsed.fiber_g) || 0),
      kcal: Math.round(Number(parsed.kcal) || 0),
      diet_label: String(parsed.diet_label ?? 'Custom'),
      reasoning: String(parsed.reasoning ?? ''),
      ...(clinical_profile ? { clinical_profile } : {}),
      ...(macro_order ? { macro_order } : {}),
      ...(pcf_priority ? { pcf_priority } : {}),
      ...(rules_advice ? { rules_advice } : {}),
    };
  } catch {
    const hint = finishReason === 'MAX_TOKENS' ? ' (truncated)' : '';
    throw new Error(`Could not parse macro revision${hint}: ${raw.slice(0, 100)}`);
  }
}

/** AI-only extract of daily macro numbers from nutritionist report text (no regex). */
export type DirectiveMacroSummary = {
  kcal: number | null;
  protein_g: number | null;
  carb_g: number | null;
  fiber_g: number | null;
  net_carb_g: number | null;
};

export async function extractDirectiveMacroSummary(
  fullText: string,
  lang?: UserLanguage | null,
): Promise<DirectiveMacroSummary | null> {
  const text = fullText.trim();
  if (!text) return null;

  const prompt = `Extract the nutritionist's **daily macro / menu summary targets** from this session report.

Return JSON only:
{"kcal":integer|null,"protein_g":integer|null,"carb_g":integer|null,"fiber_g":integer|null,"net_carb_g":integer|null}

Rules:
- Prefer the "סיכום ערכים תזונתיים סופיים" / final nutritional values / macro summary block (e.g. קלוריות: 1,690 → kcal 1690; פחמימות נטו: 43 → net_carb_g 43; סיבים: 37 → fiber_g 37; חלבון: 112 → protein_g 112).
- Ignore thousands separators (1,690 → 1690).
- net_carb_g is C−Fi when stated as פחמימות נטו / net carbs.
- carb_g = total carbs only if stated separately from net; else null (app can derive as net + fiber).
- Use null when a field is not stated. Do not invent ENERGY BALANCE / TDEE numbers.
- Judgment only — understand the document; do not invent values absent from the text.${langInstruction(lang)}

REPORT:
${text}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: geminiGenerationConfig({
      temperature: 0,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;

  const json = await response.json();
  const raw: string = extractGeminiText(json?.candidates?.[0]);
  if (!raw) return null;

  const stripped = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  const cleaned = start !== -1 && end > start ? stripped.slice(start, end + 1) : stripped;

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const num = (v: unknown): number | null => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const out: DirectiveMacroSummary = {
      kcal: num(parsed.kcal),
      protein_g: num(parsed.protein_g),
      carb_g: num(parsed.carb_g),
      fiber_g: num(parsed.fiber_g),
      net_carb_g: num(parsed.net_carb_g),
    };
    if (
      out.kcal == null &&
      out.protein_g == null &&
      out.carb_g == null &&
      out.fiber_g == null &&
      out.net_carb_g == null
    ) {
      return null;
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * @deprecated Use suggestMacroTargets from macroAutoAdjust.ts
 */
export async function suggestDailyMacros(input: MacroSuggestionInput, lang?: UserLanguage | null): Promise<MacroSuggestion> {
  const { suggestMacroTargets } = await import('../logic/macroAutoAdjust');
  const { suggestion } = await suggestMacroTargets({ trigger: 'dashboard-suggest', lang });
  return suggestion;
}

// ─── Coach context & message generation ───────────────────────────────────────

export type CoachTriggerEvent = 'meal' | 'weigh-in' | 'workout' | 'day-close';

export type CoachContext = {
  mentors: MentorType[];
  event: CoachTriggerEvent;
  lang?: UserLanguage | null;
  mentorGender?: Gender | null;
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
  /** All saved lab draws formatted for mentors (from LabLogService). */
  labsAiContext: string | null;
  /** Active nutritionist session directive (authoritative over My Rules). */
  nutritionDirectiveContext: string | null;
  /** Display prefs hint — SI values remain authoritative in USER DATA. */
  unitsDisplayHint?: string | null;
  /** App display prefs for UI that shares this context (chat cards, etc.). */
  unitsPrefs?: UnitsPrefs | null;
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

/**
 * Pace daily targets to the current time of day, so the mentor judges "am I on track" relative to
 * how far the day has advanced — not as if the day were already over. Reach-targets (kcal, protein,
 * fat) are pro-rated linearly across a typical 07:00–23:00 eating window; carbs stay a FULL-DAY
 * ceiling (keto: stay under all day, never pro-rated up).
 */
function formatDayPacingLine(ctx: CoachContext, now = new Date(), omitTargets = false): string {
  const START_HOUR = 7;
  const END_HOUR = 23;
  const hoursIntoDay = now.getHours() + now.getMinutes() / 60;
  const frac = Math.max(0, Math.min(1, (hoursIntoDay - START_HOUR) / (END_HOUR - START_HOUR)));
  const pct = Math.round(frac * 100);
  const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const mt = ctx.macroTarget;

  const base = `DAY PACING (judge intake by the hour, NOT as if the day is over): now ${timeStr}, ~${pct}% through the typical 07:00–23:00 eating window.`;
  const guide =
    !omitTargets && mt != null
      ? ` On-pace-by-now (linear guide for reach-targets): ~${Math.round(mt.kcal * frac)} kcal | P${Math.round(mt.protein_g * frac)}g | F${Math.round(mt.fat_g * frac)}g. Carbs ${Math.round(mt.carb_g)}g is a FULL-DAY CEILING (stay under all day — do NOT pro-rate).`
      : '';
  const rule =
    ' A shortfall that is normal for this hour is NOT a failure; only flag a genuine gap late in the day. Early morning with 0 eaten is expected.';
  return `${base}${guide}${rule}`;
}

/** My Rules — injected into coach panel and chat USER DATA (rawText; matches RulesStrip). */
function formatUserRulesForContext(rules: UserRules): string[] {
  return formatUserRulesLines(rules);
}

/**
 * Single shared header used by BOTH the coach panel and chat: profile, goals/targets, dietary
 * rules (summary + AI-extracted constraint bullets — same as My Rules UI), local time. It carries
 * NO collected day data (meals, energy, CGM, HR, workouts, body) — that all comes from ONE place,
 * the today+yesterday PERIOD REVIEW snapshot. Keeping the data in one source guarantees the panel
 * and chat always see structurally identical today+yesterday data.
 */
function buildProfileTargetsHeader(ctx: CoachContext, opts?: { omitMacroTarget?: boolean }): string[] {
  const omitMacroTarget = opts?.omitMacroTarget === true;
  const { clockLine, guidance } = formatLocalTimeContext();
  const n = (v: number | null | undefined, unit = '') => (v != null ? `${v}${unit}` : '—');
  const bt = ctx.bodyTarget;
  const mt = ctx.macroTarget;
  return [
    clockLine,
    `TIME-AWARE COACHING: ${guidance}`,
    formatDayPacingLine(ctx, new Date(), omitMacroTarget),
    formatActiveMentorsLine(ctx.mentors),
    `Profile: sex ${ctx.gender ?? 'unknown'}, age ${n(ctx.age)}, height ${n(ctx.heightCm, ' cm')}, language ${ctx.lang?.label ?? 'English'}`,
    ...(ctx.unitsDisplayHint ? [ctx.unitsDisplayHint] : []),
    `Goals: target weight ${n(bt?.targetWeight_kg ?? null, ' kg')} | target fat ${n(bt?.targetFatPct ?? null, '%')} | target muscle ${n(bt?.targetMuscleMass_kg ?? null, ' kg')} | start weight ${n(ctx.startWeight_kg, ' kg')} | start muscle ${n(ctx.startMuscle_kg, ' kg')}`,
    ...(!omitMacroTarget
      ? [`Daily macro target: ${n(mt?.kcal ?? null, ' kcal')} | P ${n(mt?.protein_g ?? null, 'g')} | C ${n(mt?.carb_g ?? null, 'g')} | F ${n(mt?.fat_g ?? null, 'g')} | Fi ${n(mt?.fiber_g ?? null, 'g')}`]
      : []),
    ...(ctx.nutritionDirectiveContext ? [ctx.nutritionDirectiveContext] : []),
    ...(ctx.userRules ? formatUserRulesForContext(ctx.userRules) : []),
    ...(ctx.labsAiContext ? [ctx.labsAiContext] : []),
  ].filter((l): l is string => Boolean(l));
}

/**
 * Coach header = shared profile/targets header + the coaching EVENT. All day data (meals, energy,
 * CGM, HR, workouts, body) is supplied by the PERIOD REVIEW snapshot in generateCoachMessage —
 * the SAME source chat uses — so there is no second, divergent "today" computation.
 */
function buildCoachDataBlock(ctx: CoachContext): string {
  const lines = buildProfileTargetsHeader(ctx);
  lines.splice(3, 0, `EVENT: ${ctx.event}`);
  return lines.join('\n');
}

/**
 * Chat header — identical shared profile/targets header. The collected day DATA (body, energy,
 * food, CGM, HR, workouts for today + yesterday) is injected in full via the always-on 2-day
 * snapshot (see buildChatContextBlocks) — the same source the coach panel uses.
 */
function buildChatDataBlock(ctx: CoachContext, opts?: { omitMacroTarget?: boolean }): string {
  return buildProfileTargetsHeader(ctx, opts).join('\n');
}

/** Used when the always-on today+yesterday snapshot is injected (not an explicit /N review). */
const DEFAULT_SNAPSHOT_INSTRUCTION =
  'The block above (titled PERIOD REVIEW) is your COMPLETE data for today and yesterday — body composition incl. visceral and BMR, 24/7 heart rate, energy balance, full food logs, full CGM with meal impact, every workout with HR, AND the full per-sample CGM series ("CGM ALL READINGS", every ~5 min with HH:MM timestamps). It is your source of truth; cite exact numbers from it. You CAN answer "what is my latest glucose reading / its time?" from the CGM ALL READINGS line (and the "Latest reading this day"), and you CAN judge a specific spike/drop by reading the timestamped samples around a meal time. Do NOT dump or list the whole block — answer the user\'s actual question concisely and mention only what is relevant.';

export async function generateCoachMessage(ctx: CoachContext): Promise<CoachMessage> {
  await assertCanSpendCredits('ai_coach');

  const systemPrompt = buildMentorSystemPrompt(ctx.mentors);
  const dataBlock = buildCoachDataBlock(ctx);
  // Same full today+yesterday snapshot the chat mentors get — so action items are derived from
  // the complete picture (yesterday, 24/7 HR, visceral, full CGM), not just today's summary.
  const snapshot = await buildPeriodReviewBlock(
    { mode: 'days', days: 2 },
    ctx.macroTarget,
    ctx.glucoseHistory,
  ).catch(() => '');

  const jsonExample = coachJsonExample(ctx);
  const carbTarget = ctx.macroTarget?.carb_g;
  const proteinTarget = ctx.macroTarget?.protein_g;

  const snapshotSection = snapshot
    ? `\n\n${snapshot}\n(The PERIOD REVIEW above is your COMPLETE today+yesterday data and your ONLY source for collected values — body incl. visceral + BMR, 24/7 HR, energy in/out/balance, full food logs, full CGM with meal impact, every workout with HR. Read all numbers from it; the USER DATA header above carries only profile, goals and macro targets for the autoCheckType keys.)`
    : '';

  const prompt = `${systemPrompt}

USER DATA:
${dataBlock}${snapshotSection}

Respond with JSON only (no markdown, no prose):
${jsonExample}

Rules:
- Output keys: "summary", "wins", "improve", "actionItems". Include ONLY active mentors as keys inside wins/improve and as "mentor" tags in actionItems.
- "summary": 1–2 sentences blending the day's headline across all mentors, with specific numbers, matched to LOCAL TIME NOW. Not a per-mentor paragraph.
- "wins" and "improve": objects keyed by mentor ("nutritionist", "coach", "doctor"). For EACH active mentor give 0–3 short bullets from that mentor's lens (Nutritionist → food/macros/CGM; Coach → composition/training/recovery; Doctor → safety/clinical). Cite numbers. Empty array is allowed.
- "actionItems": 1–2 PER ACTIVE mentor, each **must** include English "mentor": "nutritionist"|"coach"|"doctor". Max 8 words each, concrete and actionable for THIS time of day, same language as summary. Never omit mentor — the app does not infer mentor from item text.
  - Nutritionist 🥗 items: food/macros/CGM (autoCheckType: carbs_under_target / protein_over_target / calorie_deficit / meal_logged when it fits).
  - Coach 💪 items: movement, muscle, training, or body-composition (autoCheckType null).
  - Doctor 🩺 items: safety / clinical follow-up (autoCheckType null).
- autoCheckType keys are always English: "carbs_under_target", "protein_over_target", "calorie_deficit", "meal_logged", or null.
- carbs_under_target MUST cite carb target ${carbTarget != null ? `${Math.round(carbTarget)}g` : 'from the Daily macro target line'} — never use generic 20g keto defaults
- protein_over_target MUST cite protein target ${proteinTarget != null ? `${Math.round(proteinTarget)}g` : 'from the Daily macro target line'}
- Dietary rules in USER DATA (My Rules) override any generic diet assumptions; when asked what the user's rules are, quote the My Rules text verbatim — do NOT paraphrase vaguely or invent rules
- When LAB RESULTS is in USER DATA, never claim labs are missing; cite exact values for cholesterol, CBC, kidney, liver, glucose when relevant; informational only — not a diagnosis
- If event is meal: focus on remaining macros for the day. If weigh-in: trend vs target, muscle vs start. If workout: calorie budget + HR during session vs resting baseline from the WORKOUTS lines in the PERIOD REVIEW.
- Do NOT repeat data the user already sees on the dashboard
- If Nutritionist 🥗 is active and the PERIOD REVIEW has CGM/glucose data, the nutritionist's wins/improve should include a short qualitative glucose verdict (stable / needs improvement); cite avg/min/max only when clearly notable or concerning
- NEVER say "no CGM data" when the PERIOD REVIEW has glucose/meal-impact samples — say synced; if meal window not ready, cite today avg/min/max anyway
- CGM DATE SPAN (mandatory): only state a day count that appears in the PERIOD REVIEW / CGM stats block. The default window is today + yesterday — do NOT say "3 days" or "this week" unless a wider window is loaded. If unsure, say "the available CGM window".
- Glucose numbers belong to the Nutritionist 🥗 ONLY (in their wins/improve); the Doctor 🩺 adds safety interpretation without restating the same avg/min/max${coachJsonLangInstruction(ctx.lang)}`;

  const glucoseCoachRule = buildCgmMentorRules(ctx, { glucoseDeepDive: false });

  const body = {
    contents: [{ role: 'user', parts: [{ text: `${prompt}${glucoseCoachRule}${genderInstruction(ctx)}` }] }],
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

  let parsed: {
    summary?: string;
    wins?: unknown;
    improve?: unknown;
    text?: string;
    mentorLines?: MentorLines;
    actionItems: Array<{ text: string; autoCheckType: string | null; mentor?: string }>;
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Could not parse coach message: ${raw.slice(0, 100)}`);
  }

  const actionItems = normalizeCoachActionItems(parsed.actionItems, ctx);
  const wins = parseMentorBulletMap(parsed.wins, ctx);
  const improve = parseMentorBulletMap(parsed.improve, ctx);
  const summaryText = typeof parsed.summary === 'string' ? normalizeMentorChatText(parsed.summary) : '';

  // Back-compat: older messages used text/mentorLines. New format leads with summary; keep a
  // non-empty `text` so any legacy reader (and the collapsed one-liner fallback) still works.
  let text = summaryText;
  let mentorLines: MentorLines | undefined;
  if (!text) {
    const resolved = await resolveCoachReplyText(parsed as Record<string, unknown>, ctx);
    text = resolved.text;
    mentorLines = resolved.mentorLines;
  }

  reportAiUsage('ai_coach', undefined, geminiUsageFromResponse(json, GEMINI_MODEL));

  return {
    id: `coach-${Date.now()}`,
    text,
    mentorLines,
    summary: summaryText || undefined,
    wins,
    improve,
    actionItems,
    triggerEvent: ctx.event,
    generatedAt: new Date().toISOString(),
    mealCountAtGeneration: ctx.mealCount,
    generatedLangCode: ctx.lang?.code ?? 'en',
  };
}
// ─── Free chat with mentors ────────────────────────────────────────────────────

export type MentorChatReply = {
  text: string;
  mentorLines?: MentorLines;
};

const MENTOR_ONLY_HINT: Record<MentorType, string> = {
  doctor: 'You are ONLY the Doctor 🩺 in this reply — clinical safety angle only. Do not speak as nutritionist or coach.',
  nutritionist:
    'You are ONLY the Nutritionist 🥗 in this reply — food, macros, qualitative CGM angle only. No mg/dL unless user asked for numbers. Do not speak as doctor or coach.',
  coach: 'You are ONLY the Coach 💪 in this reply — body composition, training, movement angle only. Do not speak as doctor or nutritionist.',
};

function chatErrorMessage(lang?: UserLanguage | null): string {
  const code = lang?.code ?? 'en';
  return code === 'he'
    ? 'סליחה, לא הצלחתי להשיב הפעם. נסה/י שוב בעוד רגע.'
    : 'Sorry, I could not reply this time. Please try again in a moment.';
}

/**
 * Pull the user-facing text out of a strict JSON chat envelope ({"response":"…"}).
 * Only the parsed "response" field is shown — never raw model output (no leak-stripping game).
 */
function parseChatEnvelope(raw: string): string {
  const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try {
    const obj = JSON.parse(stripped);
    if (obj && typeof obj.response === 'string') return obj.response.trim();
  } catch {
    // Sometimes a valid object is wrapped in stray prose — grab the first {...} block.
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj && typeof obj.response === 'string') return obj.response.trim();
      } catch {
        /* fall through to truncation salvage */
      }
    }
    // Truncated JSON (token ceiling mid-string): pull the text after "response":".
    const salvage = salvageTruncatedResponse(stripped);
    if (salvage) return salvage;
  }
  return '';
}

/** Recover the prose from a cut-off {"response":"…  envelope that never closed. */
function salvageTruncatedResponse(stripped: string): string | null {
  const keyIdx = stripped.indexOf('"response"');
  if (keyIdx === -1) return null;
  const colon = stripped.indexOf(':', keyIdx);
  if (colon === -1) return null;
  const firstQuote = stripped.indexOf('"', colon + 1);
  if (firstQuote === -1) return null;
  let body = stripped.slice(firstQuote + 1);
  // Drop a trailing closing quote/brace if present.
  body = body.replace(/"\s*\}?\s*$/, '');
  const unescaped = body
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .trim();
  return unescaped.length > 0 ? unescaped : null;
}

type GeminiChatPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

/** Usage from the most recent fetchGeminiChat call — read right after the awaited chain (analytics only). */
let lastChatGeminiUsage: GeminiUsageReport | null = null;

async function fetchGeminiChat(contents: Array<{ role: string; parts: GeminiChatPart[] }>): Promise<string> {
  const body = {
    contents,
    generationConfig: geminiGenerationConfig({
      // Thinking tokens count against maxOutputTokens. Dynamic (-1) thinking could consume the
      // whole ceiling on long /7 /30 reviews and truncate the answer mid-word, so bound it and
      // leave the bulk of the budget for the visible reply.
      temperature: 0.4,
      maxOutputTokens: 32768,
      thinkingBudget: 8192,
      // JSON mode without responseSchema — schema-constrained decoding treated Hebrew gershayim
      // (ASCII ") as end-of-string and cut replies at ק"ג / מ"ג. Prompt enforces valid JSON instead.
      responseMimeType: 'application/json',
    }),
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
  lastChatGeminiUsage = geminiUsageFromResponse(json, GEMINI_MODEL);
  return parseChatEnvelope(extractGeminiText(json?.candidates?.[0]));
}

/**
 * PART C — short, intent-specific instruction appended to the user's message.
 * Returns '' when no special steering is needed (continuity rules carry the rest).
 */
function buildTurnHint(
  mentor: MentorType,
  intent: ChatIntent,
  ctx: CoachContext,
  historyLen: number,
  glucoseDeepDive: boolean,
): string {
  const hasCgm = Boolean(ctx.todayMealGlucoseDetail) || (ctx.glucoseHistory?.length ?? 0) > 0;

  if (mentor === 'coach') {
    if (intent === 'today_progress') {
      return 'Outline: TODAY WORKOUTS (if any) → macros vs target → balance/deficit → one concrete next step. Do not repeat unchanged stats from prior coach replies.';
    }
    if (intent === 'activity') {
      return 'Cite TODAY WORKOUTS by name (activity, duration, kcal, HR). If none logged, say so once.';
    }
  }

  if (mentor === 'nutritionist') {
    if (intent === 'glucose' && hasCgm) {
      return glucoseDeepDive
        ? 'DEEP DIVE: quote avg/min/max (mg/dL), day/night if in block, range %. Name foods if MEAL GLUCOSE links spikes.'
        : 'One qualitative glucose verdict only — stable / in range / elevated / low-side. NO mg/dL. Offer "want the numbers?" if useful.';
    }
    if (intent === 'today_progress') {
      return 'Brief status: macros vs target. At most one qualitative CGM phrase (stable/elevated) — no mg/dL unless not yet mentioned qualitatively today.';
    }
    if (intent === 'food_target') {
      return 'Answer the fat/protein/hunger question directly. At most weave glucose qualitatively — no stats block.';
    }
    if (intent === 'nutrition_knowledge') {
      return 'Food-science / micronutrient question: LEAD with your best estimate from logged meals (food names + grams) and standard USDA-style tables — give rough daily grams and ω3:ω6 ratio when asked (e.g. ~3–5g ω-3, ratio ~1:1–1:3). Label numbers as estimated. Do NOT open with "data not in the app" or refuse. One brief caveat at the end is OK. NO glucose opener.';
    }
  }

  if (mentor === 'doctor' && intent === 'glucose' && hasCgm) {
    return glucoseDeepDive
      ? 'Clinical safety on the numbers in USER DATA; add the compression-low caveat when lows are present.'
      : 'Clinical safety in plain language — stable vs concern. NO mg/dL unless urgent; offer detail if needed.';
  }

  if (mentor === 'doctor' && intent === 'nutrition_knowledge') {
    return 'Nutrient / fatty-acid question: answer from standard references when USER DATA lacks per-food fatty acids. Relate to the user\'s labs (e.g. LDL, kidney) when relevant. NO glucose opener unless glycemic impact is the question.';
  }

  if (intent === 'general' && historyLen > 0) {
    return 'Answer the latest question only — skip re-listing daily stats already covered in earlier turns.';
  }

  return '';
}

function buildChatContextBlocks(
  ctx: CoachContext,
  message: string,
  yesterdaySummary: string | null,
  mentor: MentorType,
  historyLen: number,
): {
  dataBlock: string;
  periodRequest: ReturnType<typeof detectPeriodReviewQuery>;
  yesterdayChatLine: string;
  periodSection: Promise<string>;
  userMessage: string;
  intent: ChatIntent;
  dataScopeBlock: string;
  glucoseDeepDive: boolean;
} {
  const periodRequest = detectPeriodReviewQuery(message);
  const dataBlock = buildChatDataBlock(ctx, { omitMacroTarget: Boolean(periodRequest) });
  const intent = detectChatIntent(message, { hasPeriodReview: Boolean(periodRequest) });
  const dataScopeBlock = buildDataScopeBlock(ctx, historyLen, periodRequest);
  const glucoseDeepDive = isGlucoseDeepDiveQuery(message);

  // Always inject the FULL today+yesterday snapshot (no summarizing). An explicit /N request
  // widens the window and uses raw eaten data only (no saved macro targets).
  const reviewRequest: PeriodReviewRequest = periodRequest ?? { mode: 'days', days: 2 };
  const snapshot = buildPeriodReviewBlock(
    reviewRequest,
    periodRequest ? null : ctx.macroTarget,
    ctx.glucoseHistory,
    {
      includeLabHistory: Boolean(periodRequest),
      rawDataOnly: Boolean(periodRequest),
    },
  );
  const snapshotInstruction = periodRequest ? PERIOD_REVIEW_CHAT_INSTRUCTION : DEFAULT_SNAPSHOT_INSTRUCTION;
  const periodSection = snapshot.then((block) =>
    block ? `\n\n${block}\n\n${snapshotInstruction}` : '',
  );

  const yesterdayChatLine = yesterdaySummary ? `\nYesterday chat summary: ${yesterdaySummary}` : '';

  let userMessage = message;
  if (periodRequest) {
    if (isGlucoseQuery(message)) {
      if (glucoseDeepDive) {
        userMessage = `${message}\n\nAnswer from the PERIOD REVIEW block. For day vs night averages use the CGM DAY vs NIGHT section (07:00–23:00 day, 23:00–07:00 night). For windows ≤7 days each day includes CGM ALL READINGS (HH:MM=mg/dL) for time-specific analysis. Ignore sensor warm-up (first 24h) lows unless the user asks about them.`;
      } else {
        userMessage = `${message}\n\nAnswer from the PERIOD REVIEW block with a qualitative glucose summary (stable / in range / elevated / low-side). NO mg/dL unless clinically urgent.`;
      }
    } else {
      userMessage = `${message}\n\nUse the PERIOD REVIEW block in context. What was good, what to improve, 2–4 concrete suggestions. For food: cite eaten macro averages and daily totals from the block (not saved app targets). For GLUCOSE: qualitative verdict only unless user asked for numbers.`;
    }
  } else {
    const hint = buildTurnHint(mentor, intent, ctx, historyLen, glucoseDeepDive);
    if (hint) userMessage = `${message}\n\n${hint}`;
  }

  return {
    dataBlock,
    periodRequest,
    yesterdayChatLine,
    periodSection,
    userMessage,
    intent,
    dataScopeBlock,
    glucoseDeepDive,
  };
}

/**
 * PART 0 — the mentor's entry-point knowledge: it always holds TODAY's full app data and
 * YESTERDAY's full app data. This block states that fixed scope (not conditional) so the
 * mentor knows its baseline; actual values/absences live in the USER DATA blocks below.
 * Anything older needs /N AND must be verified against a loaded PERIOD REVIEW before citing.
 */
function buildDataScopeBlock(
  ctx: CoachContext,
  historyLen: number,
  periodRequest: ReturnType<typeof detectPeriodReviewQuery>,
): string {
  const periodLine = periodRequest
    ? `\n- PERIOD REVIEW (${periodRequest.mode === 'yesterday' ? 'yesterday' : `${periodRequest.days} days`}) IS loaded for this turn — use it for the longer-range answer (verify each number appears in that block before citing).`
    : '';
  const firstTurnNote =
    historyLen === 0
      ? 'first message in this tab today'
      : `${historyLen} earlier turn(s) in this tab today — read them before replying`;

  return `YOUR DATA AT THE START OF THIS CHAT (${firstTurnNote}):
You always hold the user's FULL, UN-SUMMARIZED app data for TODAY and YESTERDAY, in the data
block below (titled PERIOD REVIEW). Both days include every metric the app collects:
  - Body composition: weight, fat mass, muscle mass, visceral fat index, BMR
  - Energy: calories eaten, total burned (BMR + passive + workouts), balance
  - Heart rate: 24/7 readings (avg/min/max) plus HR during each workout
  - Meals: every meal with foods, grams, and macros
  - Glucose (CGM): full readings with per-meal impact, avg/min/max, time-in-range
  - Workouts: each Withings session — activity, duration, kcal, HR

This today+yesterday set is the COMPLETE data in front of you. Read exact numbers from that
block. If it shows a category empty (e.g. "No meals logged"), report that — never ask the user
to type data already present here (meals, workouts, HR, glucose, body, visceral).

OLDER HISTORY (anything before yesterday):
- It is NOT in front of you unless a longer PERIOD REVIEW window is loaded this turn.${periodLine}
- If the user asks about a longer range (a week, a month, "lately") and only the 2-day window is
  loaded, do NOT guess or assume the history exists. Give the today/yesterday view and ask the
  user to load it: "for a full 7-day review send /7" (also /30, /N up to 128 days).
- Nutritionist tab only: /macros (or /macro) runs the full 7-day macro revision pipeline and shows a confirm card — cite that flow when asked how to update targets; do not invent different numbers in prose.
- Whatever window is loaded, verify each figure actually appears in the block before citing —
  if a personal synced metric is missing or empty there, say so rather than inventing it.
- This rule applies to USER-SYNCED metrics only (glucose, weight, labs, logged macros) — NOT to
  food-science estimates (omega, vitamins, sodium per food). For those, estimate from meal names
  + grams using standard nutrition tables; label as estimated. Never refuse a food question.`;
}

function buildChatSystemText(
  mentor: MentorType | null,
  ctx: CoachContext,
  blocks: {
    dataBlock: string;
    yesterdayChatLine: string;
    periodSection: string;
    dataScopeBlock: string;
    intent: ChatIntent;
    historyLen: number;
    glucoseDeepDive: boolean;
  },
): string {
  const mentors = mentor ? [mentor] : ctx.mentors;
  const systemPrompt = buildMentorSystemPrompt(mentors);
  const onlyHint = mentor ? `\n${MENTOR_ONLY_HINT[mentor]}` : '';
  const coachRules = mentor === 'coach' ? buildCoachMentorRules(ctx) : '';
  const cgmRules = buildCgmMentorRules(ctx, { glucoseDeepDive: blocks.glucoseDeepDive });
  const isFirstTurn = blocks.historyLen === 0;

  return `${systemPrompt}${blocks.yesterdayChatLine}${onlyHint}

${blocks.dataScopeBlock}

CONVERSATION (mandatory):
- Read prior turns in this tab before replying.
- Each user message is prefixed with the time it was sent, e.g. "[13:25] ...". Use it to relate the question to timestamped CGM/meal data and time of day; do NOT repeat the "[HH:MM]" prefix back in your reply.
- Answer the user's LATEST question first — do not re-open with a full daily summary unless they asked for status/overview${isFirstTurn ? ' (first turn: short qualitative glucose headline if relevant — no mg/dL unless DEEP DIVE)' : ''}.
- Do NOT repeat stats, warnings, or CGM summaries you already gave in this tab today unless (a) the user asks again about glucose/status, or (b) new meals/workouts/sync materially changed the numbers.
- Reference earlier thread naturally when relevant ("as I mentioned…", "following up on…").
- Keep replies 2–4 sentences unless the user asked for a period review (/7, /30) or a detailed meal breakdown.

PROFILE / GOALS / SETTINGS:
${blocks.dataBlock}
${blocks.periodSection}

You are responding in a free chat. Be concise, specific, and supportive.
Match your tone to LOCAL TIME NOW and TIME-AWARE COACHING above — early morning means gentle, not alarmist.
OUTPUT FORMAT (mandatory): respond with a single JSON object and nothing else — {"response":"<your reply to the user>"}. Put your entire user-facing reply inside the "response" string. Never write THOUGHT, planning, reasoning, or any text outside this JSON object.
Inside "response" write plain prose only — no **bold**, no markdown headers, no nested JSON. 2–4 sentences; use specific numbers for macros/food/workouts — but CGM defaults to qualitative (stable/elevated) unless DEEP DIVE. Period reviews /7 /30 with explicit number requests may be longer. Use \n for line breaks inside the string.
JSON STRING SAFETY (mandatory): never put ASCII double-quote (") inside the response text — it breaks JSON. Prefer English unit symbols (kcal, mg/dL, kg, g) which need no quotes. Do NOT write Hebrew unit abbreviations (קק"ל, מ"ג/ד"ל, ק"ג) — use kcal / mg/dL / kg instead. If Hebrew/Arabic prose needs an apostrophe abbreviation for a non-unit word, use ' not ". If you must use a double-quote, escape it as \\".
All of today's and yesterday's data — body, visceral, BMR, energy, 24/7 HR, meals, CGM, workouts — is in the data block above. Use exact numbers for food/macros/workouts when asked; for glucose use qualitative verdict by default (see CGM rules below).
When the user asks about their dietary rules, restrictions, or what is written in My Rules: quote the My Rules block in USER DATA / PROFILE verbatim — do NOT paraphrase vaguely.
When the user asks about blood tests, labs, cholesterol, or בדיקות דם: quote exact values from LAB RESULTS in USER DATA; for trends across older draws use the LAB HISTORY block when /N loaded — never invent values.
GENERAL FOOD KNOWLEDGE (mandatory): Meal logs list calories, protein, carbs, fat, fiber — NOT fatty acids, vitamins, or minerals per item. When the user asks about those (omega-3/6, nutrients, daily averages, food quality): ALWAYS answer — estimate from logged food names + grams using USDA-style reference tables. Give rough grams and ratios when asked (e.g. daily ω-3 ~3–5g, ω3:ω6 ~1:1–1:3). Lead with the estimate; do NOT open with "data not in the app" or refuse. One brief "estimated from food tables" caveat at the end is enough. Distinguish exact USER DATA (logged P/C/F/Fi) from estimated micronutrients.
CGM DEFAULT: qualitative one-liner (stable / in range / elevated / low-side). DEEP DIVE (user asked for numbers, avg, analysis, or /7+/30 with glucose stats): cite avg/min/max, day/night, meal spikes from the block. On food/hunger/recipe/nutrient questions without glucose ask: answer that topic — at most one qualitative glucose phrase; NO glucose opener on omega/vitamin/nutrient threads.
CGM DATE SPAN (mandatory): only cite "N days" when the data block explicitly states N days. If unsure, say "the available CGM window" — never invent 7 days. Slash commands (/7, /30) widen the loaded window — use that block's day count.
When the user asks for a longer review (/7, /30), analyze the full snapshot (body, energy, HR, food, workouts): what went well, what to improve, specific next steps.
When GLUCOSE & FOOD IMPACT is present and user asked for detail: cite which foods preceded spikes and recommend swaps for repeat offenders.
Users can request any window via slash commands: /1 or /yesterday, /7, /30, /100 (up to 128 days). Nutritionist tab: /macros for daily macro target revision (7-day data).
Ignore any earlier chat messages where you said data was unavailable; always use the data block above.${coachRules}${cgmRules}${genderInstruction(ctx)}${langInstruction(ctx.lang)}`;
}

/**
 * Tags each user turn with the time it was asked, so the mentor can relate a question to the
 * timestamped CGM/meal data (e.g. "the spike at 13:10" vs a question asked at 13:25) and judge
 * how much of the day had elapsed when the user asked. Includes the date when not today.
 */
function formatChatMsgTimePrefix(iso: string, now = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `[${time}] `;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `[${date} ${time}] `;
}

async function chatWithSingleMentor(
  mentor: MentorType,
  message: string,
  history: ChatMessage[],
  ctx: CoachContext,
  yesterdaySummary: string | null,
  imageBase64?: string | null,
  imageMimeType: string = 'image/jpeg',
): Promise<string> {
  const blocks = buildChatContextBlocks(ctx, message, yesterdaySummary, mentor, history.length);
  const periodSection = await blocks.periodSection;
  const systemText = buildChatSystemText(mentor, ctx, {
    dataBlock: blocks.dataBlock,
    yesterdayChatLine: blocks.yesterdayChatLine,
    periodSection,
    dataScopeBlock: blocks.dataScopeBlock,
    intent: blocks.intent,
    historyLen: history.length,
    glucoseDeepDive: blocks.glucoseDeepDive,
  });
  const recentHistory = history.slice(-CHAT_HISTORY_MAX_MESSAGES);
  const contents = [
    { role: 'user', parts: [{ text: `SYSTEM CONTEXT:\n${systemText}\n\nAcknowledge.` }] },
    { role: 'model', parts: [{ text: '{"response":"Understood. I will reply only as {\\"response\\":\\"...\\"} with plain prose inside. Hebrew units use single quotes (ק\'ג, מ\'ג/ד\'ל) never ASCII double-quotes inside the string."}' }] },
    ...recentHistory.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{
        text: m.role === 'assistant'
          ? stripLeakedThinking(m.text)
          : `${formatChatMsgTimePrefix(m.sentAt)}${m.text}`,
      }],
    })),
    {
      role: 'user',
      parts: [
        ...(imageBase64
          ? [{ inline_data: { mime_type: imageMimeType, data: imageBase64 } } satisfies GeminiChatPart]
          : []),
        {
          text: `${formatChatMsgTimePrefix(new Date().toISOString())}${blocks.userMessage}${
            imageBase64 ? '\n[User attached a photo — read it and answer using their goals and rules above.]' : ''
          }`,
        },
      ],
    },
  ];

  const raw = await fetchGeminiChat(contents);
  if (!raw.trim()) return '';
  return normalizeMentorChatText(raw.trim());
}

export async function chatWithMentor(
  mentor: MentorType,
  message: string,
  history: ChatMessage[],
  ctx: CoachContext,
  yesterdaySummary: string | null,
  imageBase64?: string | null,
  imageMimeType?: string,
): Promise<string> {
  await assertCanSpendCredits('ai_chat');

  const scopedCtx: CoachContext = { ...ctx, mentors: [mentor] };
  const text = await chatWithSingleMentor(
    mentor,
    message,
    history,
    scopedCtx,
    yesterdaySummary,
    imageBase64,
    imageMimeType,
  );
  if (!text.trim()) return chatErrorMessage(ctx.lang);
  reportAiUsage('ai_chat', undefined, lastChatGeminiUsage);
  lastChatGeminiUsage = null;
  return text;
}

/** @deprecated Use chatWithMentor for tabbed chat. */
export async function chatWithMentors(
  message: string,
  history: ChatMessage[],
  ctx: CoachContext,
  yesterdaySummary: string | null,
): Promise<MentorChatReply> {
  const mentor = ctx.mentors[0] ?? 'coach';
  const text = await chatWithMentor(mentor, message, history, ctx, yesterdaySummary);
  return { text };
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

/**
 * Product Help Q&A (prompt98) — not mentor chat.
 * Answers in appLocale via langInstruction; knowledge is English only.
 */
export async function askAppHelp(
  question: string,
  lang?: UserLanguage | null,
): Promise<string> {
  const q = question.trim();
  if (!q) return '';

  await assertCanSpendCredits('ai_help');

  const knowledge = buildAppHelpKnowledgeBlock();

  const system = `You are Healthings product Help — an in-app guide for how to use the Healthings MediLab app.
Rules:
- Answer ONLY from the KNOWLEDGE block below. If something is not covered, say you are not sure and suggest Profile & Settings or the website help pages.
- Do NOT give medical diagnoses, prescriptions, or personalised clinical advice. Redirect health coaching to the AI chat mentors.
- Do NOT invent buttons, screens, or settings that are not in KNOWLEDGE.
- Be concise (short paragraphs or a short numbered list). Prefer concrete taps: e.g. Profile & Settings → Gear.
- Keep unit symbols and brand/acronym glossary in English (kcal, kg, CGM, Withings, BMR, AI).
${langInstruction(lang)}

KNOWLEDGE:
${knowledge}`;

  const body = {
    contents: [
      { role: 'user', parts: [{ text: `SYSTEM:\n${system}\n\nAcknowledge.` }] },
      {
        role: 'model',
        parts: [{ text: 'Understood. I will answer only from KNOWLEDGE as product Help.' }],
      },
      { role: 'user', parts: [{ text: q }] },
    ],
    generationConfig: geminiGenerationConfig({
      temperature: 0.3,
      maxOutputTokens: 2048,
      thinkingBudget: 0,
    }),
  };

  const response = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Gemini help error ${response.status}: ${err.slice(0, 200)}`);
  }

  const json = await response.json();
  reportAiUsage('ai_help', undefined, geminiUsageFromResponse(json, GEMINI_MODEL));
  const raw = extractGeminiText(json?.candidates?.[0]).trim();
  if (!raw) {
    return lang && lang.code !== 'en'
      ? `Sorry — I could not answer that. Try rephrasing. (${lang.label})`
      : 'Sorry — I could not answer that. Try rephrasing, or open website help from a ? on Quick Start.';
  }
  return raw;
}
