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
  | 'nutrition_knowledge'
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

/** User wants exact glucose stats (avg/min/max, day-night, analysis) — not a headline-only reply. */
export function isGlucoseDeepDiveQuery(text: string): boolean {
  const t = text.toLowerCase();
  if (
    /analyze|analysis|numbers|numeric|statistics|stats|breakdown|break down|tell me more|more detail|details|deep dive|in depth|exact|specific reading|latest reading|last reading|time in range|day avg|night avg|day vs night|spike at|compression/.test(t)
  ) {
    return true;
  }
  if (
    /נתח|מספרים|ממוצע|מינימום|מקסימום|פירוט|בפירוט|עוד פרטים|קריאה אחרונה|יום.*לילה|יום מול לילה|ספייק/.test(text)
  ) {
    return true;
  }
  if (/\b(avg|average|min|max)\b/.test(t) && isGlucoseQuery(text)) return true;
  if (/^\/(\d+)\b/i.test(t.trim()) && isGlucoseQuery(text)) return true;
  return false;
}

/** Explicit slash command — same pipeline as dashboard Analyze (7d revision context). */
export function isMacroSlashCommand(text: string): boolean {
  const t = text.trim();
  return /^\/macros?\b/i.test(t);
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
    return 'המאקרו החי נבנה מהכללים שלך — אותה מערכת כמו במרפאה. תראו את הסימנים ביומן האוכל.';
  }
  return 'Live macros rebuilt from your My Rules — same engine as the clinic. Food Log shows the ≥ ≤ meters now.';
}

export function macroSlashWrongTabHint(langCode?: string | null): string {
  if (langCode === 'he') {
    return 'פקודת /macros זמינה בלשונית תזונאית 🥗 בלבד.';
  }
  return '/macros is available on the Nutritionist 🥗 tab only.';
}

/** Meal / recipe / menu slash commands — nutritionist tab only. */
export type MealSlashCommand =
  | 'eat'
  | 'recipe'
  | 'menu_day'
  | 'menu_week'
  | 'menu_month'
  | 'menu_help';

export function isMenuSlashCommand(command: MealSlashCommand): boolean {
  return (
    command === 'menu_day' ||
    command === 'menu_week' ||
    command === 'menu_month' ||
    command === 'menu_help'
  );
}

export function parseMealSlashCommand(
  text: string,
): { command: MealSlashCommand; hint: string } | null {
  const t = text.trim();
  /** Order matters: longer / more specific patterns first. */
  const patterns: [RegExp, MealSlashCommand][] = [
    [/^\/eat\b/i, 'eat'],
    [/^\/recipe\b/i, 'recipe'],
    [/^\/recipt\b/i, 'recipe'],
    [/^\/create\b/i, 'recipe'],
    [/^\/menu-d\b/i, 'menu_day'],
    [/^\/menu-w\b/i, 'menu_week'],
    [/^\/menu-m\b/i, 'menu_month'],
    [/^\/menue\b/i, 'menu_help'],
    [/^\/menu\b/i, 'menu_help'],
    [/^\/daily\b/i, 'menu_day'],
    [/^\/weekly\b/i, 'menu_week'],
  ];
  for (const [re, command] of patterns) {
    const m = t.match(re);
    if (m) {
      return { command, hint: t.slice(m[0].length).trim() };
    }
  }
  return null;
}

export function isMealPlanSlashCommand(text: string): boolean {
  return parseMealSlashCommand(text) != null;
}

export function isRecipeSlashCommand(text: string): boolean {
  const slash = parseMealSlashCommand(text);
  return slash?.command === 'eat' || slash?.command === 'recipe';
}

export function mealPlanSlashWrongTabHint(langCode?: string | null): string {
  if (langCode === 'he') {
    return 'פקודות מתכון (/eat /recipe /create …) זמינות בלשונית תזונאית 🥗 בלבד.';
  }
  return 'Recipe commands (/eat, /recipe, /create, …) are available on the Nutritionist 🥗 tab only.';
}

/** Menu plans — deferred until prompt40b. */
export function menuSlashDeferredHint(command: MealSlashCommand, langCode?: string | null): string {
  const he = langCode === 'he';
  if (command === 'menu_help') {
    return he
      ? 'תפריטים (/menu) יגיעו בגרסה הבאה. עכשיו: /recipe למתכון בודד · /eat למה לאכול עכשיו.'
      : 'Menu plans (/menu) coming next. For now: /recipe for one recipe, /eat for what to eat now.';
  }
  if (command === 'menu_day') {
    return he
      ? 'תפריט יומי (/menu-d) יגיע בגרסה הבאה — כרגע /recipe למתכון בודד.'
      : 'Day menu (/menu-d) coming next — use /recipe for a single recipe card now.';
  }
  if (command === 'menu_week') {
    return he
      ? 'תפריט שבועי (/menu-w) יגיע בגרסה הבאה — כרגע /recipe למתכון בודד.'
      : 'Week menu (/menu-w) coming next — use /recipe for a single recipe card now.';
  }
  return he
    ? 'תפריט חודשי (/menu-m) יגיע בגרסה הבאה — כרגע /recipe למתכון בודד.'
    : 'Month menu (/menu-m) coming next — use /recipe for a single recipe card now.';
}

export function recipePlanIntro(langCode?: string | null): string {
  if (langCode === 'he') {
    return 'הנה המתכון — לחץ/י לפתיחה או לרישום בארוחות.';
  }
  return 'Here is your recipe — tap to open or log as a meal.';
}

/** Structured recipe / eat-now — slash commands only (no natural-language trigger). */
export function isRecipePlanChatRequest(text: string): boolean {
  return isRecipeSlashCommand(text);
}

export function resolveRecipePlanMode(
  text: string,
): { mode: 'eat_now' | 'recipe'; hint: string } {
  const slash = parseMealSlashCommand(text);
  if (slash?.command === 'eat') {
    return { mode: 'eat_now', hint: slash.hint || text };
  }
  return { mode: 'recipe', hint: slash?.hint || text };
}

/** Micronutrients / fatty acids / food-science — not stored in meal-log macros. */
export function isNutritionKnowledgeQuery(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /אומגה|ניוטרינט|נוריינט|חומצ(?:ת|ות)\s*שומן|ויטמין|מינרל|סידן|ברזל|אבץ|מגנזיום|אשלגן|שומנים בריא|סודיום|נתר|epa|dha|ala/.test(text) ||
    /\bomega[\s-]?[36]\b|omega[\s-]?3|omega[\s-]?6|nutrient|vitamin|mineral|fatty acid|micronutrient|sodium|cholesterol/.test(t) ||
    (/(העריך|ממוצע\s*יומי|estimate|daily average)/i.test(text) &&
      /אומגה|omega|ויטמין|vitamin|סודיום|sodium|cholesterol|כולסטרול|שומן/.test(text))
  );
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
  if (isNutritionKnowledgeQuery(text)) return 'nutrition_knowledge';
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
