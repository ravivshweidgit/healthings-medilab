/**
 * TargetService — stores user birthdate and height locally.
 * Both values are set once and rarely change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BIRTHDATE_KEY = 'user_birthdate';   // ISO date string e.g. "1980-03-15"
const HEIGHT_KEY    = 'user_height_cm';   // shared with WithingsApiService cache
const GENDER_KEY    = 'user_gender';      // 'male' | 'female' | 'other'

export type Gender = 'male' | 'female' | 'other';

// ─── Birthdate ────────────────────────────────────────────────────────────────

/** Returns stored ISO birthdate string or null if not set. */
export async function getBirthdate(): Promise<string | null> {
  return AsyncStorage.getItem(BIRTHDATE_KEY);
}

/** Persists ISO birthdate string (e.g. "1980-03-15"). */
export async function setBirthdate(isoDate: string): Promise<void> {
  await AsyncStorage.setItem(BIRTHDATE_KEY, isoDate);
}

/** Computes full years of age from a stored ISO birthdate string. */
export function computeAge(isoDate: string): number {
  const birth = new Date(isoDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// ─── Gender ───────────────────────────────────────────────────────────────────

export async function getGender(): Promise<Gender | null> {
  const raw = await AsyncStorage.getItem(GENDER_KEY);
  if (raw === 'male' || raw === 'female' || raw === 'other') return raw;
  return null;
}

export async function setGender(gender: Gender): Promise<void> {
  await AsyncStorage.setItem(GENDER_KEY, gender);
}

// ─── Height ───────────────────────────────────────────────────────────────────

/** Returns cached height in cm or null. */
export async function getCachedHeightCm(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(HEIGHT_KEY);
  if (!raw) return null;
  const cm = parseFloat(raw);
  return isNaN(cm) || cm <= 0 ? null : cm;
}

/** Manually store height in cm (e.g. user-entered fallback). */
export async function setHeightCm(cm: number): Promise<void> {
  await AsyncStorage.setItem(HEIGHT_KEY, String(Math.round(cm)));
}

// ─── Body composition target ──────────────────────────────────────────────────

const BODY_TARGET_KEY = 'body_target';

export type BodyTarget = {
  /** User's actual targets (editable, may differ from AI suggestion) */
  targetWeight_kg: number;
  targetFatPct: number;
  targetMuscleMass_kg: number;
  /** AI's original suggestion — always preserved for reference */
  aiWeight_kg: number;
  aiFatPct: number;
  aiMuscle_kg: number;
  /** Baseline at the time target was set */
  startWeight_kg: number;
  startFatPct: number;
  startMuscle_kg: number;
  /** AI reasoning text */
  reasoning: string;
  /** ISO string of when AI ran */
  analyzedAt: string;
  estimatedWeeks?: number;
};

export async function getBodyTarget(): Promise<BodyTarget | null> {
  const raw = await AsyncStorage.getItem(BODY_TARGET_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as BodyTarget; } catch { return null; }
}

export async function saveBodyTarget(target: BodyTarget): Promise<void> {
  await AsyncStorage.setItem(BODY_TARGET_KEY, JSON.stringify(target));
}

export async function clearBodyTarget(): Promise<void> {
  await AsyncStorage.removeItem(BODY_TARGET_KEY);
}

// ─── Mentors ──────────────────────────────────────────────────────────────────

export type MentorType = 'doctor' | 'nutritionist' | 'coach';

const MENTOR_KEY = 'user_mentors';
const DEFAULT_MENTORS: MentorType[] = ['coach', 'nutritionist'];

export async function getMentors(): Promise<MentorType[]> {
  const raw = await AsyncStorage.getItem(MENTOR_KEY);
  if (!raw) return DEFAULT_MENTORS;
  try {
    const parsed = JSON.parse(raw) as MentorType[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MENTORS;
  } catch { return DEFAULT_MENTORS; }
}

export async function saveMentors(mentors: MentorType[]): Promise<void> {
  if (mentors.length === 0) return; // at least one always required
  await AsyncStorage.setItem(MENTOR_KEY, JSON.stringify(mentors));
}

// ─── User rules ───────────────────────────────────────────────────────────────

const USER_RULES_KEY = 'user_rules';

export type UserRules = {
  rawText: string;
  summary: string;          // e.g. "Keto · IF 16:8"
  constraints: string[];    // bullet list extracted by AI
  aiContext: string;        // 1-sentence context passed to every AI call
  analyzedAt: string;
};

export async function getUserRules(): Promise<UserRules | null> {
  const raw = await AsyncStorage.getItem(USER_RULES_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as UserRules; } catch { return null; }
}

export async function saveUserRules(r: UserRules): Promise<void> {
  await AsyncStorage.setItem(USER_RULES_KEY, JSON.stringify(r));
}

export async function clearUserRules(): Promise<void> {
  await AsyncStorage.removeItem(USER_RULES_KEY);
}

// ─── Daily macro target ───────────────────────────────────────────────────────

const MACRO_TARGET_KEY = 'daily_macro_target';

export type DailyMacroTarget = {
  protein_g: number;
  fat_g: number;
  carb_g: number;
  kcal: number;
  diet_label: string;
  reasoning: string;
  rulesContext: string;
  mentors: MentorType[];
  aiSuggested: { protein_g: number; fat_g: number; carb_g: number; kcal: number };
  analyzedAt: string;
};

export async function getMacroTarget(): Promise<DailyMacroTarget | null> {
  const raw = await AsyncStorage.getItem(MACRO_TARGET_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as DailyMacroTarget; } catch { return null; }
}

export async function saveMacroTarget(t: DailyMacroTarget): Promise<void> {
  await AsyncStorage.setItem(MACRO_TARGET_KEY, JSON.stringify(t));
}

export async function clearMacroTarget(): Promise<void> {
  await AsyncStorage.removeItem(MACRO_TARGET_KEY);
}

// ─── User language ────────────────────────────────────────────────────────────

const LANGUAGE_KEY = 'user_language';

export type UserLanguage = {
  code: string;   // BCP-47 e.g. 'en', 'he', 'es', 'fr', 'de', 'ar', 'ru'
  label: string;  // display name e.g. 'English'
};

export const SUPPORTED_LANGUAGES: UserLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'he', label: 'עברית' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ar', label: 'العربية' },
  { code: 'ru', label: 'Русский' },
];

export const DEFAULT_LANGUAGE: UserLanguage = SUPPORTED_LANGUAGES[0];

export async function getLanguage(): Promise<UserLanguage> {
  const raw = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (!raw) return DEFAULT_LANGUAGE;
  try {
    const parsed = JSON.parse(raw) as UserLanguage;
    return parsed?.code ? parsed : DEFAULT_LANGUAGE;
  } catch { return DEFAULT_LANGUAGE; }
}

export async function setLanguage(lang: UserLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, JSON.stringify(lang));
}

// ─── Mentor frequency ─────────────────────────────────────────────────────────

const MENTOR_FREQ_KEY = 'mentor_frequency';

export type MentorFrequency = {
  afterEachMeal: boolean;  // default: true
  minGapHours: number;     // default: 4, range 0–6
};

const DEFAULT_MENTOR_FREQ: MentorFrequency = { afterEachMeal: true, minGapHours: 4 };
const MIN_GAP_HOURS_MIN = 0;
const MIN_GAP_HOURS_MAX = 6;

function clampMinGapHours(n: number): number {
  return Math.min(MIN_GAP_HOURS_MAX, Math.max(MIN_GAP_HOURS_MIN, Math.round(n)));
}

export async function getMentorFrequency(): Promise<MentorFrequency> {
  const raw = await AsyncStorage.getItem(MENTOR_FREQ_KEY);
  if (!raw) return DEFAULT_MENTOR_FREQ;
  try {
    const parsed = JSON.parse(raw) as Partial<MentorFrequency>;
    return {
      afterEachMeal: typeof parsed.afterEachMeal === 'boolean' ? parsed.afterEachMeal : DEFAULT_MENTOR_FREQ.afterEachMeal,
      minGapHours: typeof parsed.minGapHours === 'number'
        ? clampMinGapHours(parsed.minGapHours)
        : DEFAULT_MENTOR_FREQ.minGapHours,
    };
  } catch { return DEFAULT_MENTOR_FREQ; }
}

export async function saveMentorFrequency(f: MentorFrequency): Promise<void> {
  await AsyncStorage.setItem(MENTOR_FREQ_KEY, JSON.stringify({
    ...f,
    minGapHours: clampMinGapHours(f.minGapHours),
  }));
}

// ─── Coach message ────────────────────────────────────────────────────────────

const COACH_MESSAGE_KEY = 'coach_message_today';

export type AutoCheckType =
  | 'carbs_under_target'   // done if todayCarb_g <= macroTarget.carb_g
  | 'protein_over_target'  // done if todayProtein_g >= macroTarget.protein_g * 0.9
  | 'calorie_deficit'      // done if todayEaten < todayBurn
  | 'meal_logged'          // done if mealCount > mealCountAtGeneration
  | null;                  // manual tap only

export type CoachActionItem = {
  id: string;
  text: string;
  done: boolean;
  autoCheckType: AutoCheckType;
};

export type CoachMessage = {
  id: string;
  text: string;
  actionItems: CoachActionItem[];
  triggerEvent: 'meal' | 'weigh-in' | 'workout' | 'day-close';
  generatedAt: string;           // ISO
  mealCountAtGeneration: number;
  generatedLangCode?: string;    // BCP-47 code when message was created
};

export async function getCoachMessage(): Promise<CoachMessage | null> {
  const raw = await AsyncStorage.getItem(COACH_MESSAGE_KEY);
  if (!raw) return null;
  try {
    const msg = JSON.parse(raw) as CoachMessage & { dismissedAt?: string };
    // Recover action items for users who tapped ✕ before dismiss was removed.
    if (msg.dismissedAt) {
      const { dismissedAt: _removed, ...rest } = msg;
      const migrated = rest as CoachMessage;
      await saveCoachMessage(migrated);
      return migrated;
    }
    return msg;
  } catch {
    return null;
  }
}

export async function saveCoachMessage(m: CoachMessage): Promise<void> {
  await AsyncStorage.setItem(COACH_MESSAGE_KEY, JSON.stringify(m));
}

export async function clearCoachMessage(): Promise<void> {
  await AsyncStorage.removeItem(COACH_MESSAGE_KEY);
}

// ─── Chat history ─────────────────────────────────────────────────────────────

const CHAT_HISTORY_KEY = 'chat_history_';          // + 'YYYY-MM-DD'
const CHAT_YESTERDAY_SUMMARY_KEY = 'chat_yesterday_summary';

export type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  sentAt: string;  // ISO
};

