/**
 * Mentor chat intent detection (Hebrew + English + a few common languages).
 * Pure functions — used to route per-turn instructions in GeminiService.
 */

export type ChatIntent =
  | 'period_review' // handled by detectPeriodReviewQuery — caller skips turn hint
  | 'today_progress'
  | 'activity'
  | 'glucose'
  | 'meal_review'
  | 'yesterday'
  | 'food_target'
  | 'general';

/** "How am I doing today / today's progress / status" across languages. */
export function isTodayProgressQuery(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /איך אני מתקדם|איך אני מתקדמת|מתקדם\/ת|מה המצב היום|איך הולך היום|איך היה היום|סטטוס היום|איך אני היום/.test(text) ||
    /how am i doing|today'?s progress|how'?s my day|status today|how is my day|progress today/.test(t) ||
    /cómo voy hoy|comment je vais|wie läuft mein tag|как мои дела сегодня/.test(t)
  );
}

/** Workout / training / activity questions. */
export function isActivityQuery(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /פעילות|אימון|אימונים|אופניים|הליכה|ריצה|כמה שרפתי|כמה קלוריות שרפתי|מבחינת פעילות/.test(text) ||
    /activity|workout|training|exercise|cycling|biking|ran today|walk(ed)? today|burned today|calories burned/.test(t) ||
    /actividad|entrenamiento|activité|entraînement|training|trainings|тренировк|активность/.test(t)
  );
}

/** Glucose / CGM / blood sugar questions. */
export function isGlucoseQuery(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /סוכר|גלוקוז|רמת הסוכר|ממוצע סוכר|טווח סוכר|סנסור/.test(text) ||
    /\bcgm\b|glucose|blood sugar|sugar level|time in range|avg glucose/.test(t) ||
    /glucosa|glycémie|glukose|глюкоз|сахар/.test(t)
  );
}

/** Explicit slash command — same pipeline as dashboard Analyze (7d revision context). */
export function isMacroSlashCommand(text: string): boolean {
  const t = text.trim();
  return /^\/macros?\b/i.test(t) || /^\/מקרו\b/.test(t);
}

/** Set/adjust daily macro targets — nutritionist macro brain (prompt35). */
export function isMacroTargetQuery(text: string): boolean {
  if (isMacroSlashCommand(text)) return true;
  const t = text.toLowerCase();
  return (
    /יעדי?\s*מקרו|מאקרו|יעדים|קלוריות ליום|עדכן את היעדים|בוא נקבע|קבע יעד|מה המאקרו|מומלץ/.test(text) ||
    /macro target|set my macros|update macro|daily macros|recommended macros|calorie target|reset macros|suggest macros/.test(t) ||
    /objetivo.*macro|macros diarios|objectif macro/.test(t)
  );
}

/** Slash or natural-language macro revision request (nutritionist tab). */
export function isMacroChatRequest(text: string): boolean {
  return isMacroTargetQuery(text);
}

export function macroSlashIntro(langCode?: string | null): string {
  if (langCode === 'he') {
    return 'יעדי המאקרו מחושבים מ-7 ימי נתונים (שריפה, פעילות, CGM, בדיקות דם וכללים). בדוק/י את המספרים ואשר/י למטה.';
  }
  return 'Macro targets from your 7-day data (burn, activity, CGM, labs, rules). Review the numbers and confirm below.';
}

export function macroSlashWrongTabHint(langCode?: string | null): string {
  if (langCode === 'he') {
    return 'פקודת /macros זמינה בלשונית תזונאית 🥗 בלבד.';
  }
  return '/macros is available on the Nutritionist 🥗 tab only.';
}

/** Food/macro targets, hunger, "what to eat", menu tips. */
export function isFoodTargetQuery(text: string): boolean {
  if (isMacroTargetQuery(text)) return false;
  const t = text.toLowerCase();
  return (
    /שומן|חלבון|פחמימ|רעב|לא רעב|מה לאכול|מה עוד לאכול|תפריט|טיפים/.test(text) ||
    /\bfat\b|protein|carb|hungry|not hungry|what to eat|what else to eat|menu|meal tips|how much (more )?(protein|fat|carb)/.test(t) ||
    /proteína|grasa|carbohidrat|hambre|protéine|graisse|hunger|hambre/.test(t)
  );
}

/** Meal review — last meal / food log today. */
export function isMealIntentQuery(text: string): boolean {
  const t = text.toLowerCase();
  return /meal|ארוחה|comida|repas|mahlzeit|وجبة|приём|manger|essen|food log|last eat/i.test(t);
}

/** Yesterday / last night. */
export function isYesterdayIntentQuery(text: string): boolean {
  return /yesterday|אתמול|אמש|last night|ayer|hier|gestern|вчера|أمس/i.test(text);
}

/**
 * Resolve the dominant intent for a chat turn. Priority order ensures specific
 * topics (yesterday, activity, glucose) win over generic "today progress".
 */
export function detectChatIntent(
  text: string,
  opts?: { hasPeriodReview?: boolean },
): ChatIntent {
  if (opts?.hasPeriodReview) return 'period_review';
  if (isYesterdayIntentQuery(text)) return 'yesterday';
  if (isActivityQuery(text)) return 'activity';
  if (isGlucoseQuery(text)) return 'glucose';
  if (isTodayProgressQuery(text)) return 'today_progress';
  if (isMealIntentQuery(text)) return 'meal_review';
  if (isFoodTargetQuery(text)) return 'food_target';
  return 'general';
}

/**
 * Parse the CGM day-span from a context block such as
 * "=== RECENT CGM (last 2 days) ===". Returns null when not found.
 */
export function parseCgmDaySpanFromContext(detail: string | null | undefined): number | null {
  if (!detail) return null;
  const recent = detail.match(/RECENT CGM \(last (\d+) days?\)/i);
  if (recent) {
    const n = parseInt(recent[1]!, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (/=== TODAY CGM/i.test(detail) && !recent) return 1;
  return null;
}
