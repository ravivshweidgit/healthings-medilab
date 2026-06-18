/**
 * Gemini 2.5 Flash — food photo analysis + conversational correction.
 * Calls the REST API directly (no Node SDK needed on-device).
 */

import { GEMINI_API_KEY } from '@env';
import {
  combineMentorLines,
  extractMentorLinesFromParsed,
  hasSeparateMentorVoices,
  normalizeMentorChatText,
  resolveMentorReplyText,
  type MentorLines,
} from '../logic/mentorChatText';
import type { MentorType, DailyMacroTarget, BodyTarget, UserRules, CoachMessage, CoachActionItem, AutoCheckType, ChatMessage, UserLanguage, Gender } from './TargetService';
import type { ParsedLabPdf, LabPanelType, LabResult, LabResultFlag } from './LabLogService';
import type { TimePoint } from './HealthConnectService';
import {
  buildPeriodReviewBlock,
  detectPeriodReviewQuery,
  PERIOD_REVIEW_CHAT_INSTRUCTION,
  type PeriodReviewRequest,
} from './ReviewService';
import { detectChatIntent, type ChatIntent } from '../logic/chatIntent';
import { resolveMentorGender } from '../logic/mentorLabels';
import { formatUserRulesLines, formatUserRulesBlock } from '../logic/userRulesContext';

/** Returns a language instruction line to append to any AI prompt. */
function langInstruction(lang?: UserLanguage | null): string {
  if (!lang || lang.code === 'en') return '';
  return `\nRespond entirely in ${lang.label} (${lang.code}). All text in the response must be in ${lang.label}.`;
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
  const gendered = code === 'es' || code === 'fr' || code === 'ru' || code === 'de' || code === 'pt' || code === 'it';
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
  if (!lang || lang.code === 'en') return '';
  return `\nLANGUAGE (mandatory): Write "summary", every wins[]/improve[] bullet, AND every actionItems[].text in ${lang.label} (${lang.code}) only. Keep mentor tags and autoCheckType values exactly as English keys (nutritionist/coach/doctor, carbs_under_target, etc.). Do NOT use English for user-visible strings.`;
}

/** Mandatory language for meal JSON — name_local is the display name shown in the app. */
function foodJsonLangInstruction(lang?: UserLanguage | null): string {
  if (!lang || lang.code === 'en') return '';
  return `\nLANGUAGE (mandatory): Write "description", "suggestion", and "rule_message" in ${lang.label} (${lang.code}).
For each item: "name" = canonical ENGLISH name (for nutrition lookup); "name_local" = the SAME food written in ${lang.label} (${lang.code}) — REQUIRED, this is the name shown to the user in the app. Never leave "name_local" in English when the app language is not English. Keep numbers (grams, kcal, macros) unchanged.`;
}