export async function getChatHistory(date: string): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(CHAT_HISTORY_KEY + date);
  if (!raw) return [];
  try { return JSON.parse(raw) as ChatMessage[]; } catch { return []; }
}

export async function appendChatMessage(date: string, msg: ChatMessage): Promise<void> {
  const history = await getChatHistory(date);
  history.push(msg);
  const trimmed = history.length > 30 ? history.slice(-30) : history;
  await AsyncStorage.setItem(CHAT_HISTORY_KEY + date, JSON.stringify(trimmed));
}

export async function clearChatHistory(date: string): Promise<void> {
  await AsyncStorage.removeItem(CHAT_HISTORY_KEY + date);
}

export async function getYesterdaySummary(): Promise<string | null> {
  return AsyncStorage.getItem(CHAT_YESTERDAY_SUMMARY_KEY);
}

export async function saveYesterdaySummary(summary: string): Promise<void> {
  await AsyncStorage.setItem(CHAT_YESTERDAY_SUMMARY_KEY, summary);
}

// ─── Quick questions ──────────────────────────────────────────────────────────

const QUICK_QUESTIONS_KEY = 'chat_quick_questions';

export type QuickQuestion = {
  id: string;    // stable UUID
  label: string; // display text, also the message sent
};

const DEFAULT_QUICK_QUESTIONS: QuickQuestion[] = [
  { id: 'qq-default-1', label: 'Yesterday summary' },
  { id: 'qq-default-2', label: 'Weekly summary' },
  { id: 'qq-default-3', label: 'Monthly summary' },
];

