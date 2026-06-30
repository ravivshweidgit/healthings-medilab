/**
 * TargetService — stores user birthdate and height locally.
 * Both values are set once and rarely change.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deriveFiberTargetFromCarbs } from '../logic/macroFiberCoupling';

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

// ─── Mentor voice gender (Hebrew/Arabic titles) ─────────────────────────────

const MENTOR_GENDER_KEY = 'mentor_gender';

/** Affects possessive mentor titles in Hebrew/Arabic (e.g. הרופאה שלי vs הרופא שלי). */
export async function getMentorGender(): Promise<Gender | null> {
  const raw = await AsyncStorage.getItem(MENTOR_GENDER_KEY);
  if (raw === 'male' || raw === 'female' || raw === 'other') return raw;
  return null;
}

export async function setMentorGender(gender: Gender): Promise<void> {
  await AsyncStorage.setItem(MENTOR_GENDER_KEY, gender);
}

// ─── Height ───────────────────────────────────────────────────────────────────

/** User-entered height in cm (`user_height_cm`). Not synced from devices. */
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
  /** AI-suggested weeks to reach target (informational). */
  estimatedWeeks?: number;
  /** User-set weeks to reach target — drives macro kcal/deficit when set. */
  targetWeeks?: number;
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
  constraints: string[];    // AI-understood bullets — injected into coach panel + chat
  aiContext: string;        // deprecated — no longer generated; kept for storage compat
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
  fiber_g?: number;
  kcal: number;
  diet_label: string;
  reasoning: string;
  /** Nutrition profile from last macro analysis (computed + AI). */
  clinical_profile?: string;
  macro_order?: string;
  pcf_priority?: string;
  rulesContext: string;
  mentors: MentorType[];
  aiSuggested: { protein_g: number; fat_g: number; carb_g: number; fiber_g?: number; kcal: number };
  analyzedAt: string;
};

export const DEFAULT_FIBER_TARGET_G = 30;

export function resolveFiberTarget_g(target: Pick<DailyMacroTarget, 'fiber_g' | 'aiSuggested'>): number {
  return target.fiber_g ?? target.aiSuggested?.fiber_g ?? DEFAULT_FIBER_TARGET_G;
}

export function withFiberTarget(t: DailyMacroTarget): DailyMacroTarget {
  const fiber_g = resolveFiberTarget_g(t);
  return {
    ...t,
    fiber_g,
    aiSuggested: { ...t.aiSuggested, fiber_g: t.aiSuggested?.fiber_g ?? fiber_g },
  };
}