export function buildFoodSystemPrompt(lang?: UserLanguage | null, userRules?: UserRules | null): string {
  const langNote = foodJsonLangInstruction(lang);
  let prompt = langNote ? `${SYSTEM_PROMPT}${langNote}` : SYSTEM_PROMPT;
  if (userRules) {
    prompt += `\n\nUSER DIETARY RULES (same as Nutritionist mentor — apply on every analysis):\n${formatUserRulesBlock(userRules)}`;
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

function isCoachActionItem(item: CoachActionItem): boolean {
  if (item.autoCheckType != null) return false;
  return /muscle|training|walk|workout|stretch|movement|composition|שריר|אימון|הליכה|מתיחות|תנועה|composition|fat loss|ירידה/i.test(
    item.text,
  );
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

/** Infer the owning mentor for an untagged item from its autoCheckType / text. */
function inferActionItemMentor(item: CoachActionItem, ctx: CoachContext): MentorType | undefined {
  if (item.autoCheckType != null && ctx.mentors.includes('nutritionist')) return 'nutritionist';
  if (ctx.mentors.includes('coach') && isCoachActionItem(item)) return 'coach';
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
- "name" = canonical English food name; "name_local" = same food in the user's app language (for English users, name_local may equal name).
- Estimate grams from plate size (standard plate = 26cm).
- Split dishes into ingredients. Use USDA values.
- "fiber_g" = dietary fiber only (not total carbs); estimate per ingredient.
- For corrections: return full updated JSON, keep all items; keep both name fields in the correct languages.
- If unsure: best guess with confidence "low".
- When USER DIETARY RULES are provided: set rule_conflict true only for items that clearly violate those rules (explicit or clearly implied). Set rule_message to one short sentence why. Otherwise rule_conflict false and rule_message "".`;

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
): Promise<{ result: GeminiAnalysisResult; updatedHistory: GeminiTurn[] }> {
  if (MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 800));
    const newTurn: GeminiTurn = { role: 'user', text: userText, imageBase64: imageBase64 ?? undefined };
    const modelTurn: GeminiTurn = { role: 'model', text: JSON.stringify(MOCK_RESULT) };
    return { result: MOCK_RESULT, updatedHistory: [...history, newTurn, modelTurn] };
  }

  const systemPromptWithLang = buildFoodSystemPrompt(lang, userRules);

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
    'You are a certified clinical nutritionist AI with CGM expertise. Continuous glucose is a PRIMARY input equal to macros — you MUST relate food, meal timing, and carbs to glucose response whenever CGM data is in context. Quote avg/min/max mg/dL; assess if glucose looks good or needs improvement; link spikes to foods when meals are logged. FIBER ↔ CARB: fiber is inside total carbs on labels — fiber_g must never exceed carb_g; for carb ≤60g aim fiber ≈ ½×carbs; for higher carbs aim ~30g fiber not ½ of carbs.',
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
Use mentorLines with separate "doctor" and "nutritionist" keys — one sentence each with numbers. NEVER one blended paragraph.`,

  'doctor+coach': `You advise as Doctor 🩺 AND Coach 💪 — both active; both must inform every reply.
Doctor: health risk, safe rate of loss, red flags, recovery; CGM when present.
Coach: body composition, muscle preservation, training, performance, deficit strategy.
Use mentorLines with separate "doctor" and "coach" keys — one sentence each with numbers. NEVER one blended paragraph.`,

  'nutritionist+coach': `You advise as Nutritionist 🥗 AND Coach 💪 — both active; BOTH must speak in every reply.
Nutritionist lens: food quality, macros, meal timing, CGM glycemic response (avg/min/max when data present) — NOT optional.
Coach lens: body composition, muscle mass, training recovery, progressive fat loss, performance — NOT just food.
CRITICAL: Do NOT let nutrition dominate. The Coach must always have a visible angle (muscle, composition, movement, recovery, tomorrow's training).
Use mentorLines with separate "nutritionist" and "coach" keys — one sentence each with numbers. NEVER one blended paragraph.
In actionItems: include at least one food/macro or CGM-aware item AND at least one body-composition or activity item.
If conflict: food quality (Nutritionist) > reckless deficit (Coach) — but Coach still contributes.`,

  'doctor+nutritionist+coach': `You advise as Doctor 🩺, Nutritionist 🥗, AND Coach 💪 — all three active; each must inform every reply.
Priority when advice conflicts: safety (Doctor) > food quality + CGM (Nutritionist) > performance (Coach).
Nutritionist MUST use CGM data when in context — avg/min/max mg/dL, good vs needs improvement.
Use mentorLines with separate "doctor", "nutritionist", and "coach" keys — one sentence each with numbers. NEVER one blended paragraph.
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
- NEVER say "no CGM data" (or equivalent) when USER DATA includes MEAL GLUCOSE, TODAY CGM, or RECENT CGM with samples — CGM is synced; say post-meal window not ready yet if Meals with usable window is 0/N
- When MEAL GLUCOSE shows "CGM samples in sync" but usable window is 0/N, cite today's avg/min/max from the block and explain meal-level response is not ready yet — do NOT claim CGM is unavailable
- When glucose is the topic OR this is the first reply in the tab today OR the user asked for status/overview: quote avg, min, max (mg/dL) and range % (below 70 / 70–100 / above 100) and low-day count when present
- For TODAY and YESTERDAY you ALSO have the full per-sample series ("CGM ALL READINGS", every ~5 min with HH:MM timestamps). You CAN state the latest reading and its time, and analyze a specific spike/drop by reading the timestamped samples around a meal time — NEVER say you only have daily summaries when this line is present
- On follow-ups about food targets, hunger, or fat/protein without a glucose question: answer that topic directly — do NOT re-open with the same CGM block you already gave this tab
- Mention compression lows if relevant: sleeping on the sensor can falsely lower readings — isolated low days may be artifact
- Exclude sensor warm-up (first 24h after install) and statistically excluded rare sensor-error days — see filter lines in USER DATA
- Without meal logs: still assess CGM; urge logging meals to link spikes to specific foods
- Do NOT give vague CGM summaries ("elevated days") without numbers`;
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
- constraints: max 5 items, max 8 words each — primary source injected into coach/chat USER DATA; write clear actionable bullets
- aiContext: max 20 words, compact fallback only (macro-target reasoning when constraints are empty)

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

// ─── Meal save rule check (same My Rules block as mentor chat) ────────────────

export type MealRuleCheckIssue = {
  itemName: string;
  severity: 'warning' | 'critical';
  message: string;
};

export async function checkMealAgainstUserRules(
  items: FoodItem[],
  userRules: UserRules,
  lang?: UserLanguage | null,
): Promise<MealRuleCheckIssue[]> {
  if (MOCK_MODE || items.length === 0) return [];

  const itemLines = items
    .map((item) => {
      const label = item.name_local ?? item.name;
      return `- ${label} (${item.name}): ${item.grams}g, ${item.kcal} kcal, P${item.protein_g}g C${item.carb_g}g F${item.fat_g}g Fi${item.fiber_g ?? 0}g`;
    })
    .join('\n');

  const prompt = `You are the Nutritionist mentor. The user is about to SAVE this meal to their food log.
Apply MY RULES exactly as you would in chat — including implied goals (e.g. lower cholesterol, heart-healthy fats only).

${formatUserRulesBlock(userRules)}

MEAL TO SAVE:
${itemLines}

Return JSON ONLY (no markdown):
{"issues":[{"itemName":"<display name from meal list>","severity":"critical"|"warning","message":"<one short sentence why it violates rules>"}]}

Rules for your response:
- Flag ONLY clear violations of the user's rules (explicit or clearly implied from their text).
- Do NOT flag foods the user prefers or that fit the rules.
- itemName must match the meal label (before the English name in parentheses).
- If no violations, return {"issues":[]}
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

function normalizeLabResults(raw: unknown): LabResult[] {
  if (!Array.isArray(raw)) return [];
  const out: LabResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const value = Number(o.value);
    if (!Number.isFinite(value)) continue;
    const code = String(o.code ?? o.nameOriginal ?? 'UNKNOWN').trim().replace(/\s+/g, '_').toUpperCase();
    out.push({
      code,
      name: String(o.name ?? code),
      nameOriginal: o.nameOriginal != null ? String(o.nameOriginal) : undefined,
      value,
      unit: String(o.unit ?? '').trim(),
      flag: normalizeLabFlag(o.flag),
      referenceText: o.referenceText != null ? String(o.referenceText) : undefined,
    });
  }
  return out;
}

export async function parseLabReportPdf(
  pdfBase64: string,
  lang?: UserLanguage | null,
  useMock = false,
): Promise<LabPdfParseResult> {
  if (useMock || MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 600));
    return { parsed: LAB_PARSE_MOCK, confidence: 'high' };
  }

  const prompt = `You are a medical lab report parser. Extract structured data from this PDF lab printout (Israeli Clalit online format).

Output JSON only, no markdown:
{"labProvider":"clalit","patientName":"...","patientId":"...","collectedAt":"2026-06-16T10:10:00+03:00","printedAt":"2026-06-16T15:52:00+03:00","panelType":"chemistry","panelNote":null,"results":[{"code":"GLUCOSE","name":"Glucose","nameOriginal":"GLUCOSE","value":91,"unit":"mg/dL","flag":"unknown","referenceText":null}]}

Rules:
- Extract EVERY numeric test row from the table; do not invent tests not in the PDF.
- Parse specimen date/time from "תאריך הבדיקה ושעת ביצועה" → ISO 8601 with +03:00 offset.
- panelType: "chemistry" (metabolic/lipids/liver/renal), "cbc" (blood count/differential), or "other".
- Normalize codes: CHOLESTEROL-LDL calc → CHOLESTEROL_LDL, NEUT.abs → NEUT_ABS.
- flag: "high", "low", "normal", or "unknown" (from norm column or footer Hebrew notes).
- Skip non-numeric QC rows (HEMOLYTIC, LIPEMIC, ICTERIC) — put text in panelNote if needed.
- Attach footer reference notes to matching tests when present.
- labProvider: "clalit" if from כללית, else "unknown".${langInstruction(lang)}`;

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

  const results = normalizeLabResults(data.results);
  if (results.length === 0) {
    throw new Error('No lab results found in PDF — try exporting again from Clalit');
  }

  const parsed: ParsedLabPdf = {
    labProvider: data.labProvider === 'clalit' ? 'clalit' : 'unknown',
    patientName: data.patientName != null ? String(data.patientName) : undefined,
    patientId: data.patientId != null ? String(data.patientId) : undefined,
    collectedAt: String(data.collectedAt ?? new Date().toISOString()),
    printedAt: data.printedAt != null ? String(data.printedAt) : undefined,
    panelType: normalizePanelType(data.panelType),
    results,
    panelNote: data.panelNote != null ? String(data.panelNote) : undefined,
  };

  return { parsed, confidence: results.length >= 5 ? 'high' : 'low' };
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
  kcal: number;
  diet_label: string;
  reasoning: string;
};

const FIBER_CARB_RULE = `
FIBER ↔ CARB (mandatory):
- Dietary fiber is counted INSIDE total carbohydrates on food labels — fiber_g must NEVER exceed carb_g.
- When daily carb target ≤ 60g: recommend fiber_g ≈ round(½ × carb_g) from quality low-carb sources.
- When carb target > 60g: recommend fiber_g ≈ 30g/day (standard band), NOT ½ of carbs.
- If user's rules imply very low carbs (keto, <30g), proactively set realistic fiber — do not default both to 30g.`;

const MACRO_REVISION_PROMPT = `You are a certified clinical nutritionist revising DAILY MACRO TARGETS (not meal advice).

${FIBER_CARB_RULE}

CGM (7d block — GLUCOSE & FOOD IMPACT + MEAL GLUCOSE):
- MUST cite period avg, min, max (mg/dL) in reasoning when CGM present.
- Use meal-spike / problem-food lines to justify carb and fiber targets.
- kcal deficit/surplus comes mainly from weight goal + 7d avg burn, moderated by CGM stability.
- Lows <70 (trusted days): do not cut kcal further — note in reasoning.

RULES (strict priority):
1. My Rules are HARD constraints (carb cap, keto, etc.) — never violate.
2. At/past weight goal → maintenance kcal ≈ 7d avg burn, not continued large deficit.
3. Loss vs gain from start weight vs target weight; taper deficit/surplus by kg-to-goal.
4. Labs: informational only — kidney/lipids may cap protein/fat increases, not diagnose.
5. kcal must align with 4×P + 4×C + 9×F within ~50 kcal.

OUTPUT (JSON only, no markdown):
{"protein_g":135,"fat_g":110,"carb_g":30,"fiber_g":20,"kcal":2190,"diet_label":"Low carb · deficit","reasoning":"7d avg burn 2439; weight 81.4→80; CGM stable"}`;

/** Nutritionist-only Gemini revision — input is full MACRO REVISION context block. */
export async function reviseMacroTargetsWithGemini(
  contextBlock: string,
  lang?: UserLanguage | null,
): Promise<MacroSuggestion> {
  const prompt = `${MACRO_REVISION_PROMPT}${langInstruction(lang)}

MACRO REVISION DATA:
${contextBlock}`;

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
    const parsed = JSON.parse(cleaned) as MacroSuggestion;
    return {
      protein_g: Math.round(Number(parsed.protein_g) || 0),
      fat_g: Math.round(Number(parsed.fat_g) || 0),
      carb_g: Math.round(Number(parsed.carb_g) || 0),
      fiber_g: Math.round(Number(parsed.fiber_g) || 0),
      kcal: Math.round(Number(parsed.kcal) || 0),
      diet_label: String(parsed.diet_label ?? 'Custom'),
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch {
    const hint = finishReason === 'MAX_TOKENS' ? ' (truncated)' : '';
    throw new Error(`Could not parse macro revision${hint}: ${raw.slice(0, 100)}`);
  }
}

/**
 * @deprecated Use suggestMacroTargets from macroAutoAdjust.ts
 */
export async function suggestDailyMacros(input: MacroSuggestionInput, lang?: UserLanguage | null): Promise<MacroSuggestion> {
  const { suggestMacroTargets } = await import('../logic/macroAutoAdjust');
  return suggestMacroTargets({ trigger: 'dashboard-suggest', lang });
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
  /** Latest lab draw formatted for mentors (from LabLogService). */
  labsAiContext: string | null;
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
function formatDayPacingLine(ctx: CoachContext, now = new Date()): string {
  const START_HOUR = 7;
  const END_HOUR = 23;
  const hoursIntoDay = now.getHours() + now.getMinutes() / 60;
  const frac = Math.max(0, Math.min(1, (hoursIntoDay - START_HOUR) / (END_HOUR - START_HOUR)));
  const pct = Math.round(frac * 100);
  const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const mt = ctx.macroTarget;

  const base = `DAY PACING (judge intake by the hour, NOT as if the day is over): now ${timeStr}, ~${pct}% through the typical 07:00–23:00 eating window.`;
  const guide =
    mt != null
      ? ` On-pace-by-now (linear guide for reach-targets): ~${Math.round(mt.kcal * frac)} kcal | P${Math.round(mt.protein_g * frac)}g | F${Math.round(mt.fat_g * frac)}g. Carbs ${Math.round(mt.carb_g)}g is a FULL-DAY CEILING (stay under all day — do NOT pro-rate).`
      : '';
  const rule =
    ' A shortfall that is normal for this hour is NOT a failure; only flag a genuine gap late in the day. Early morning with 0 eaten is expected.';
  return `${base}${guide}${rule}`;
}

/** My Rules AI summary — injected into coach panel and chat USER DATA (matches RulesStrip UI). */
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
function buildProfileTargetsHeader(ctx: CoachContext): string[] {
  const { clockLine, guidance } = formatLocalTimeContext();
  const n = (v: number | null | undefined, unit = '') => (v != null ? `${v}${unit}` : '—');
  const bt = ctx.bodyTarget;
  const mt = ctx.macroTarget;
  return [
    clockLine,
    `TIME-AWARE COACHING: ${guidance}`,
    formatDayPacingLine(ctx),
    formatActiveMentorsLine(ctx.mentors),
    `Profile: sex ${ctx.gender ?? 'unknown'}, age ${n(ctx.age)}, height ${n(ctx.heightCm, ' cm')}, language ${ctx.lang?.label ?? 'English'}`,
    `Goals: target weight ${n(bt?.targetWeight_kg ?? null, ' kg')} | target fat ${n(bt?.targetFatPct ?? null, '%')} | target muscle ${n(bt?.targetMuscleMass_kg ?? null, ' kg')} | start weight ${n(ctx.startWeight_kg, ' kg')} | start muscle ${n(ctx.startMuscle_kg, ' kg')}`,
    `Daily macro target: ${n(mt?.kcal ?? null, ' kcal')} | P ${n(mt?.protein_g ?? null, 'g')} | C ${n(mt?.carb_g ?? null, 'g')} | F ${n(mt?.fat_g ?? null, 'g')} | Fi ${n(mt?.fiber_g ?? null, 'g')}`,
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
function buildChatDataBlock(ctx: CoachContext): string {
  return buildProfileTargetsHeader(ctx).join('\n');
}

/** Used when the always-on today+yesterday snapshot is injected (not an explicit /N review). */
const DEFAULT_SNAPSHOT_INSTRUCTION =
  'The block above (titled PERIOD REVIEW) is your COMPLETE data for today and yesterday — body composition incl. visceral and BMR, 24/7 heart rate, energy balance, full food logs, full CGM with meal impact, every workout with HR, AND the full per-sample CGM series ("CGM ALL READINGS", every ~5 min with HH:MM timestamps). It is your source of truth; cite exact numbers from it. You CAN answer "what is my latest glucose reading / its time?" from the CGM ALL READINGS line (and the "Latest reading this day"), and you CAN judge a specific spike/drop by reading the timestamped samples around a meal time. Do NOT dump or list the whole block — answer the user\'s actual question concisely and mention only what is relevant.';

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
- "actionItems": 1–2 PER ACTIVE mentor, each tagged with "mentor". Max 8 words each, concrete and actionable for THIS time of day, same language as summary.
  - Nutritionist 🥗 items: food/macros/CGM (autoCheckType: carbs_under_target / protein_over_target / calorie_deficit / meal_logged when it fits).
  - Coach 💪 items: movement, muscle, training, or body-composition (autoCheckType null).
  - Doctor 🩺 items: safety / clinical follow-up (autoCheckType null).
- autoCheckType keys are always English: "carbs_under_target", "protein_over_target", "calorie_deficit", "meal_logged", or null.
- carbs_under_target MUST cite carb target ${carbTarget != null ? `${Math.round(carbTarget)}g` : 'from the Daily macro target line'} — never use generic 20g keto defaults
- protein_over_target MUST cite protein target ${proteinTarget != null ? `${Math.round(proteinTarget)}g` : 'from the Daily macro target line'}
- Dietary rules in USER DATA (My Rules — AI understood bullets) override any generic diet assumptions; when asked what the user's rules are, quote those bullets — do NOT paraphrase vaguely or invent rules
- When LAB RESULTS is in USER DATA, never claim labs are missing; cite exact values for cholesterol, CBC, kidney, liver, glucose when relevant; informational only — not a diagnosis
- If event is meal: focus on remaining macros for the day. If weigh-in: trend vs target, muscle vs start. If workout: calorie budget + HR during session vs resting baseline from the WORKOUTS lines in the PERIOD REVIEW.
- Do NOT repeat data the user already sees on the dashboard
- If Nutritionist 🥗 is active and the PERIOD REVIEW has CGM/glucose data, the nutritionist's wins/improve MUST cite glucose avg/min/max (mg/dL) with a good-vs-needs-improvement verdict
- NEVER say "no CGM data" when the PERIOD REVIEW has glucose/meal-impact samples — say synced; if meal window not ready, cite today avg/min/max anyway
- CGM DATE SPAN (mandatory): only state a day count that appears in the PERIOD REVIEW / CGM stats block. The default window is today + yesterday — do NOT say "3 days" or "this week" unless a wider window is loaded. If unsure, say "the available CGM window".
- Glucose numbers belong to the Nutritionist 🥗 ONLY (in their wins/improve); the Doctor 🩺 adds safety interpretation without restating the same avg/min/max${coachJsonLangInstruction(ctx.lang)}`;

  const glucoseCoachRule = buildCgmMentorRules(ctx);

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
    'You are ONLY the Nutritionist 🥗 in this reply — food, macros, CGM angle only. Do not speak as doctor or coach.',
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
      return 'Quote avg/min/max (mg/dL) and range % from USER DATA. Name foods if MEAL GLUCOSE links spikes.';
    }
    if (intent === 'today_progress') {
      return 'Brief status: macros vs target, plus one CGM line only if you have not already stated it in this tab today.';
    }
    if (intent === 'food_target') {
      return 'Answer the fat/protein/hunger question directly. Do NOT open with a full CGM recap unless the user asked about glucose.';
    }
  }

  if (mentor === 'doctor' && intent === 'glucose' && hasCgm) {
    return 'Clinical safety on the numbers in USER DATA; add the compression-low caveat when lows are present.';
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
} {
  const dataBlock = buildChatDataBlock(ctx);
  const periodRequest = detectPeriodReviewQuery(message);
  const intent = detectChatIntent(message, { hasPeriodReview: Boolean(periodRequest) });
  const dataScopeBlock = buildDataScopeBlock(ctx, historyLen, periodRequest);

  // Always inject the FULL today+yesterday snapshot (no summarizing). An explicit /N request
  // widens the window; otherwise default to a 2-day (yesterday + today) snapshot.
  const reviewRequest: PeriodReviewRequest = periodRequest ?? { mode: 'days', days: 2 };
  const snapshot = buildPeriodReviewBlock(
    reviewRequest,
    ctx.macroTarget,
    ctx.glucoseHistory,
    { includeLabHistory: Boolean(periodRequest) },
  );
  const snapshotInstruction = periodRequest ? PERIOD_REVIEW_CHAT_INSTRUCTION : DEFAULT_SNAPSHOT_INSTRUCTION;
  const periodSection = snapshot.then((block) =>
    block ? `\n\n${block}\n\n${snapshotInstruction}` : '',
  );

  const yesterdayChatLine = yesterdaySummary ? `\nYesterday chat summary: ${yesterdaySummary}` : '';

  let userMessage = message;
  if (periodRequest) {
    userMessage = `${message}\n\nUse the PERIOD REVIEW block in context. What was good, what to improve, 2–4 concrete suggestions. For GLUCOSE: quote period avg, min, max (mg/dL) from the block; ignore sensor warm-up (first 24h) lows; do NOT give vague CGM summaries.`;
  } else {
    const hint = buildTurnHint(mentor, intent, ctx, historyLen);
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
  if a metric is missing or empty there, say so rather than inventing it.`;
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
  },
): string {
  const mentors = mentor ? [mentor] : ctx.mentors;
  const systemPrompt = buildMentorSystemPrompt(mentors);
  const onlyHint = mentor ? `\n${MENTOR_ONLY_HINT[mentor]}` : '';
  const coachRules = mentor === 'coach' ? buildCoachMentorRules(ctx) : '';
  const cgmRules = buildCgmMentorRules(ctx);
  const isFirstTurn = blocks.historyLen === 0;

  return `${systemPrompt}${blocks.yesterdayChatLine}${onlyHint}

${blocks.dataScopeBlock}

CONVERSATION (mandatory):
- Read prior turns in this tab before replying.
- Each user message is prefixed with the time it was sent, e.g. "[13:25] ...". Use it to relate the question to timestamped CGM/meal data and time of day; do NOT repeat the "[HH:MM]" prefix back in your reply.
- Answer the user's LATEST question first — do not re-open with a full daily summary unless they asked for status/overview${isFirstTurn ? ' (this IS the first turn, so an overview is fine here)' : ''}.
- Do NOT repeat stats, warnings, or CGM summaries you already gave in this tab today unless (a) the user asks again about glucose/status, or (b) new meals/workouts/sync materially changed the numbers.
- Reference earlier thread naturally when relevant ("כמו שציינתי…", "בהמשך לשאלה על השומן…").
- Keep replies 2–4 sentences unless the user asked for a period review (/7, /30) or a detailed meal breakdown.

PROFILE / GOALS / SETTINGS:
${blocks.dataBlock}
${blocks.periodSection}

You are responding in a free chat. Be concise, specific, and supportive.
Match your tone to LOCAL TIME NOW and TIME-AWARE COACHING above — early morning means gentle, not alarmist.
OUTPUT FORMAT (mandatory): respond with a single JSON object and nothing else — {"response":"<your reply to the user>"}. Put your entire user-facing reply inside the "response" string. Never write THOUGHT, planning, reasoning, or any text outside this JSON object.
Inside "response" write plain prose only — no **bold**, no markdown headers, no nested JSON. 2–4 sentences with specific numbers (period reviews /7 /30 may be longer). Use \n for line breaks inside the string.
JSON STRING SAFETY (mandatory): never put ASCII double-quote (") inside the response text — it breaks JSON. For Hebrew abbreviations use single quotes instead: ק'ג not ק"ג, מ'ג/ד'ל not מ"ג/ד"ל, ק'ק'ל not קק"ל. If you must use a double-quote in the text, escape it as \\".
All of today's and yesterday's data — body, visceral, BMR, energy, 24/7 HR, meals, CGM, workouts — is in the data block above. When asked about activity, meals, glucose, HR, or body metrics, cite the exact numbers from it; never say data is missing if it appears there.
When the user asks about their dietary rules, restrictions, or what is written in My Rules: quote the bullet list under My Rules — AI understood in PROFILE / GOALS / SETTINGS (same structured summary as the app) — do NOT paraphrase vaguely or repeat raw free-text.
When the user asks about blood tests, labs, cholesterol, or בדיקות דם: quote exact values from LAB RESULTS in USER DATA; for trends across older draws use the LAB HISTORY block when /N loaded — never invent values.
When glucose is the topic, or this is the first reply in the tab today, or the user asked for status/overview: Nutritionist 🥗 leads with glucose interpretation (avg/min/max mg/dL) and Doctor 🩺 adds clinical safety on the same numbers. On follow-ups about food targets, hunger, or fat/protein without a glucose question, answer that topic directly — do NOT re-open with the same CGM block.
CGM DATE SPAN (mandatory): only cite "N days" when the data block explicitly states N days. If unsure, say "the available CGM window" — never invent 7 days. Slash commands (/7, /30) widen the loaded window — use that block's day count.
When the user asks for a longer review (/7, /30), analyze the full snapshot (body, energy, HR, food, workouts): what went well, what to improve, specific next steps.
When GLUCOSE & FOOD IMPACT is present, Nutritionist and Doctor must cite which foods preceded spikes and recommend swaps for repeat offenders.
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
  });
  const recentHistory = history.slice(-20);
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