const DEFAULT_QUICK_QUESTIONS_BY_LANG: Record<string, QuickQuestion[]> = {
  en: DEFAULT_QUICK_QUESTIONS,
  he: [
    { id: 'qq-default-1', label: 'סיכום אתמול' },
    { id: 'qq-default-2', label: 'סיכום שבועי' },
    { id: 'qq-default-3', label: 'סיכום חודשי' },
  ],
  es: [
    { id: 'qq-default-1', label: 'Revisa mi estado' },
    { id: 'qq-default-2', label: 'Revisa mi última comida' },
    { id: 'qq-default-3', label: '¿Cómo voy hoy?' },
  ],
  fr: [
    { id: 'qq-default-1', label: 'Bilan de ma journée' },
    { id: 'qq-default-2', label: 'Analyser mon dernier repas' },
    { id: 'qq-default-3', label: 'Comment je m\'en sors?' },
  ],
  de: [
    { id: 'qq-default-1', label: 'Status prüfen' },
    { id: 'qq-default-2', label: 'Letzte Mahlzeit prüfen' },
    { id: 'qq-default-3', label: 'Wie laufe ich heute?' },
  ],
  ar: [
    { id: 'qq-default-1', label: 'راجع حالتي' },
    { id: 'qq-default-2', label: 'راجع وجبتي الأخيرة' },
    { id: 'qq-default-3', label: 'كيف حالي اليوم؟' },
  ],
  ru: [
    { id: 'qq-default-1', label: 'Проверь мой статус' },
    { id: 'qq-default-2', label: 'Разбор последнего приёма пищи' },
    { id: 'qq-default-3', label: 'Как у меня дела сегодня?' },
  ],
};