export async function getMacroTarget(): Promise<DailyMacroTarget | null> {
  const raw = await AsyncStorage.getItem(MACRO_TARGET_KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as DailyMacroTarget;
    if (t.fiber_g == null) {
      const migrated = withFiberTarget(t);
      await AsyncStorage.setItem(MACRO_TARGET_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return t;
  } catch { return null; }
}

export async function saveMacroTarget(t: DailyMacroTarget, opts?: { userEdited?: boolean }): Promise<void> {
  const fiber_g = deriveFiberTargetFromCarbs(t.carb_g);
  const sanitized = withFiberTarget({ ...t, fiber_g });
  await AsyncStorage.setItem(MACRO_TARGET_KEY, JSON.stringify(sanitized));
  if (opts?.userEdited) {
    await setMacroManualLock(true);
  }
}

export async function clearMacroTarget(): Promise<void> {
  await AsyncStorage.removeItem(MACRO_TARGET_KEY);
}

// ─── Macro auto-adjust state (prompt35) ───────────────────────────────────────

const MACRO_AUTO_ADJUST_KEY = 'macro_auto_adjust_state';

export type MacroAutoAdjustState = {
  lastWeightKg: number;
  /** Withings body scan timestamp — dedupe weigh-in macro runs (weight alone can repeat). */
  lastWeighInAt: string | null;
  lastLabReportId: string | null;
  lastKcal: number;
  lastAdjustedAt: string;
  manualLock: boolean;
};

const DEFAULT_MACRO_AUTO_ADJUST: MacroAutoAdjustState = {
  lastWeightKg: 0,
  lastWeighInAt: null,
  lastLabReportId: null,
  lastKcal: 0,
  lastAdjustedAt: '',
  manualLock: false,
};

export async function getMacroAutoAdjustState(): Promise<MacroAutoAdjustState> {
  const raw = await AsyncStorage.getItem(MACRO_AUTO_ADJUST_KEY);
  if (!raw) return { ...DEFAULT_MACRO_AUTO_ADJUST };
  try {
    return { ...DEFAULT_MACRO_AUTO_ADJUST, ...(JSON.parse(raw) as MacroAutoAdjustState) };
  } catch {
    return { ...DEFAULT_MACRO_AUTO_ADJUST };
  }
}

export async function saveMacroAutoAdjustState(state: MacroAutoAdjustState): Promise<void> {
  await AsyncStorage.setItem(MACRO_AUTO_ADJUST_KEY, JSON.stringify(state));
}

export async function setMacroManualLock(locked: boolean): Promise<void> {
  const state = await getMacroAutoAdjustState();
  await saveMacroAutoAdjustState({ ...state, manualLock: locked });
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
  /** Which mentor owns this item (prompt25). Optional for back-compat with old data. */
  mentor?: MentorType;
};

export type CoachMessage = {
  id: string;
  text: string;
  /** Per-mentor lines when 2+ mentors — drives separate UI cards. */
  mentorLines?: Partial<Record<MentorType, string>>;
  /** prompt25 — 1–2 sentence headline blending all mentors. */
  summary?: string;
  /** prompt25 — per-mentor "what's going well" bullets. */
  wins?: Partial<Record<MentorType, string[]>>;
  /** prompt25 — per-mentor "what to improve" bullets. */
  improve?: Partial<Record<MentorType, string[]>>;
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

// ─── Chat history (per mentor, per day) ───────────────────────────────────────

const CHAT_HISTORY_KEY = 'chat_history_';          // + 'YYYY-MM-DD' + '_' + mentor
const CHAT_HISTORY_LEGACY_SUFFIX = '';             // legacy: chat_history_YYYY-MM-DD

/** Max turns kept on device and sent to Gemini per mentor per calendar day. */
export const CHAT_HISTORY_MAX_MESSAGES = 1000;

/** Tab order in chat UI. */
export const MENTOR_CHAT_TAB_ORDER: MentorType[] = ['nutritionist', 'coach', 'doctor'];

export type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  sentAt: string;  // ISO
};

function chatHistoryStorageKey(date: string, mentor: MentorType): string {
  return `${CHAT_HISTORY_KEY}${date}_${mentor}`;
}

export async function getChatHistory(date: string, mentor: MentorType): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(chatHistoryStorageKey(date, mentor));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function getAllChatHistories(
  date: string,
  mentors: MentorType[],
): Promise<Partial<Record<MentorType, ChatMessage[]>>> {
  const out: Partial<Record<MentorType, ChatMessage[]>> = {};
  await Promise.all(
    mentors.map(async (m) => {
      out[m] = await getChatHistory(date, m);
    }),
  );
  return out;
}

export async function hasAnyChatHistory(date: string, mentors: MentorType[]): Promise<boolean> {
  for (const m of mentors) {
    if ((await getChatHistory(date, m)).length > 0) return true;
  }
  const legacy = await AsyncStorage.getItem(`${CHAT_HISTORY_KEY}${date}${CHAT_HISTORY_LEGACY_SUFFIX}`);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as ChatMessage[];
      return parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

export async function appendChatMessage(date: string, mentor: MentorType, msg: ChatMessage): Promise<void> {
  const history = await getChatHistory(date, mentor);
  history.push(msg);
  const trimmed =
    history.length > CHAT_HISTORY_MAX_MESSAGES
      ? history.slice(-CHAT_HISTORY_MAX_MESSAGES)
      : history;
  await AsyncStorage.setItem(chatHistoryStorageKey(date, mentor), JSON.stringify(trimmed));
}

/** Clear one mentor's chat, or all mentors for the day when mentor omitted. */
export async function clearChatHistory(date: string, mentors: MentorType[], mentor?: MentorType): Promise<void> {
  if (mentor) {
    await AsyncStorage.removeItem(chatHistoryStorageKey(date, mentor));
    return;
  }
  await Promise.all(mentors.map((m) => AsyncStorage.removeItem(chatHistoryStorageKey(date, m))));
  await AsyncStorage.removeItem(`${CHAT_HISTORY_KEY}${date}${CHAT_HISTORY_LEGACY_SUFFIX}`);
}

const CHAT_YESTERDAY_SUMMARY_KEY = 'chat_yesterday_summary';

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
  { id: 'qq-macros', label: '/macros' },
];

const DEFAULT_QUICK_QUESTIONS_BY_LANG: Record<string, QuickQuestion[]> = {
  en: DEFAULT_QUICK_QUESTIONS,
  he: [
    { id: 'qq-default-1', label: 'סיכום אתמול' },
    { id: 'qq-default-2', label: 'סיכום שבועי' },
    { id: 'qq-default-3', label: 'סיכום חודשי' },
    { id: 'qq-macros', label: '/macros' },
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