const QUICK_QUESTIONS_LANG_KEY = 'chat_quick_questions_lang';

function defaultQuickQuestions(langCode?: string): QuickQuestion[] {
  return DEFAULT_QUICK_QUESTIONS_BY_LANG[langCode ?? 'en'] ?? DEFAULT_QUICK_QUESTIONS;
}

export async function getQuickQuestions(lang?: UserLanguage | null): Promise<QuickQuestion[]> {
  const code = lang?.code ?? 'en';
  const savedLang = await AsyncStorage.getItem(QUICK_QUESTIONS_LANG_KEY);
  const raw = await AsyncStorage.getItem(QUICK_QUESTIONS_KEY);
  if (raw && savedLang === code) {
    try {
      const parsed = JSON.parse(raw) as QuickQuestion[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fall through */ }
  }
  return defaultQuickQuestions(code);
}

export async function saveQuickQuestions(qs: QuickQuestion[], lang?: UserLanguage | null): Promise<void> {
  await AsyncStorage.setItem(QUICK_QUESTIONS_KEY, JSON.stringify(qs));
  if (lang) await AsyncStorage.setItem(QUICK_QUESTIONS_LANG_KEY, lang.code);
}

/** Reset chips to language defaults (e.g. after user changes language). */
export async function resetQuickQuestionsForLanguage(lang: UserLanguage): Promise<QuickQuestion[]> {
  const qs = defaultQuickQuestions(lang.code);
  await saveQuickQuestions(qs, lang);
  return qs;
}
