/**
 * Quick Start copy — coach language locales.
 * Glossary (kcal, Withings, CGM, BMR, My Rules, AI…) stays English.
 *
 * Hebrew voice (native Israeli microcopy — not EN→HE):
 * - Write as if the screen was born in Hebrew; never mirror English sentence shape.
 * - Plural “אתם” for inclusivity; prefer infinitive CTAs (להמשיך, להזין) over gendered imperative.
 * - Short, direct, spoken — like a sharp WhatsApp from a clinic, not a brochure.
 *
 * German voice (native DACH microcopy — not EN→DE):
 * - Sie-Form (professional clinic tone).
 * - Short, klar, ohne Marketing-Floskeln; ein Gedanke pro Satz.
 * - CTAs als Infinitiv/substantivisch wo natürlich (Weiter, Verbinden…); kein “Bitte klicken Sie…”.
 * - Fachbegriffe/Glossary bleiben Englisch.
 *
 * Spanish voice (native clinic microcopy — not EN→ES):
 * - Usted (tono profesional de consulta).
 * - Corto, claro, sin marketing; una idea por frase.
 * - CTAs en infinitivo donde suene natural (Continuar, Conectar…).
 * - Glosario clínico/marcas en inglés.
 *
 * French voice (microcopie cabinet — pas EN→FR) :
 * - Vous (ton professionnel).
 * - Court, limpide, sans marketing ; une idée par phrase.
 * - CTA naturels (Continuer, Relier…) ; glossaire / marques en anglais.
 *
 * Arabic voice (فصحى مهنية للعيادة — ليس ترجمة حرفية من الإنجليزية):
 * - صيغة جمع محايدة حيث يناسب (أنتم) أو صياغة غير مؤنّثة/مذكّرة قسرية.
 * - جمل قصيرة، مباشرة، بدون تسويق؛ فكرة واحدة في كل جملة.
 * - أزرار بصيغة المصدر حيث يناسب (متابعة، ربط…).
 * - المصطلحات والعلامات تبقى بالإنجليزية.
 *
 * Russian voice (клиническая микрокопия — не калька с EN):
 * - Вы (профессиональный тон).
 * - Коротко, ясно, без маркетинга; одна мысль на фразу.
 * - CTA естественные (Далее, Связать…); глоссарий/бренды на английском.
 */

export type QuickStartCopy = {
  quickStart: string;
  progress: (n: number, total: number) => string;
  welcomeTo: string;
  back: string;
  next: string;
  finish: string;
  working: string;
  help: string;
  yes: string;
  no: string;
  tapYesNo: string;
  genderMale: string;
  genderFemale: string;
  genderOther: string;
  ageYears: (n: number) => string;
  brandTag: string;
  language: {
    title: string;
    helpLabel: string;
    lead: string;
    mentorVoice: string;
    mentorHint: string;
  };
  /** Theme step after language (prompt96 Phase 4b). Chip labels come from appearanceCopy. */
  appearance: {
    title: string;
    helpLabel: string;
    lead: string;
  };
  /** Patient name for clinic findability (be-27) — after appearance. */
  names: {
    title: string;
    helpLabel: string;
    lead: string;
    firstName: string;
    lastName: string;
    required: string;
    saveFailed: string;
  };
  welcome: {
    title: string;
    helpLabel: string;
    lead: string;
    card1Title: string;
    card1Body: string;
    card2Title: string;
    card2Body: string;
    card3Title: string;
    card3Body: string;
    card4Title: string;
    card4Body: string;
    privacyLink: string;
  };
  units: {
    title: string;
    helpLabel: string;
    lead: string;
  };
  body: {
    title: string;
    helpLabel: string;
    lead: string;
    gender: string;
    height: string;
    birthDate: string;
  };
  /** In-app tip when ? sits next to the Withings brand on scale/watch steps. */
  withingsTip: {
    title: string;
    body: string;
    more: string;
    dismiss: string;
  };
  scale: {
    title: string;
    helpLabel: string;
    /** Caption under the scale illustration (always-English Withings glossary OK). */
    exampleCaption: string;
    lead: string;
  };
  watch: {
    title: string;
    helpLabel: string;
    /** Caption under the watch illustration. */
    exampleCaption: string;
    lead: string;
  };
  cgm: {
    title: string;
    helpLabel: string;
    /** Caption under the CGM illustration. */
    exampleCaption: string;
    lead: string;
  };
  link: {
    title: string;
    helpLabel: string;
    /** Caption under the link diagram. */
    exampleCaption: string;
    lead: string;
    connected: string;
    relinkHint: string;
    linkBtn: string;
    opening: string;
    skipHint: string;
  };
  weight: {
    title: string;
    helpLabel: string;
    lead: string;
    linkedHint: string;
    enterNow: string;
    skipWithings: string;
    currentWeight: string;
    manualGuide: string;
  };
  phoneHealth: {
    titleIos: string;
    titleAndroid: string;
    helpLabel: string;
    exampleCaptionIos: string;
    exampleCaptionAndroid: string;
    leadIos: string;
    leadAndroid: string;
    cgmIos: string;
    cgmAndroid: string;
  };
  pdfs: {
    title: string;
    helpLabel: string;
    lead: string;
    labTitle: string;
    labHint: string;
    imported: string;
    importLab: string;
    nutritionTitle: string;
    nutritionHint: string;
    importSession: string;
  };
  targets: {
    title: string;
    helpLabel: string;
    lead: string;
    waitOrRetry: string;
    retry: string;
    usingSaved: string;
    bodyTarget: string;
    dailyMacros: string;
    macrosFromRules: string;
    macrosNeedRules: string;
    regenerate: string;
  };
  meals: {
    title: string;
    helpLabel: string;
    /** Caption under the plate illustration. */
    exampleCaption: string;
    lead: string;
    b1: string;
    b2: string;
    b3: string;
    b4: string;
    logFirst: string;
  };
};

const EN: QuickStartCopy = {
  quickStart: 'Quick Start',
  progress: (n, total) => `Step ${n} of ${total}`,
  welcomeTo: 'Welcome to Healthings',
  back: 'Back',
  next: 'Next',
  finish: 'Finish',
  working: 'Working…',
  help: 'Help',
  yes: 'Yes',
  no: 'No',
  tapYesNo: 'Tap Yes or No',
  genderMale: 'Male',
  genderFemale: 'Female',
  genderOther: 'Other',
  ageYears: (n) => `Age: ${n} years`,
  brandTag: 'Personalized metabolic OS with your licensed nutritionist',
  language: {
    title: 'App & coach language',
    helpLabel: 'Language help',
    lead:
      'Quick Start, coach chat, meal names, and reports use this language. Help links open in the same language.',
    mentorVoice: 'App mentor',
    mentorHint: 'Man or woman — how your AI mentor speaks to you. Not your profile gender.',
  },
  appearance: {
    title: 'Light or dark?',
    helpLabel: 'Appearance',
    lead: 'Choose how the app looks. “System” matches your phone. Change anytime in Profile.',
  },
  names: {
    title: 'Your name',
    helpLabel: 'Why we ask',
    lead: 'So your clinic can find you on their patient list. You can edit this later in Profile.',
    firstName: 'First name',
    lastName: 'Last name',
    required: 'Enter your first and last name.',
    saveFailed: 'Could not save your name — check the network and try again.',
  },
  welcome: {
    title: 'Welcome',
    helpLabel: 'How Healthings works',
    lead:
      'Healthings is a wellness app with a high-end method: it learns your body, teaches you in the moment, and feeds clear feedback to your nutritionist — so the path to your targets keeps getting sharper.',
    card1Title: 'Learns your body. Teaches you.',
    card1Body:
      'Watch live charts as weight, composition, activity, and glucose (when connected) update. The model builds a picture of how your body responds, explains what the numbers mean in plain language, and coaches you under My Rules — so you understand your progress, not just store it.',
    card2Title: 'A breakthrough in how care runs',
    card2Body:
      'Most wellness tools stop at tracking. Healthings closes the loop:\n\n• Your nutritionist sets clinical intent in My Rules\n• You live the plan — meals, body, activity, labs\n• Healthings executes, learns, and explains as days unfold\n• Body feedback reaches your nutritionist when you share\n• Together you refine the plan — the optimized path to your targets\n\nContinuous optimization for you and for your professional’s focus — not another disconnected food diary.',
    card3Title: 'Wellness category. Professional standard.',
    card3Body:
      'We sit in wellness on purpose — no diagnosis, no prescribing, no replacing your clinician. The value is the method: licensed guidance, live body insight, and a feedback cycle that feels like premium practice.',
    card4Title: 'Not medical care',
    card4Body:
      'Healthings executes the plan under My Rules. Emergency and medical decisions stay with licensed professionals. Tap ? for privacy and the full story.',
    privacyLink: 'How it works & privacy',
  },
  units: {
    title: 'Units & measurements',
    helpLabel: 'Units',
    lead: 'How weight, height, energy, water, and glucose appear in the app. You can change this later in Profile.',
  },
  body: {
    title: 'About you',
    helpLabel: 'Why we ask',
    lead: 'Used for BMR, BMI, and energy targets.',
    gender: 'Gender',
    height: 'Height',
    birthDate: 'Birth date',
  },
  withingsTip: {
    title: 'What is Withings?',
    body:
      'Withings makes smart scales and watches. If you have one, link your account and Healthings reads weight and activity from their cloud — not Bluetooth. No Withings? Tap No — enter weight next; the app still works.',
    more: 'More help',
    dismiss: 'Got it',
  },
  scale: {
    title: 'Do you use a Withings scale?',
    helpLabel: 'What is Withings?',
    exampleCaption: 'Example — any Withings scale\non your account',
    lead:
      'No is fine — enter weight in the next steps; the app still works. Yes — we sync weight and composition from your Withings account (cloud, not Bluetooth). Body, Body Scan, and similar all work.',
  },
  watch: {
    title: 'Do you use a Withings watch or band?',
    helpLabel: 'What is Withings?',
    exampleCaption: 'Example — any Withings watch or band\non your account',
    lead:
      'No is fine — steps and heart rate can come from Health Connect / Apple Health (Garmin, Apple Watch, Samsung…). Yes — activity from your Withings account.',
  },
  cgm: {
    title: 'Do you use a CGM for glucose?',
    helpLabel: 'CGM help',
    exampleCaption: 'Glucose from your\nphone health app',
    lead:
      'No is fine — you can import lab PDFs later. Yes — continuous glucose via Health Connect (Android) or Apple Health (iPhone).',
  },
  link: {
    title: 'Link your Withings account',
    helpLabel: 'Linking help',
    exampleCaption: 'One link: Healthings ↔ your Withings account\n(scale & watch)',
    lead: 'Sign in with the same account used in the Withings app. One link covers scale and watch data.',
    connected: 'Withings connected',
    relinkHint: 'You can re-link anytime in Profile.',
    linkBtn: 'Link Withings',
    opening: 'Opening Withings…',
    skipHint:
      'Or tap Next to skip — link later in Profile. Targets may use a temporary weight estimate until you link.',
  },
  weight: {
    title: 'Starting weight',
    helpLabel: 'Weight help',
    lead: 'Needed for targets and energy balance.',
    linkedHint:
      'Linked — enter a weight if the scale has not synced yet, or tap Next to use cloud data when available.',
    enterNow: 'Enter weight now',
    skipWithings: "Skip — I'll get weight from Withings later",
    currentWeight: 'Current weight',
    manualGuide: 'Manual body guide',
  },
  phoneHealth: {
    titleIos: 'Allow Apple Health',
    titleAndroid: 'Allow Health Connect',
    helpLabel: 'Phone health',
    exampleCaptionIos: 'Steps and heart rate from Apple Health',
    exampleCaptionAndroid: 'Steps and heart rate via Health Connect',
    leadIos:
      'Tap Next — Apple Health may ask once. Use Allow access below for steps and heart rate when your Withings watch is off.',
    leadAndroid:
      'Tap Next — Health Connect may open once. When Withings watch is off, steps and heart rate come from any brand that writes to Health Connect.',
    cgmIos: 'CGM: CareSens Air → share with Apple Health → allow Blood Glucose.',
    cgmAndroid: 'Blood glucose — for CGM charts and meal impact.',
  },
  pdfs: {
    title: 'Optional reports',
    helpLabel: 'PDF reports',
    lead: 'Import PDFs you already have — or tap Continue to do this later in the app.',
    labTitle: 'Lab report',
    labHint: 'Lipids, kidney markers, and more — for smarter macro targets.',
    imported: 'Imported',
    importLab: 'Import lab PDF',
    nutritionTitle: 'Nutritionist session',
    nutritionHint: 'Visit summary — coaches follow your plan text.',
    importSession: 'Import session PDF',
  },
  targets: {
    title: 'Your targets',
    helpLabel: 'Targets help',
    lead: 'AI suggests a body target from your profile. Macros come from My Rules — yours or the clinic’s — not from the profile.',
    waitOrRetry: 'Wait for targets or tap Retry.',
    retry: 'Retry',
    usingSaved:
      'Using your saved body target. Tap Regenerate only if you want a fresh AI number.',
    bodyTarget: 'Body target',
    dailyMacros: 'Macros',
    macrosFromRules: 'Live macros rebuilt from My Rules.',
    macrosNeedRules: 'No My Rules yet — macros stay empty until you or your clinic write them.',
    regenerate: 'Regenerate with AI',
  },
  meals: {
    title: 'How to log meals',
    helpLabel: 'Meal logging',
    exampleCaption: 'Photo, text, or your coach\n— then save in the food log',
    lead:
      'Log what you eat so Healthings can coach under My Rules and show live impact on your charts.',
    b1: '1. Tap + on the metabolic chart to open the food log.',
    b2: '2. Photo — snap your plate; AI lists items; you approve.',
    b3: '3. Text — describe your meal; AI parses macros.',
    b4: '4. Coach chat can suggest what to log — save via the food log.',
    logFirst: 'Log my first meal',
  },
};

const HE: QuickStartCopy = {
  quickStart: 'התחלה מהירה',
  progress: (n, total) => `שלב ${n} מתוך ${total}`,
  welcomeTo: 'ברוכים הבאים ל־\nHealthings',
  back: 'חזרה',
  next: 'המשך',
  finish: 'סיום',
  working: 'רגע…',
  help: 'עזרה',
  yes: 'כן',
  no: 'לא',
  tapYesNo: 'בוחרים: כן או לא',
  genderMale: 'גבר',
  genderFemale: 'אישה',
  genderOther: 'אחר',
  ageYears: (n) => `גיל ${n}`,
  brandTag: 'מערכת מטבולית אישית — יחד עם התזונאי שלכם',
  language: {
    title: 'שפת האפליקציה והמאמן',
    helpLabel: 'עזרה — שפה',
    lead: 'בשפה הזו עוברים את ההתחלה, מדברים עם המאמן, רואים שמות ארוחות ודוחות. גם דפי העזרה נפתחים בה.',
    mentorVoice: 'המאמן באפליקציה',
    mentorHint: 'גבר או אישה — כך ידבר אליכם המאמן. לא המגדר שלכם',
  },
  appearance: {
    title: 'בהיר או כהה?',
    helpLabel: 'מראה',
    lead: 'איך האפליקציה תיראה. ״מערכת״ עוקב אחרי הטלפון. אפשר לשנות אחר כך בפרופיל.',
  },
  names: {
    title: 'השם שלך',
    helpLabel: 'למה שואלים',
    lead: 'כדי שהמרפאה תוכל למצוא אותך ברשימת המטופלים. אפשר לערוך אחר כך בפרופיל.',
    firstName: 'שם פרטי',
    lastName: 'שם משפחה',
    required: 'נא להזין שם פרטי ושם משפחה.',
    saveFailed: 'לא ניתן לשמור את השם — בדקו את הרשת ונסו שוב.',
  },
  welcome: {
    title: 'ברוכים הבאים',
    helpLabel: 'איך Healthings עובד',
    lead:
      // Brand on its own LTR line — avoids HE↔EN bidi flip mid-sentence (Michal / prompt111).
      'Healthings\nלומדת את הגוף, מסבירה מה קורה עכשיו, ומעבירה משוב ברור לתזונאי — כדי שהדרך ליעדים תתחדד מיום ליום.',
    card1Title: 'לומדת את הגוף. מלמדת אתכם.',
    card1Body:
      'גרפים חיים של משקל, הרכב גוף, פעילות וגלוקוז (כשמחוברים). המודל מבין איך הגוף מגיב, מסביר את המספרים בשפה פשוטה, ומאמן לפי My Rules — כדי להבין התקדמות, לא רק לאסוף נתונים.',
    card2Title: 'מהמעקב — למעגל מלא',
    card2Body:
      'רוב האפליקציות עוצרות במעקב. כאן המעגל נסגר:\n\n• התזונאי כותב כוונה ב־My Rules\n• אתם חיים את זה — אוכל, גוף, פעילות, בדיקות\n• Healthings\nמבצעת, לומדת ומסבירה\n• כשמשתפים — התזונאי רואה מה קורה בגוף\n• יחד מחדדים את התוכנית\n\nלא עוד יומן אוכל מנותק מהקליניקה.',
    card3Title: 'Wellness — ברמה מקצועית',
    card3Body:
      'בלי אבחון, בלי מרשמים, בלי להחליף רופא. הערך הוא השיטה: ליווי מורשה, תמונת גוף חיה, ומשוב שמרגיש כמו קליניקה טובה.',
    card4Title: 'לא טיפול רפואי',
    card4Body:
      'Healthings רצה לפי My Rules. חירום והחלטות רפואיות — רק אצל אנשי מקצוע מורשים. לפרטים ולפרטיות: ?',
    privacyLink: 'איך זה עובד · פרטיות',
  },
  units: {
    title: 'יחידות מידה',
    helpLabel: 'יחידות',
    lead: 'איך יוצגו משקל, גובה, אנרגיה, מים וגלוקוז. אפשר לשנות בכל רגע בפרופיל.',
  },
  body: {
    title: 'קצת עליכם',
    helpLabel: 'למה שואלים',
    lead: 'לחישוב BMR, BMI ויעדי אנרגיה.',
    gender: 'מגדר',
    height: 'גובה',
    birthDate: 'תאריך לידה',
  },
  withingsTip: {
    title: 'מה זה Withings?',
    body:
      'Withings מייצרים משקלים ושעונים חכמים. אם יש לכם — מחברים את החשבון, ו־Healthings קורא משקל ופעילות מהענן שלהם, לא מ־Bluetooth. אין? לחצו לא — תזינו משקל בהמשך; האפליקציה עובדת גם בלי.',
    more: 'עוד עזרה',
    dismiss: 'הבנתי',
  },
  scale: {
    title: 'יש משקל Withings?',
    helpLabel: 'מה זה Withings?',
    exampleCaption: 'דוגמה — כל משקל Withings\nבחשבון שלכם',
    lead:
      'אין? אין בעיה — תזינו משקל בהמשך, האפליקציה עובדת גם בלי. יש? נסנכרן משקל והרכב גוף מחשבון Withings (ענן, לא Bluetooth). Body, Body Scan ודומיהם מתאימים.',
  },
  watch: {
    title: 'יש שעון או צמיד Withings?',
    helpLabel: 'מה זה Withings?',
    exampleCaption: 'דוגמה — כל שעון או צמיד Withings\nבחשבון שלכם',
    lead:
      'אין? אין בעיה — צעדים ודופק מ־Health Connect / Apple Health (Garmin, Apple Watch, Samsung…). יש? פעילות מחשבון Withings.',
  },
  cgm: {
    title: 'יש CGM לגלוקוז?',
    helpLabel: 'עזרה — CGM',
    exampleCaption: 'גלוקוז מאפליקציית הבריאות\nבטלפון',
    lead:
      'אין? אין בעיה — אפשר לייבא PDF של מעבדה אחר כך. יש? גלוקוז רציף דרך Health Connect או Apple Health.',
  },
  link: {
    title: 'חיבור ל־Withings',
    helpLabel: 'עזרה — חיבור',
    exampleCaption: 'חיבור אחד: Healthings ↔ Withings\n(משקל ושעון)',
    lead: 'אותו חשבון כמו באפליקציית Withings. חיבור אחד — למשקל ולשעון.',
    connected: 'Withings מחובר',
    relinkHint: 'אפשר לחבר שוב מהפרופיל.',
    linkBtn: 'לחיבור Withings',
    opening: 'פותח את Withings…',
    skipHint:
      'אפשר לדלג ולהמשיך — מחברים אחר כך בפרופיל. עד אז היעדים עלולים להתבסס על אומדן משקל.',
  },
  weight: {
    title: 'משקל התחלתי',
    helpLabel: 'עזרה — משקל',
    lead: 'נחוץ ליעדים ולמאזן אנרגיה.',
    linkedHint:
      'מחוברים. אם המשקל עדיין לא עלה — מזינים ידנית, או ממשיכים ומחכים לענן.',
    enterNow: 'להזין משקל עכשיו',
    skipWithings: 'לדלג — המשקל יגיע מ־Withings',
    currentWeight: 'משקל עכשיו',
    manualGuide: 'איך מזינים ידנית',
  },
  phoneHealth: {
    titleIos: 'גישה ל־Apple Health',
    titleAndroid: 'גישה ל־Health Connect',
    helpLabel: 'בריאות מהטלפון',
    exampleCaptionIos: 'צעדים ודופק מ־Apple Health',
    exampleCaptionAndroid: 'צעדים ודופק דרך Health Connect',
    leadIos:
      'בהמשך — Apple Health עלול לבקש אישור פעם אחת. Allow access: צעדים ודופק כששעון Withings לא פעיל.',
    leadAndroid:
      'בהמשך — Health Connect עלול להיפתח פעם אחת. בלי שעון Withings: צעדים ודופק מכל מותג שכותב ל־Health Connect.',
    cgmIos: 'CGM: CareSens Air → שיתוף ל־Apple Health → Blood Glucose.',
    cgmAndroid: 'גלוקוז בדם — לגרפי CGM ולהשפעת ארוחות.',
  },
  pdfs: {
    title: 'דוחות — לא חובה',
    helpLabel: 'דוחות PDF',
    lead: 'יש PDF מוכן? מייבאים עכשיו. אם לא — ממשיכים ועושים אחר כך באפליקציה.',
    labTitle: 'דוח מעבדה',
    labHint: 'שומנים, כליות ועוד — ליעדי מאקרו מדויקים יותר.',
    imported: 'יובא',
    importLab: 'לייבוא PDF מעבדה',
    nutritionTitle: 'סיכום מול התזונאי',
    nutritionHint: 'סיכום ביקור — המאמנים נשענים על מה שכתוב בתוכנית.',
    importSession: 'לייבוא PDF סיכום',
  },
  targets: {
    title: 'היעדים שלכם',
    helpLabel: 'עזרה — יעדים',
    lead: 'ה־AI מציע יעד גוף לפי הפרופיל. מאקרו נבנה מכללים שלי — שלך או של המרפאה — לא מהפרופיל.',
    waitOrRetry: 'מחכים ליעדים… או מנסים שוב.',
    retry: 'לנסות שוב',
    usingSaved:
      'נשארים עם יעד הגוף השמור. «יצירה מחדש» רק אם רוצים מספר חדש מה־AI.',
    bodyTarget: 'יעד גוף',
    dailyMacros: 'מאקרו',
    macrosFromRules: 'מאקרו חי נבנה מכללים שלי.',
    macrosNeedRules: 'אין עדיין כללים שלי — מאקרו יישאר ריק עד שאתם או המרפאה תכתבו אותם.',
    regenerate: 'יצירה מחדש עם AI',
  },
  meals: {
    title: 'איך רושמים ארוחה',
    helpLabel: 'רישום ארוחות',
    exampleCaption: 'צילום, טקסט או המאמן שלך\n— ושומרים ביומן האוכל',
    lead: 'רושמים מה אוכלים — והמאמן עובד לפי My Rules, עם השפעה חיה בגרפים.',
    b1: '1. לוחצים + בגרף המטבולי → יומן האוכל.',
    b2: '2. תמונה — מצלמים את הצלחת, מאשרים מה שה־AI מציע.',
    b3: '3. טקסט — כותבים מה אכלתם; ה־AI מפרק למקרו.',
    b4: '4. אפשר גם מהצ׳אט — השמירה ביומן האוכל.',
    logFirst: 'לרשום ארוחה ראשונה',
  },
};

const DE: QuickStartCopy = {
  quickStart: 'Schnellstart',
  progress: (n, total) => `Schritt ${n} von ${total}`,
  welcomeTo: 'Willkommen bei Healthings',
  back: 'Zurück',
  next: 'Weiter',
  finish: 'Fertig',
  working: 'Einen Moment…',
  help: 'Hilfe',
  yes: 'Ja',
  no: 'Nein',
  tapYesNo: 'Bitte Ja oder Nein wählen',
  genderMale: 'Mann',
  genderFemale: 'Frau',
  genderOther: 'Divers',
  ageYears: (n) => `Alter: ${n} Jahre`,
  brandTag: 'Persönliches metabolisches System — mit Ihrer Ernährungsfachkraft',
  language: {
    title: 'App- & Coach-Sprache',
    helpLabel: 'Hilfe — Sprache',
    lead:
      'In dieser Sprache laufen Schnellstart, Coach-Chat, Mahlzeiten und Berichte. Die Hilfe öffnet sich ebenfalls darin.',
    mentorVoice: 'App-Mentor',
    mentorHint: 'Mann oder Frau — so spricht Ihr KI-Mentor. Nicht Ihr Profil-Geschlecht.',
  },
  appearance: {
    title: 'Hell oder dunkel?',
    helpLabel: 'Darstellung',
    lead: 'So sieht die App aus. „System“ folgt dem Telefon. Später jederzeit im Profil änderbar.',
  },
  names: {
    title: 'Ihr Name',
    helpLabel: 'Warum wir fragen',
    lead: 'Damit Ihre Praxis Sie in der Patientenliste finden kann. Später im Profil änderbar.',
    firstName: 'Vorname',
    lastName: 'Nachname',
    required: 'Bitte Vor- und Nachname eingeben.',
    saveFailed: 'Name konnte nicht gespeichert werden — Netzwerk prüfen und erneut versuchen.',
  },
  welcome: {
    title: 'Willkommen',
    helpLabel: 'So funktioniert Healthings',
    lead:
      'Healthings lernt Ihren Körper, erklärt, was gerade passiert, und gibt Ihrer Ernährungsfachkraft klares Feedback — damit der Weg zu Ihren Zielen Tag für Tag schärfer wird.',
    card1Title: 'Lernt Ihren Körper. Erklärt Ihnen die Zahlen.',
    card1Body:
      'Live-Charts zu Gewicht, Körperzusammensetzung, Aktivität und Glukose (wenn verbunden). Das Modell versteht, wie Ihr Körper reagiert, erklärt die Zahlen klar und coacht nach My Rules — Fortschritt verstehen, nicht nur speichern.',
    card2Title: 'Vom Tracking zum geschlossenen Kreis',
    card2Body:
      'Die meisten Apps bleiben beim Tracking stehen. Hier schließt sich der Kreis:\n\n• Ihre Fachkraft setzt die Absicht in My Rules\n• Sie leben den Plan — Essen, Körper, Aktivität, Labore\n• Healthings führt aus, lernt und erklärt\n• Beim Teilen sieht Ihre Fachkraft, was im Körper passiert\n• Gemeinsam schärfen Sie den Plan nach\n\nKein weiteres Ernährungs-Tagebuch ohne Klinik-Anbindung.',
    card3Title: 'Wellness — auf professionellem Niveau',
    card3Body:
      'Keine Diagnose, keine Rezepte, kein Ersatz für Ärztinnen und Ärzte. Der Wert liegt in der Methode: lizenzierte Begleitung, lebendiges Körperbild, Feedback wie in einer guten Praxis.',
    card4Title: 'Keine medizinische Behandlung',
    card4Body:
      'Healthings arbeitet nach My Rules. Notfälle und medizinische Entscheidungen bleiben bei zugelassenen Fachleuten. Details und Datenschutz: ?',
    privacyLink: 'So funktioniert’s · Datenschutz',
  },
  units: {
    title: 'Maßeinheiten',
    helpLabel: 'Einheiten',
    lead: 'So erscheinen Gewicht, Größe, Energie, Wasser und Glukose. Später jederzeit änderbar unter Profil.',
  },
  body: {
    title: 'Kurz zu Ihnen',
    helpLabel: 'Warum wir fragen',
    lead: 'Für BMR, BMI und Energieziele.',
    gender: 'Geschlecht',
    height: 'Größe',
    birthDate: 'Geburtsdatum',
  },
  withingsTip: {
    title: 'Was ist Withings?',
    body:
      'Withings stellt intelligente Waagen und Uhren her. Wenn Sie welche haben: Konto verbinden — Healthings liest Gewicht und Aktivität aus der Cloud, nicht per Bluetooth. Kein Withings? Nein tippen — Gewicht danach eingeben; die App funktioniert trotzdem.',
    more: 'Mehr Hilfe',
    dismiss: 'Verstanden',
  },
  scale: {
    title: 'Nutzen Sie eine Withings-Waage?',
    helpLabel: 'Was ist Withings?',
    exampleCaption: 'Beispiel — jede Withings-Waage\nin Ihrem Konto',
    lead:
      'Nein ist in Ordnung — Gewicht in den nächsten Schritten eingeben; die App funktioniert trotzdem. Ja — Sync von Gewicht und Körperzusammensetzung aus Ihrem Withings-Konto (Cloud, nicht Bluetooth). Body, Body Scan und ähnliche passen.',
  },
  watch: {
    title: 'Nutzen Sie eine Withings-Uhr oder ein Band?',
    helpLabel: 'Was ist Withings?',
    exampleCaption: 'Beispiel — jede Withings-Uhr oder jedes Band\nin Ihrem Konto',
    lead:
      'Nein ist in Ordnung — Schritte und Puls können von Health Connect / Apple Health kommen (Garmin, Apple Watch, Samsung …). Ja — Aktivität aus Ihrem Withings-Konto.',
  },
  cgm: {
    title: 'Nutzen Sie ein CGM für Glukose?',
    helpLabel: 'Hilfe — CGM',
    exampleCaption: 'Glukose aus Ihrer\nHandy-Gesundheits-App',
    lead:
      'Nein ist in Ordnung — Lab-PDFs können Sie später importieren. Ja — kontinuierliche Glukose über Health Connect (Android) oder Apple Health (iPhone).',
  },
  link: {
    title: 'Withings verbinden',
    helpLabel: 'Hilfe — Verbinden',
    exampleCaption: 'Eine Verbindung: Healthings ↔ Withings\n(Waage & Uhr)',
    lead: 'Derselbe Account wie in der Withings-App. Eine Verbindung — für Waage und Uhr.',
    connected: 'Withings verbunden',
    relinkHint: 'Erneut verbinden geht jederzeit unter Profil.',
    linkBtn: 'Withings verbinden',
    opening: 'Withings wird geöffnet…',
    skipHint:
      'Sie können überspringen und später unter Profil verbinden. Bis dahin können Ziele auf einer Gewichtsschätzung basieren.',
  },
  weight: {
    title: 'Startgewicht',
    helpLabel: 'Hilfe — Gewicht',
    lead: 'Nötig für Ziele und Energiebilanz.',
    linkedHint:
      'Verbunden. Wenn die Waage noch nicht synchronisiert hat — Gewicht eingeben oder weiter und auf die Cloud warten.',
    enterNow: 'Gewicht jetzt eingeben',
    skipWithings: 'Überspringen — Gewicht kommt von Withings',
    currentWeight: 'Aktuelles Gewicht',
    manualGuide: 'Manuell eingeben',
  },
  phoneHealth: {
    titleIos: 'Zugriff auf Apple Health',
    titleAndroid: 'Zugriff auf Health Connect',
    helpLabel: 'Gesundheit am Telefon',
    exampleCaptionIos: 'Schritte und Puls aus Apple Health',
    exampleCaptionAndroid: 'Schritte und Puls über Health Connect',
    leadIos:
      'Als Nächstes kann Apple Health einmal um Erlaubnis fragen. Allow access: Schritte und Puls, wenn Ihre Withings-Uhr aus ist.',
    leadAndroid:
      'Als Nächstes kann Health Connect einmal öffnen. Ohne Withings-Uhr: Schritte und Puls von jeder Marke, die in Health Connect schreibt.',
    cgmIos: 'CGM: CareSens Air → mit Apple Health teilen → Blood Glucose erlauben.',
    cgmAndroid: 'Blutzucker — für CGM-Charts und Mahlzeiteneinfluss.',
  },
  pdfs: {
    title: 'Berichte — optional',
    helpLabel: 'PDF-Berichte',
    lead: 'PDF schon da? Jetzt importieren. Sonst weiter — später in der App nachholen.',
    labTitle: 'Laborbericht',
    labHint: 'Lipide, Nierenwerte und mehr — für präzisere Makroziele.',
    imported: 'Importiert',
    importLab: 'Labor-PDF importieren',
    nutritionTitle: 'Gespräch mit der Ernährungsfachkraft',
    nutritionHint: 'Besuchsprotokoll — die Coaches stützen sich auf den Plantext.',
    importSession: 'Protokoll-PDF importieren',
  },
  targets: {
    title: 'Ihre Ziele',
    helpLabel: 'Hilfe — Ziele',
    lead: 'Die KI schlägt ein Körperziel aus Ihrem Profil vor. Makros kommen aus My Rules — Ihre oder die der Praxis — nicht aus dem Profil.',
    waitOrRetry: 'Ziele werden geladen… oder erneut versuchen.',
    retry: 'Erneut versuchen',
    usingSaved:
      'Gespeichertes Körperziel bleibt. „Neu erzeugen“ nur, wenn Sie eine frische KI-Zahl wollen.',
    bodyTarget: 'Körperziel',
    dailyMacros: 'Makros',
    macrosFromRules: 'Live-Makros aus My Rules neu gebaut.',
    macrosNeedRules: 'Noch keine My Rules — Makros bleiben leer, bis Sie oder die Praxis sie schreiben.',
    regenerate: 'Neu erzeugen mit AI',
  },
  meals: {
    title: 'Mahlzeiten erfassen',
    helpLabel: 'Essen loggen',
    exampleCaption: 'Foto, Text oder Coach\n— Speichern im Essens-Tagebuch',
    lead: 'Essen erfassen — der Coach arbeitet nach My Rules und zeigt den Einfluss live in den Charts.',
    b1: '1. + im Stoffwechsel-Chart tippen → Essensprotokoll.',
    b2: '2. Foto — Teller fotografieren, Vorschlag der KI bestätigen.',
    b3: '3. Text — Mahlzeit beschreiben; die KI zerlegt in Makros.',
    b4: '4. Auch aus dem Chat möglich — Speichern im Essensprotokoll.',
    logFirst: 'Erste Mahlzeit erfassen',
  },
};

const ES: QuickStartCopy = {
  quickStart: 'Inicio rápido',
  progress: (n, total) => `Paso ${n} de ${total}`,
  welcomeTo: 'Bienvenido/a a Healthings',
  back: 'Atrás',
  next: 'Continuar',
  finish: 'Listo',
  working: 'Un momento…',
  help: 'Ayuda',
  yes: 'Sí',
  no: 'No',
  tapYesNo: 'Elija Sí o No',
  genderMale: 'Hombre',
  genderFemale: 'Mujer',
  genderOther: 'Otro',
  ageYears: (n) => `Edad: ${n} años`,
  brandTag: 'Sistema metabólico personal — con su nutricionista',
  language: {
    title: 'Idioma de la app y del coach',
    helpLabel: 'Ayuda — idioma',
    lead:
      'En este idioma se hace el inicio, el chat con el coach, los nombres de las comidas y los informes. La ayuda también se abre en él.',
    mentorVoice: 'Mentor de la app',
    mentorHint: 'Hombre o mujer — así le habla el mentor de IA. No es el género de su perfil.',
  },
  appearance: {
    title: '¿Claro u oscuro?',
    helpLabel: 'Apariencia',
    lead: 'Cómo se ve la app. «Sistema» sigue el teléfono. Puede cambiarlo luego en Perfil.',
  },
  names: {
    title: 'Su nombre',
    helpLabel: 'Por qué lo pedimos',
    lead: 'Para que su clínica pueda encontrarle en la lista de pacientes. Editable después en Perfil.',
    firstName: 'Nombre',
    lastName: 'Apellidos',
    required: 'Introduzca nombre y apellidos.',
    saveFailed: 'No se pudo guardar el nombre — compruebe la red e inténtelo de nuevo.',
  },
  welcome: {
    title: 'Bienvenido/a',
    helpLabel: 'Cómo funciona Healthings',
    lead:
      'Healthings aprende su cuerpo, explica lo que ocurre ahora y da feedback claro a su nutricionista — para que el camino a sus objetivos se afine cada día.',
    card1Title: 'Aprende su cuerpo. Le enseña.',
    card1Body:
      'Gráficos en vivo de peso, composición corporal, actividad y glucosa (si está conectada). El modelo entiende cómo responde su cuerpo, explica los números con claridad y le guía según My Rules — para entender el progreso, no solo guardarlo.',
    card2Title: 'Del seguimiento al círculo cerrado',
    card2Body:
      'La mayoría de las apps se quedan en el seguimiento. Aquí se cierra el círculo:\n\n• Su nutricionista define la intención en My Rules\n• Usted vive el plan — comida, cuerpo, actividad, analíticas\n• Healthings ejecuta, aprende y explica\n• Al compartir, su nutricionista ve qué ocurre en el cuerpo\n• Juntos afinan el plan\n\nNo es otro diario de comida desconectado de la clínica.',
    card3Title: 'Wellness — con nivel profesional',
    card3Body:
      'Sin diagnóstico, sin recetas, sin sustituir a su médico. El valor es el método: acompañamiento licenciado, imagen viva del cuerpo y un feedback que se siente como una buena consulta.',
    card4Title: 'No es atención médica',
    card4Body:
      'Healthings trabaja según My Rules. Urgencias y decisiones médicas — solo con profesionales licenciados. Detalles y privacidad: ?',
    privacyLink: 'Cómo funciona · Privacidad',
  },
  units: {
    title: 'Unidades de medida',
    helpLabel: 'Unidades',
    lead: 'Así se muestran peso, altura, energía, agua y glucosa. Se puede cambiar en cualquier momento en Perfil.',
  },
  body: {
    title: 'Un poco sobre usted',
    helpLabel: 'Por qué lo pedimos',
    lead: 'Para calcular BMR, BMI y objetivos de energía.',
    gender: 'Género',
    height: 'Altura',
    birthDate: 'Fecha de nacimiento',
  },
  withingsTip: {
    title: '¿Qué es Withings?',
    body:
      'Withings fabrica básculas y relojes inteligentes. Si tiene uno, vincule su cuenta y Healthings lee peso y actividad desde su nube — no Bluetooth. ¿Sin Withings? Toque No e introduzca el peso después; la app sigue funcionando.',
    more: 'Más ayuda',
    dismiss: 'Entendido',
  },
  scale: {
    title: '¿Usa una báscula Withings?',
    helpLabel: '¿Qué es Withings?',
    exampleCaption: 'Ejemplo — cualquier báscula Withings\nde su cuenta',
    lead:
      'No pasa nada — introduzca el peso en los siguientes pasos; la app sigue funcionando. Sí — sincronizamos peso y composición desde su cuenta Withings (nube, no Bluetooth). Body, Body Scan y similares sirven.',
  },
  watch: {
    title: '¿Usa un reloj o pulsera Withings?',
    helpLabel: '¿Qué es Withings?',
    exampleCaption: 'Ejemplo — cualquier reloj o pulsera Withings\nde su cuenta',
    lead:
      'No pasa nada — pasos y pulso pueden venir de Health Connect / Apple Health (Garmin, Apple Watch, Samsung…). Sí — actividad desde su cuenta Withings.',
  },
  cgm: {
    title: '¿Usa un CGM para la glucosa?',
    helpLabel: 'Ayuda — CGM',
    exampleCaption: 'Glucosa desde la app de salud\nde su teléfono',
    lead:
      'No pasa nada — puede importar PDFs de laboratorio más adelante. Sí — glucosa continua vía Health Connect (Android) o Apple Health (iPhone).',
  },
  link: {
    title: 'Vincular Withings',
    helpLabel: 'Ayuda — vinculación',
    exampleCaption: 'Un enlace: Healthings ↔ Withings\n(báscula y reloj)',
    lead: 'La misma cuenta que en la app Withings. Un vínculo — para báscula y reloj.',
    connected: 'Withings vinculado',
    relinkHint: 'Puede volver a vincular desde Perfil.',
    linkBtn: 'Vincular Withings',
    opening: 'Abriendo Withings…',
    skipHint:
      'Puede omitir y vincular después en Perfil. Hasta entonces, los objetivos pueden basarse en un peso estimado.',
  },
  weight: {
    title: 'Peso inicial',
    helpLabel: 'Ayuda — peso',
    lead: 'Necesario para objetivos y balance de energía.',
    linkedHint:
      'Vinculado. Si la báscula aún no sincronizó — introduzca el peso o continúe y espere a la nube.',
    enterNow: 'Introducir peso ahora',
    skipWithings: 'Omitir — el peso vendrá de Withings',
    currentWeight: 'Peso actual',
    manualGuide: 'Cómo introducir a mano',
  },
  phoneHealth: {
    titleIos: 'Acceso a Apple Health',
    titleAndroid: 'Acceso a Health Connect',
    helpLabel: 'Salud del teléfono',
    exampleCaptionIos: 'Pasos y pulso desde Apple Health',
    exampleCaptionAndroid: 'Pasos y pulso vía Health Connect',
    leadIos:
      'A continuación, Apple Health puede pedir permiso una vez. Allow access: pasos y pulso cuando el reloj Withings está apagado.',
    leadAndroid:
      'A continuación, Health Connect puede abrirse una vez. Sin reloj Withings: pasos y pulso de cualquier marca que escriba en Health Connect.',
    cgmIos: 'CGM: CareSens Air → compartir con Apple Health → permitir Blood Glucose.',
    cgmAndroid: 'Glucosa en sangre — para gráficos CGM e impacto de las comidas.',
  },
  pdfs: {
    title: 'Informes — opcionales',
    helpLabel: 'Informes PDF',
    lead: '¿Ya tiene un PDF? Impórtelo ahora. Si no — continúe y hágalo después en la app.',
    labTitle: 'Informe de laboratorio',
    labHint: 'Lípidos, riñón y más — para objetivos de macros más precisos.',
    imported: 'Importado',
    importLab: 'Importar PDF de laboratorio',
    nutritionTitle: 'Consulta con el nutricionista',
    nutritionHint: 'Resumen de visita — los coaches se apoyan en el texto del plan.',
    importSession: 'Importar PDF del resumen',
  },
  targets: {
    title: 'Sus objetivos',
    helpLabel: 'Ayuda — objetivos',
    lead: 'La IA propone un objetivo corporal según su perfil. Los macros salen de My Rules — suyos o de la clínica — no del perfil.',
    waitOrRetry: 'Cargando objetivos… o inténtelo de nuevo.',
    retry: 'Reintentar',
    usingSaved:
      'Se mantiene el objetivo corporal guardado. «Regenerar» solo si quiere una cifra nueva de la IA.',
    bodyTarget: 'Objetivo corporal',
    dailyMacros: 'Macros',
    macrosFromRules: 'Macros en vivo reconstruidos desde My Rules.',
    macrosNeedRules: 'Aún no hay My Rules — los macros quedan vacíos hasta que usted o la clínica los escriban.',
    regenerate: 'Regenerar con AI',
  },
  meals: {
    title: 'Cómo registrar una comida',
    helpLabel: 'Registro de comidas',
    exampleCaption: 'Foto, texto o su coach\n— y se guarda en el diario',
    lead: 'Registre lo que come — el coach trabaja según My Rules y muestra el impacto en vivo en los gráficos.',
    b1: '1. Toque + en el gráfico metabólico → diario de comida.',
    b2: '2. Foto — fotografíe el plato y confirme lo que propone la IA.',
    b3: '3. Texto — describa la comida; la IA la descompone en macros.',
    b4: '4. También desde el chat — se guarda en el diario de comida.',
    logFirst: 'Registrar primera comida',
  },
};

const FR: QuickStartCopy = {
  quickStart: 'Démarrage rapide',
  progress: (n, total) => `Étape ${n} sur ${total}`,
  welcomeTo: 'Bienvenue sur Healthings',
  back: 'Retour',
  next: 'Continuer',
  finish: 'Terminer',
  working: 'Un instant…',
  help: 'Aide',
  yes: 'Oui',
  no: 'Non',
  tapYesNo: 'Choisissez Oui ou Non',
  genderMale: 'Homme',
  genderFemale: 'Femme',
  genderOther: 'Autre',
  ageYears: (n) => `Âge : ${n} ans`,
  brandTag: 'Système métabolique personnel — avec votre nutritionniste',
  language: {
    title: 'Langue de l’app et du coach',
    helpLabel: 'Aide — langue',
    lead:
      'C’est dans cette langue que se font le démarrage, le chat coach, les noms des repas et les rapports. L’aide s’ouvre aussi dedans.',
    mentorVoice: 'Mentor de l’app',
    mentorHint: 'Homme ou femme — ainsi vous parle le mentor IA. Pas le genre de votre profil.',
  },
  appearance: {
    title: 'Clair ou sombre ?',
    helpLabel: 'Apparence',
    lead: 'Aspect de l’app. « Système » suit le téléphone. Modifiable plus tard dans Profil.',
  },
  names: {
    title: 'Votre nom',
    helpLabel: 'Pourquoi on demande',
    lead: 'Pour que votre clinique puisse vous trouver dans la liste des patients. Modifiable plus tard dans Profil.',
    firstName: 'Prénom',
    lastName: 'Nom',
    required: 'Saisissez votre prénom et votre nom.',
    saveFailed: 'Impossible d’enregistrer le nom — vérifiez le réseau et réessayez.',
  },
  welcome: {
    title: 'Bienvenue',
    helpLabel: 'Comment fonctionne Healthings',
    lead:
      'Healthings apprend votre corps, explique ce qui se passe maintenant, et donne un feedback clair à votre nutritionniste — pour que le chemin vers vos objectifs se précise chaque jour.',
    card1Title: 'Apprend votre corps. Vous éclaire.',
    card1Body:
      'Graphiques en direct : poids, composition corporelle, activité et glucose (si connecté). Le modèle comprend comment votre corps réagit, explique les chiffres simplement, et vous guide selon My Rules — pour comprendre les progrès, pas seulement les stocker.',
    card2Title: 'Du suivi à la boucle complète',
    card2Body:
      'La plupart des apps s’arrêtent au suivi. Ici, la boucle se ferme :\n\n• Votre nutritionniste pose l’intention dans My Rules\n• Vous vivez le plan — repas, corps, activité, bilans\n• Healthings exécute, apprend et explique\n• En partageant, votre nutritionniste voit ce qui se passe dans le corps\n• Ensemble, vous affinez le plan\n\nPlus un journal alimentaire coupé de la clinique.',
    card3Title: 'Wellness — niveau professionnel',
    card3Body:
      'Pas de diagnostic, pas d’ordonnance, pas de remplacement du médecin. La valeur, c’est la méthode : accompagnement habilité, image vivante du corps, feedback digne d’un bon cabinet.',
    card4Title: 'Ce n’est pas un soin médical',
    card4Body:
      'Healthings travaille selon My Rules. Urgences et décisions médicales — uniquement chez des professionnels habilités. Détails et confidentialité : ?',
    privacyLink: 'Fonctionnement · Confidentialité',
  },
  units: {
    title: 'Unités de mesure',
    helpLabel: 'Unités',
    lead: 'Ainsi s’affichent poids, taille, énergie, eau et glucose. Modifiable à tout moment dans Profil.',
  },
  body: {
    title: 'Un peu sur vous',
    helpLabel: 'Pourquoi on demande',
    lead: 'Pour calculer BMR, BMI et les objectifs énergétiques.',
    gender: 'Genre',
    height: 'Taille',
    birthDate: 'Date de naissance',
  },
  withingsTip: {
    title: 'Qu’est-ce que Withings ?',
    body:
      'Withings fabrique des balances et montres connectées. Si vous en avez une, reliez votre compte — Healthings lit poids et activité depuis le cloud, pas le Bluetooth. Pas de Withings ? Touchez Non et saisissez le poids ensuite ; l’app fonctionne quand même.',
    more: 'Plus d’aide',
    dismiss: 'Compris',
  },
  scale: {
    title: 'Utilisez-vous une balance Withings ?',
    helpLabel: 'Qu’est-ce que Withings ?',
    exampleCaption: 'Exemple — toute balance Withings\nsur votre compte',
    lead:
      'Non, ce n’est pas un problème — saisissez le poids aux étapes suivantes ; l’app fonctionne quand même. Oui — sync du poids et de la composition depuis votre compte Withings (cloud, pas Bluetooth). Body, Body Scan et similaires conviennent.',
  },
  watch: {
    title: 'Utilisez-vous une montre ou un bracelet Withings ?',
    helpLabel: 'Qu’est-ce que Withings ?',
    exampleCaption: 'Exemple — toute montre ou bracelet Withings\nsur votre compte',
    lead:
      'Non, ce n’est pas un problème — pas et pouls peuvent venir de Health Connect / Apple Health (Garmin, Apple Watch, Samsung…). Oui — activité depuis votre compte Withings.',
  },
  cgm: {
    title: 'Utilisez-vous un CGM pour le glucose ?',
    helpLabel: 'Aide — CGM',
    exampleCaption: 'Glucose depuis l’app santé\nde votre téléphone',
    lead:
      'Non, ce n’est pas un problème — vous pourrez importer des PDF de laboratoire plus tard. Oui — glucose en continu via Health Connect (Android) ou Apple Health (iPhone).',
  },
  link: {
    title: 'Relier Withings',
    helpLabel: 'Aide — liaison',
    exampleCaption: 'Un lien : Healthings ↔ Withings\n(balance et montre)',
    lead: 'Le même compte que dans l’app Withings. Une liaison — pour la balance et la montre.',
    connected: 'Withings relié',
    relinkHint: 'Vous pouvez relier à nouveau depuis Profil.',
    linkBtn: 'Relier Withings',
    opening: 'Ouverture de Withings…',
    skipHint:
      'Vous pouvez passer et relier plus tard dans Profil. D’ici là, les objectifs peuvent s’appuyer sur un poids estimé.',
  },
  weight: {
    title: 'Poids de départ',
    helpLabel: 'Aide — poids',
    lead: 'Nécessaire pour les objectifs et le bilan énergétique.',
    linkedHint:
      'Relié. Si la balance n’a pas encore synchronisé — saisissez le poids, ou continuez et attendez le cloud.',
    enterNow: 'Saisir le poids maintenant',
    skipWithings: 'Passer — le poids viendra de Withings',
    currentWeight: 'Poids actuel',
    manualGuide: 'Comment saisir à la main',
  },
  phoneHealth: {
    titleIos: 'Accès à Apple Health',
    titleAndroid: 'Accès à Health Connect',
    helpLabel: 'Santé du téléphone',
    exampleCaptionIos: 'Pas et pouls depuis Apple Health',
    exampleCaptionAndroid: 'Pas et pouls via Health Connect',
    leadIos:
      'Ensuite, Apple Health peut demander une autorisation une fois. Allow access : pas et pouls quand la montre Withings est éteinte.',
    leadAndroid:
      'Ensuite, Health Connect peut s’ouvrir une fois. Sans montre Withings : pas et pouls de toute marque qui écrit dans Health Connect.',
    cgmIos: 'CGM : CareSens Air → partager avec Apple Health → autoriser Blood Glucose.',
    cgmAndroid: 'Glycémie — pour les graphiques CGM et l’impact des repas.',
  },
  pdfs: {
    title: 'Rapports — optionnels',
    helpLabel: 'Rapports PDF',
    lead: 'PDF déjà prêt ? Importez-le maintenant. Sinon — continuez et faites-le plus tard dans l’app.',
    labTitle: 'Compte-rendu de laboratoire',
    labHint: 'Lipides, rein et plus — pour des objectifs macros plus précis.',
    imported: 'Importé',
    importLab: 'Importer le PDF labo',
    nutritionTitle: 'Bilan avec le nutritionniste',
    nutritionHint: 'Compte-rendu de visite — les coaches s’appuient sur le texte du plan.',
    importSession: 'Importer le PDF du bilan',
  },
  targets: {
    title: 'Vos objectifs',
    helpLabel: 'Aide — objectifs',
    lead: 'L’IA propose un objectif corporel à partir de votre profil. Les macros viennent de My Rules — les vôtres ou celles de la clinique — pas du profil.',
    waitOrRetry: 'Chargement des objectifs… ou réessayez.',
    retry: 'Réessayer',
    usingSaved:
      'On garde votre objectif corporel enregistré. « Régénérer » seulement si vous voulez un nouveau chiffre IA.',
    bodyTarget: 'Objectif corporel',
    dailyMacros: 'Macros',
    macrosFromRules: 'Macros live reconstruites depuis My Rules.',
    macrosNeedRules: 'Pas encore de My Rules — les macros restent vides jusqu’à ce que vous ou la clinique les écriviez.',
    regenerate: 'Régénérer avec AI',
  },
  meals: {
    title: 'Comment enregistrer un repas',
    helpLabel: 'Journal alimentaire',
    exampleCaption: 'Photo, texte ou coach\n— puis enregistrement dans le journal',
    lead: 'Enregistrez ce que vous mangez — le coach travaille selon My Rules et montre l’impact en direct sur les graphiques.',
    b1: '1. Touchez + sur le graphique métabolique → journal alimentaire.',
    b2: '2. Photo — photographiez l’assiette, validez la proposition de l’IA.',
    b3: '3. Texte — décrivez le repas ; l’IA le découpe en macros.',
    b4: '4. Aussi depuis le chat — l’enregistrement se fait dans le journal.',
    logFirst: 'Enregistrer mon premier repas',
  },
};

const AR: QuickStartCopy = {
  quickStart: 'بداية سريعة',
  progress: (n, total) => `الخطوة ${n} من ${total}`,
  welcomeTo: 'مرحباً بكم في\nHealthings',
  back: 'رجوع',
  next: 'متابعة',
  finish: 'إنهاء',
  working: 'لحظة…',
  help: 'مساعدة',
  yes: 'نعم',
  no: 'لا',
  tapYesNo: 'اختاروا: نعم أو لا',
  genderMale: 'رجل',
  genderFemale: 'امرأة',
  genderOther: 'آخر',
  ageYears: (n) => `العمر ${n}`,
  brandTag: 'نظام أيضي شخصي — مع أخصائي التغذية لديكم',
  language: {
    title: 'لغة التطبيق والمدرب',
    helpLabel: 'مساعدة — اللغة',
    lead: 'بهذه اللغة تتم البداية، والدردشة مع المدرب، وأسماء الوجبات والتقارير. وصفحات المساعدة تُفتح بها أيضاً.',
    mentorVoice: 'المرشد في التطبيق',
    mentorHint: 'رجل أو امرأة — هكذا يخاطبكم المرشد. ليس جنس ملفكم الشخصي.',
  },
  appearance: {
    title: 'فاتح أم داكن؟',
    helpLabel: 'المظهر',
    lead: 'شكل التطبيق. «النظام» يتبع الهاتف. يمكن تغييره لاحقاً من الملف الشخصي.',
  },
  names: {
    title: 'اسمك',
    helpLabel: 'لماذا نسأل',
    lead: 'حتى تتمكن العيادة من إيجادك في قائمة المرضى. يمكن تعديله لاحقاً من الملف الشخصي.',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    required: 'أدخل الاسم الأول واسم العائلة.',
    saveFailed: 'تعذر حفظ الاسم — تحقق من الشبكة وحاول مرة أخرى.',
  },
  welcome: {
    title: 'مرحباً بكم',
    helpLabel: 'كيف يعمل Healthings',
    lead:
      // Brand on its own LTR line — avoids AR↔EN bidi flip mid-sentence (Michal / prompt111).
      'Healthings\nيتعلّم الجسم، ويشرح ما يحدث الآن، وينقل تغذية راجعة واضحة لأخصائي التغذية — حتى يصبح الطريق إلى أهدافكم أدق يوماً بعد يوم.',
    card1Title: 'يتعلّم الجسم. يعلّمكم.',
    card1Body:
      'رسوم حية للوزن وتركيب الجسم والنشاط والجلوكوز (عند الاتصال). النموذج يفهم كيف يستجيب الجسم، ويشرح الأرقام ببساطة، ويدرب وفق My Rules — لفهم التقدّم لا لجمع أرقام فقط.',
    card2Title: 'من التتبع إلى حلقة كاملة',
    card2Body:
      'معظم التطبيقات تتوقف عند التتبع. هنا تُغلق الحلقة:\n\n• أخصائي التغذية يضع النيّة في My Rules\n• أنتم تعيشون الخطة — طعام، جسم، نشاط، فحوصات\n• Healthings\nينفّذ ويتعلّم ويشرح\n• عند المشاركة يرى الأخصائي ما يحدث في الجسم\n• معاً تضبطون الخطة\n\nليس يوميات طعام منفصلة عن العيادة.',
    card3Title: 'Wellness — بمستوى مهني',
    card3Body:
      'بلا تشخيص، بلا وصفات، بلا استبدال للطبيب. القيمة في المنهج: مرافقة مرخّصة، صورة حيّة للجسم، وتغذية راجعة كعيادة جيدة.',
    card4Title: 'ليس رعاية طبية',
    card4Body:
      'Healthings يعمل وفق My Rules. الطوارئ والقرارات الطبية — لدى المهنيين المرخّصين فقط. للتفاصيل والخصوصية: ؟',
    privacyLink: 'كيف يعمل · الخصوصية',
  },
  units: {
    title: 'وحدات القياس',
    helpLabel: 'الوحدات',
    lead: 'كيف يظهر الوزن والطول والطاقة والماء والجلوكوز. يمكن التغيير في أي وقت من الملف.',
  },
  body: {
    title: 'نبذة عنكم',
    helpLabel: 'لماذا نسأل',
    lead: 'لحساب BMR و BMI وأهداف الطاقة.',
    gender: 'الجنس',
    height: 'الطول',
    birthDate: 'تاريخ الميلاد',
  },
  withingsTip: {
    title: 'ما هو Withings؟',
    body:
      'Withings تصنع موازين وساعات ذكية. إن كان لديكم جهاز، اربطوا الحساب — Healthings يقرأ الوزن والنشاط من السحابة، وليس Bluetooth. بلا Withings؟ اضغطوا لا وأدخلوا الوزن لاحقاً؛ التطبيق يعمل أيضاً.',
    more: 'مزيد من المساعدة',
    dismiss: 'حسناً',
  },
  scale: {
    title: 'هل تستخدمون ميزان Withings؟',
    helpLabel: 'ما هو Withings؟',
    exampleCaption: 'مثال — أي ميزان Withings\nفي حسابكم',
    lead:
      'لا؟ لا بأس — أدخلوا الوزن في الخطوات التالية؛ التطبيق يعمل أيضاً بدونها. نعم — نزامن الوزن وتركيب الجسم من حساب Withings (سحابة، وليس Bluetooth). Body و Body Scan وما شابه تناسب.',
  },
  watch: {
    title: 'هل تستخدمون ساعة أو سوار Withings؟',
    helpLabel: 'ما هو Withings؟',
    exampleCaption: 'مثال — أي ساعة أو سوار Withings\nفي حسابكم',
    lead:
      'لا؟ لا بأس — الخطوات والنبض يمكن أن تأتيا من Health Connect / Apple Health (Garmin، Apple Watch، Samsung…). نعم — النشاط من حساب Withings.',
  },
  cgm: {
    title: 'هل تستخدمون CGM للجلوكوز؟',
    helpLabel: 'مساعدة — CGM',
    exampleCaption: 'الجلوكوز من تطبيق الصحة\nعلى الهاتف',
    lead:
      'لا؟ لا بأس — يمكن استيراد PDF مختبر لاحقاً. نعم — جلوكوز مستمر عبر Health Connect أو Apple Health.',
  },
  link: {
    title: 'ربط Withings',
    helpLabel: 'مساعدة — الربط',
    exampleCaption: 'رابط واحد: Healthings ↔ Withings\n(الميزان والساعة)',
    lead: 'نفس حساب تطبيق Withings. ربط واحد — للميزان والساعة.',
    connected: 'Withings مربوط',
    relinkHint: 'يمكن الربط مجدداً من الملف.',
    linkBtn: 'ربط Withings',
    opening: 'جارٍ فتح Withings…',
    skipHint:
      'يمكن التخطي والمتابعة — الربط لاحقاً من الملف. حتى ذلك الحين قد تعتمد الأهداف على تقدير للوزن.',
  },
  weight: {
    title: 'الوزن الابتدائي',
    helpLabel: 'مساعدة — الوزن',
    lead: 'مطلوب للأهداف وتوازن الطاقة.',
    linkedHint:
      'مربوط. إن لم يزامن الميزان بعد — أدخلوا الوزن يدوياً، أو تابعوا وانتظروا السحابة.',
    enterNow: 'إدخال الوزن الآن',
    skipWithings: 'تخطٍ — الوزن سيأتي من Withings',
    currentWeight: 'الوزن الحالي',
    manualGuide: 'كيف تُدخلون يدوياً',
  },
  phoneHealth: {
    titleIos: 'الوصول إلى Apple Health',
    titleAndroid: 'الوصول إلى Health Connect',
    helpLabel: 'صحة الهاتف',
    exampleCaptionIos: 'خطوات ونبض من Apple Health',
    exampleCaptionAndroid: 'خطوات ونبض عبر Health Connect',
    leadIos:
      'بعدها قد يطلب Apple Health إذناً مرة واحدة. Allow access: خطوات ونبض عندما تكون ساعة Withings غير نشطة.',
    leadAndroid:
      'بعدها قد يُفتح Health Connect مرة واحدة. بلا ساعة Withings: خطوات ونبض من أي علامة تكتب إلى Health Connect.',
    cgmIos: 'CGM: CareSens Air → مشاركة مع Apple Health → Blood Glucose.',
    cgmAndroid: 'جلوكوز الدم — لرسوم CGM وتأثير الوجبات.',
  },
  pdfs: {
    title: 'تقارير — اختيارية',
    helpLabel: 'تقارير PDF',
    lead: 'هل لديكم PDF جاهز؟ استوردوه الآن. وإلا — تابعوا وافعلوا ذلك لاحقاً في التطبيق.',
    labTitle: 'تقرير مختبر',
    labHint: 'دهون وكلى وغيرها — لأهداف ماكرو أدق.',
    imported: 'تم الاستيراد',
    importLab: 'استيراد PDF مختبر',
    nutritionTitle: 'ملخص مع أخصائي التغذية',
    nutritionHint: 'ملخص زيارة — يعتمد المرشدون على نص الخطة.',
    importSession: 'استيراد PDF الملخص',
  },
  targets: {
    title: 'أهدافكم',
    helpLabel: 'مساعدة — الأهداف',
    lead: 'يقترح الذكاء هدف الجسم حسب ملفكم. الماكرو يُبنى من القواعد — قواعدكم أو العيادة — لا من الملف.',
    waitOrRetry: 'بانتظار الأهداف… أو إعادة المحاولة.',
    retry: 'إعادة المحاولة',
    usingSaved:
      'نبقى على هدف الجسم المحفوظ. «إعادة التوليد» فقط إذا أردتم رقماً جديداً من الذكاء.',
    bodyTarget: 'هدف الجسم',
    dailyMacros: 'ماكرو',
    macrosFromRules: 'ماكرو حي أُعيد بناؤه من القواعد.',
    macrosNeedRules: 'لا قواعد بعد — الماكرو يبقى فارغاً حتى تكتبوها أنتم أو العيادة.',
    regenerate: 'إعادة التوليد مع AI',
  },
  meals: {
    title: 'كيف تسجّلون وجبة',
    helpLabel: 'تسجيل الوجبات',
    exampleCaption: 'صورة أو نص أو المدرب\n— والحفظ في يوميات الطعام',
    lead: 'تسجّلون ما تأكلون — والمدرب يعمل وفق My Rules مع أثر حي على الرسوم.',
    b1: '1. اضغطوا + على الرسم الأيضي → سجل الطعام.',
    b2: '2. صورة — صوّروا الطبق ووافقوا على اقتراح الذكاء.',
    b3: '3. نص — اكتبوا ما أكلتم؛ الذكاء يفكّك إلى ماكرو.',
    b4: '4. يمكن أيضاً من الدردشة — الحفظ في سجل الطعام.',
    logFirst: 'تسجيل أول وجبة',
  },
};

const RU: QuickStartCopy = {
  quickStart: 'Быстрый старт',
  progress: (n, total) => `Шаг ${n} из ${total}`,
  welcomeTo: 'Добро пожаловать в Healthings',
  back: 'Назад',
  next: 'Далее',
  finish: 'Готово',
  working: 'Минуту…',
  help: 'Справка',
  yes: 'Да',
  no: 'Нет',
  tapYesNo: 'Выберите: Да или Нет',
  genderMale: 'Мужчина',
  genderFemale: 'Женщина',
  genderOther: 'Другое',
  ageYears: (n) => `Возраст: ${n}`,
  brandTag: 'Персональная метаболическая система — с вашим нутрициологом',
  language: {
    title: 'Язык приложения и коуча',
    helpLabel: 'Справка — язык',
    lead:
      'На этом языке проходит старт, чат с коучем, названия приёмов пищи и отчёты. Справка тоже открывается на нём.',
    mentorVoice: 'Наставник в приложении',
    mentorHint: 'Мужчина или женщина — так говорит ИИ-наставник. Не пол в профиле.',
  },
  appearance: {
    title: 'Светлая или тёмная?',
    helpLabel: 'Оформление',
    lead: 'Как выглядит приложение. «Система» следует телефону. Можно сменить позже в профиле.',
  },
  names: {
    title: 'Ваше имя',
    helpLabel: 'Зачем спрашиваем',
    lead: 'Чтобы клиника могла найти вас в списке пациентов. Можно изменить позже в профиле.',
    firstName: 'Имя',
    lastName: 'Фамилия',
    required: 'Введите имя и фамилию.',
    saveFailed: 'Не удалось сохранить имя — проверьте сеть и попробуйте снова.',
  },
  welcome: {
    title: 'Добро пожаловать',
    helpLabel: 'Как работает Healthings',
    lead:
      'Healthings учится вашему телу, объясняет, что происходит сейчас, и даёт ясный фидбек нутрициологу — чтобы путь к целям становился точнее с каждым днём.',
    card1Title: 'Учится телу. Объясняет вам.',
    card1Body:
      'Живые графики веса, состава тела, активности и глюкозы (если подключено). Модель понимает, как реагирует тело, объясняет цифры простым языком и ведёт по My Rules — чтобы видеть прогресс, а не только копить данные.',
    card2Title: 'От трекинга — к замкнутому кругу',
    card2Body:
      'Большинство приложений останавливаются на трекинге. Здесь круг замыкается:\n\n• Нутрициолог задаёт замысел в My Rules\n• Вы живёте план — еда, тело, активность, анализы\n• Healthings выполняет, учится и объясняет\n• При обмене нутрициолог видит, что происходит в теле\n• Вместе уточняете план\n\nНе ещё один дневник еды в отрыве от клиники.',
    card3Title: 'Wellness — на профессиональном уровне',
    card3Body:
      'Без диагнозов, без рецептов, без замены врача. Ценность — в методе: лицензированное сопровождение, живая картина тела и фидбек как в хорошей практике.',
    card4Title: 'Это не медицина',
    card4Body:
      'Healthings работает по My Rules. Экстренное и медицинские решения — только у лицензированных специалистов. Подробности и конфиденциальность: ?',
    privacyLink: 'Как это работает · Конфиденциальность',
  },
  units: {
    title: 'Единицы измерения',
    helpLabel: 'Единицы',
    lead: 'Как показывать вес, рост, энергию, воду и глюкозу. Позже можно сменить в разделе «Профиль».',
  },
  body: {
    title: 'Немного о вас',
    helpLabel: 'Зачем спрашиваем',
    lead: 'Для расчёта BMR, BMI и целей по энергии.',
    gender: 'Пол',
    height: 'Рост',
    birthDate: 'Дата рождения',
  },
  withingsTip: {
    title: 'Что такое Withings?',
    body:
      'Withings делает умные весы и часы. Если они у вас есть — свяжите аккаунт: Healthings читает вес и активность из облака, не по Bluetooth. Нет Withings? Нажмите «Нет» и введите вес дальше — приложение работает и так.',
    more: 'Ещё справка',
    dismiss: 'Понятно',
  },
  scale: {
    title: 'Пользуетесь весами Withings?',
    helpLabel: 'Что такое Withings?',
    exampleCaption: 'Пример — любые весы Withings\nв вашем аккаунте',
    lead:
      'Нет — нормально: введите вес на следующих шагах, приложение работает и без них. Да — синхронизируем вес и состав тела из аккаунта Withings (облако, не Bluetooth). Подойдут Body, Body Scan и похожие.',
  },
  watch: {
    title: 'Пользуетесь часами или браслетом Withings?',
    helpLabel: 'Что такое Withings?',
    exampleCaption: 'Пример — любые часы или браслет Withings\nв вашем аккаунте',
    lead:
      'Нет — нормально: шаги и пульс могут идти из Health Connect / Apple Health (Garmin, Apple Watch, Samsung…). Да — активность из аккаунта Withings.',
  },
  cgm: {
    title: 'Пользуетесь CGM для глюкозы?',
    helpLabel: 'Справка — CGM',
    exampleCaption: 'Глюкоза из приложения здоровья\nна телефоне',
    lead:
      'Нет — нормально: PDF анализов можно импортировать позже. Да — непрерывная глюкоза через Health Connect (Android) или Apple Health (iPhone).',
  },
  link: {
    title: 'Связь с Withings',
    helpLabel: 'Справка — связь',
    exampleCaption: 'Одна связь: Healthings ↔ Withings\n(весы и часы)',
    lead: 'Тот же аккаунт, что в приложении Withings. Одна связь — для весов и часов.',
    connected: 'Withings связан',
    relinkHint: 'Связать снова можно в разделе «Профиль».',
    linkBtn: 'Связать Withings',
    opening: 'Открываем Withings…',
    skipHint:
      'Можно пропустить и связать позже в разделе «Профиль». До этого цели могут опираться на оценку веса.',
  },
  weight: {
    title: 'Стартовый вес',
    helpLabel: 'Справка — вес',
    lead: 'Нужен для целей и энергобаланса.',
    linkedHint:
      'Связано. Если весы ещё не синхронизировались — введите вес вручную или идите дальше и ждите облако.',
    enterNow: 'Ввести вес сейчас',
    skipWithings: 'Пропустить — вес придёт из Withings',
    currentWeight: 'Текущий вес',
    manualGuide: 'Как ввести вручную',
  },
  phoneHealth: {
    titleIos: 'Доступ к Apple Health',
    titleAndroid: 'Доступ к Health Connect',
    helpLabel: 'Здоровье телефона',
    exampleCaptionIos: 'Шаги и пульс из Apple Health',
    exampleCaptionAndroid: 'Шаги и пульс через Health Connect',
    leadIos:
      'Дальше Apple Health может один раз запросить разрешение. Allow access: шаги и пульс, когда часы Withings выключены.',
    leadAndroid:
      'Дальше Health Connect может один раз открыться. Без часов Withings: шаги и пульс от любого бренда, пишущего в Health Connect.',
    cgmIos: 'CGM: CareSens Air → поделиться с Apple Health → Blood Glucose.',
    cgmAndroid: 'Глюкоза крови — для графиков CGM и влияния еды.',
  },
  pdfs: {
    title: 'Отчёты — по желанию',
    helpLabel: 'PDF-отчёты',
    lead: 'PDF уже есть? Импортируйте сейчас. Если нет — идите дальше и сделайте позже в приложении.',
    labTitle: 'Лабораторный отчёт',
    labHint: 'Липиды, почки и другое — для более точных макроцелей.',
    imported: 'Импортировано',
    importLab: 'Импорт PDF анализов',
    nutritionTitle: 'Саммари с нутрициологом',
    nutritionHint: 'Итог визита — коучи опираются на текст плана.',
    importSession: 'Импорт PDF саммари',
  },
  targets: {
    title: 'Ваши цели',
    helpLabel: 'Справка — цели',
    lead: 'ИИ предлагает цель по телу из вашего профиля. Макросы — из My Rules: ваши или клиники, не из профиля.',
    waitOrRetry: 'Ждём цели… или попробуйте снова.',
    retry: 'Повторить',
    usingSaved:
      'Оставляем сохранённую цель по телу. «Пересчитать» только если нужна новая цифра от ИИ.',
    bodyTarget: 'Цель по телу',
    dailyMacros: 'Макросы',
    macrosFromRules: 'Живые макросы пересобраны из My Rules.',
    macrosNeedRules: 'Пока нет My Rules — макросы пустые, пока вы или клиника их не напишете.',
    regenerate: 'Пересчитать с AI',
  },
  meals: {
    title: 'Как логировать еду',
    helpLabel: 'Дневник еды',
    exampleCaption: 'Фото, текст или наставник\n— сохранение в дневнике еды',
    lead: 'Логируйте, что едите — коуч работает по My Rules и показывает влияние на графиках вживую.',
    b1: '1. Нажмите + на метаболическом графике → дневник еды.',
    b2: '2. Фото — снимите тарелку, подтвердите предложение ИИ.',
    b3: '3. Текст — опишите приём пищи; ИИ разберёт на макросы.',
    b4: '4. Можно и из чата — сохранение в дневнике еды.',
    logFirst: 'Записать первый приём пищи',
  },
};

const PT: QuickStartCopy = {
  quickStart: 'Início rápido',
  progress: (n, total) => `Passo ${n} de ${total}`,
  welcomeTo: 'Bem-vindo(a) ao Healthings',
  back: 'Voltar',
  next: 'Continuar',
  finish: 'Concluir',
  working: 'Aguarde…',
  help: 'Ajuda',
  yes: 'Sim',
  no: 'Não',
  tapYesNo: 'Toque Sim ou Não',
  genderMale: 'Masculino',
  genderFemale: 'Feminino',
  genderOther: 'Outro',
  ageYears: (n) => `Idade: ${n} anos`,
  brandTag: 'Sistema metabólico personalizado — com seu nutricionista',
  language: {
    title: 'Idioma do app e do coach',
    helpLabel: 'Ajuda — idioma',
    lead:
      'Neste idioma funcionam o início rápido, o chat com o coach, nomes das refeições e relatórios. A ajuda também abre nele.',
    mentorVoice: 'Mentor do app',
    mentorHint: 'Homem ou mulher — como o mentor de IA fala com você. Não é o gênero do seu perfil.',
  },
  appearance: {
    title: 'Claro ou escuro?',
    helpLabel: 'Aparência',
    lead: 'Como o app aparece. «Sistema» segue o telefone. Pode mudar depois no Perfil.',
  },
  names: {
    title: 'Seu nome',
    helpLabel: 'Por que pedimos',
    lead: 'Para a clínica encontrar você na lista de pacientes. Pode editar depois no Perfil.',
    firstName: 'Nome',
    lastName: 'Sobrenome',
    required: 'Digite nome e sobrenome.',
    saveFailed: 'Não foi possível salvar o nome — verifique a rede e tente de novo.',
  },
  welcome: {
    title: 'Bem-vindo(a)',
    helpLabel: 'Como o Healthings funciona',
    lead:
      'O Healthings aprende seu corpo, explica o que acontece agora e envia feedback claro ao nutricionista — para que o caminho até suas metas fique mais preciso a cada dia.',
    card1Title: 'Aprende seu corpo. Ensina você.',
    card1Body:
      'Gráficos ao vivo de peso, composição corporal, atividade e glicose (quando conectado). O modelo entende como seu corpo responde, explica os números com clareza e orienta conforme My Rules — para entender o progresso, não só guardá-lo.',
    card2Title: 'Do rastreamento ao ciclo completo',
    card2Body:
      'A maioria dos apps para no rastreamento. Aqui o ciclo se fecha:\n\n• Seu nutricionista define a intenção em My Rules\n• Você vive o plano — refeições, corpo, atividade, exames\n• O Healthings executa, aprende e explica\n• Ao compartilhar, seu nutricionista vê o que acontece no corpo\n• Juntos refinam o plano\n\nNão é mais um diário alimentar desconectado da clínica.',
    card3Title: 'Wellness — com padrão profissional',
    card3Body:
      'Sem diagnóstico, sem prescrição, sem substituir seu médico. O valor está no método: acompanhamento licenciado, visão viva do corpo e feedback digno de uma boa consulta.',
    card4Title: 'Não é atendimento médico',
    card4Body:
      'O Healthings executa o plano conforme My Rules. Emergências e decisões médicas ficam com profissionais licenciados. Detalhes e privacidade: ?',
    privacyLink: 'Como funciona · Privacidade',
  },
  units: {
    title: 'Unidades de medida',
    helpLabel: 'Unidades',
    lead: 'Como peso, altura, energia, água e glicose aparecem no app. Você pode mudar depois em Perfil.',
  },
  body: {
    title: 'Sobre você',
    helpLabel: 'Por que perguntamos',
    lead: 'Usado para BMR, BMI e metas de energia.',
    gender: 'Sexo',
    height: 'Altura',
    birthDate: 'Data de nascimento',
  },
  withingsTip: {
    title: 'O que é Withings?',
    body:
      'Withings faz balanças e relógios inteligentes. Se você tem um, vincule a conta — o Healthings lê peso e atividade da nuvem, não do Bluetooth. Sem Withings? Toque Não e digite o peso depois; o app funciona mesmo assim.',
    more: 'Mais ajuda',
    dismiss: 'Entendi',
  },
  scale: {
    title: 'Você usa uma balança Withings?',
    helpLabel: 'O que é Withings?',
    exampleCaption: 'Exemplo — qualquer balança Withings\nda sua conta',
    lead:
      'Não tem problema — digite o peso nos próximos passos; o app funciona mesmo assim. Sim — sincronizamos peso e composição da sua conta Withings (nuvem, não Bluetooth). Body, Body Scan e similares servem.',
  },
  watch: {
    title: 'Você usa um relógio ou pulseira Withings?',
    helpLabel: 'O que é Withings?',
    exampleCaption: 'Exemplo — qualquer relógio ou pulseira Withings\nda sua conta',
    lead:
      'Não tem problema — passos e FC podem vir do Health Connect / Apple Health (Garmin, Apple Watch, Samsung…). Sim — atividade da sua conta Withings.',
  },
  cgm: {
    title: 'Você usa um CGM para glicose?',
    helpLabel: 'Ajuda — CGM',
    exampleCaption: 'Glicose do app de saúde\ndo seu telefone',
    lead:
      'Não tem problema — PDFs de laboratório podem ser importados depois. Sim — glicose contínua via Health Connect (Android) ou Apple Health (iPhone).',
  },
  link: {
    title: 'Vincular sua conta Withings',
    helpLabel: 'Ajuda — vinculação',
    exampleCaption: 'Um link: Healthings ↔ Withings\n(balança e relógio)',
    lead: 'A mesma conta do app Withings. Um vínculo — para balança e relógio.',
    connected: 'Withings conectado',
    relinkHint: 'Você pode revincular a qualquer momento em Perfil.',
    linkBtn: 'Vincular Withings',
    opening: 'Abrindo Withings…',
    skipHint:
      'Ou toque Continuar para pular — vincule depois em Perfil. Até lá, as metas podem usar uma estimativa de peso.',
  },
  weight: {
    title: 'Peso inicial',
    helpLabel: 'Ajuda — peso',
    lead: 'Necessário para metas e balanço energético.',
    linkedHint:
      'Vinculado — informe o peso se a balança ainda não sincronizou, ou toque Continuar e aguarde a nuvem.',
    enterNow: 'Informar peso agora',
    skipWithings: 'Pular — peso virá do Withings',
    currentWeight: 'Peso atual',
    manualGuide: 'Como informar manualmente',
  },
  phoneHealth: {
    titleIos: 'Permitir Apple Health',
    titleAndroid: 'Permitir Health Connect',
    helpLabel: 'Saúde do celular',
    exampleCaptionIos: 'Passos e FC do Apple Health',
    exampleCaptionAndroid: 'Passos e FC via Health Connect',
    leadIos:
      'Toque Continuar — o Apple Health pode pedir permissão uma vez. Allow access: passos e FC quando o relógio Withings estiver desligado.',
    leadAndroid:
      'Toque Continuar — o Health Connect pode abrir uma vez. Sem relógio Withings: passos e FC de qualquer marca que escreva no Health Connect.',
    cgmIos: 'CGM: CareSens Air → compartilhar com Apple Health → permitir Blood Glucose.',
    cgmAndroid: 'Glicose no sangue — para gráficos CGM e impacto das refeições.',
  },
  pdfs: {
    title: 'Relatórios — opcionais',
    helpLabel: 'Relatórios PDF',
    lead: 'Já tem um PDF? Importe agora. Se não — continue e faça depois no app.',
    labTitle: 'Laudo de laboratório',
    labHint: 'Lipídios, função renal e mais — para metas de macro mais precisas.',
    imported: 'Importado',
    importLab: 'Importar PDF de laboratório',
    nutritionTitle: 'Sessão com nutricionista',
    nutritionHint: 'Resumo da consulta — os coaches seguem o texto do plano.',
    importSession: 'Importar PDF da sessão',
  },
  targets: {
    title: 'Suas metas',
    helpLabel: 'Ajuda — metas',
    lead: 'A IA sugere uma meta corporal a partir do seu perfil. Macros vêm de My Rules — suas ou da clínica — não do perfil.',
    waitOrRetry: 'Aguardando metas… ou toque em Tentar de novo.',
    retry: 'Tentar de novo',
    usingSaved:
      'Usando a meta corporal salva. Regenerar só se quiser um número novo da IA.',
    bodyTarget: 'Meta corporal',
    dailyMacros: 'Macros',
    macrosFromRules: 'Macros ao vivo reconstruídos a partir de My Rules.',
    macrosNeedRules: 'Ainda sem My Rules — macros ficam vazios até você ou a clínica escreverem.',
    regenerate: 'Regenerar com AI',
  },
  meals: {
    title: 'Como registrar refeições',
    helpLabel: 'Registro de refeições',
    exampleCaption: 'Foto, texto ou coach\n— e salva no diário alimentar',
    lead:
      'Registre o que come — o coach trabalha conforme My Rules e mostra o impacto ao vivo nos gráficos.',
    b1: '1. Toque + no gráfico metabólico → diário alimentar.',
    b2: '2. Foto — fotografe o prato; a IA lista itens; você aprova.',
    b3: '3. Texto — descreva a refeição; a IA calcula os macros.',
    b4: '4. O chat do coach também pode sugerir o que registrar — salve pelo diário.',
    logFirst: 'Registrar minha primeira refeição',
  },
};

const IT: QuickStartCopy = {
  quickStart: 'Avvio rapido',
  progress: (n, total) => `Passaggio ${n} di ${total}`,
  welcomeTo: 'Benvenuto/a in Healthings',
  back: 'Indietro',
  next: 'Continua',
  finish: 'Fine',
  working: 'Un attimo…',
  help: 'Aiuto',
  yes: 'Sì',
  no: 'No',
  tapYesNo: 'Tocca Sì o No',
  genderMale: 'Uomo',
  genderFemale: 'Donna',
  genderOther: 'Altro',
  ageYears: (n) => `Età: ${n} anni`,
  brandTag: 'Sistema metabolico personalizzato — con il tuo nutrizionista',
  language: {
    title: 'Lingua app e coach',
    helpLabel: 'Aiuto — lingua',
    lead:
      'In questa lingua funzionano avvio rapido, chat con il coach, nomi dei pasti e report. Anche l’aiuto si apre in essa.',
    mentorVoice: 'Mentor dell’app',
    mentorHint: 'Uomo o donna — come parla il mentor IA. Non è il genere del profilo.',
  },
  appearance: {
    title: 'Chiaro o scuro?',
    helpLabel: 'Aspetto',
    lead: 'Come appare l’app. «Sistema» segue il telefono. Si può cambiare dopo in Profilo.',
  },
  names: {
    title: 'Il tuo nome',
    helpLabel: 'Perché lo chiediamo',
    lead: 'Così la clinica può trovarti nell’elenco pazienti. Modificabile dopo in Profilo.',
    firstName: 'Nome',
    lastName: 'Cognome',
    required: 'Inserisci nome e cognome.',
    saveFailed: 'Impossibile salvare il nome — controlla la rete e riprova.',
  },
  welcome: {
    title: 'Benvenuto/a',
    helpLabel: 'Come funziona Healthings',
    lead:
      'Healthings impara il tuo corpo, spiega cosa succede ora e invia feedback chiaro al nutrizionista — così il percorso verso gli obiettivi diventa più preciso ogni giorno.',
    card1Title: 'Impara il corpo. Insegna a te.',
    card1Body:
      'Grafici live di peso, composizione corporea, attività e glucosio (se connesso). Il modello capisce come reagisce il corpo, spiega i numeri in modo semplice e guida secondo My Rules — per capire i progressi, non solo archiviarli.',
    card2Title: 'Dal tracking al ciclo completo',
    card2Body:
      'La maggior parte delle app si ferma al tracking. Qui il ciclo si chiude:\n\n• Il nutrizionista definisce l’intento in My Rules\n• Tu vivi il piano — pasti, corpo, attività, analisi\n• Healthings esegue, impara e spiega\n• Condividendo, il nutrizionista vede cosa succede nel corpo\n• Insieme affinate il piano\n\nNon un altro diario alimentare scollegato dalla clinica.',
    card3Title: 'Wellness — standard professionale',
    card3Body:
      'Niente diagnosi, niente prescrizioni, niente sostituzione del medico. Il valore è nel metodo: accompagnamento autorizzato, immagine viva del corpo e feedback degno di una buona visita.',
    card4Title: 'Non è assistenza medica',
    card4Body:
      'Healthings esegue il piano secondo My Rules. Emergenze e decisioni mediche restano ai professionisti autorizzati. Dettagli e privacy: ?',
    privacyLink: 'Come funziona · Privacy',
  },
  units: {
    title: 'Unità di misura',
    helpLabel: 'Unità',
    lead: 'Come compaiono peso, altezza, energia, acqua e glucosio. Modificabile in qualsiasi momento in Profilo.',
  },
  body: {
    title: 'Su di te',
    helpLabel: 'Perché chiediamo',
    lead: 'Per calcolare BMR, BMI e obiettivi energetici.',
    gender: 'Sesso',
    height: 'Altezza',
    birthDate: 'Data di nascita',
  },
  withingsTip: {
    title: 'Cos’è Withings?',
    body:
      'Withings produce bilance e orologi smart. Se ne hai uno, collega l’account — Healthings legge peso e attività dal cloud, non da Bluetooth. Niente Withings? Tocca No e inserisci il peso dopo; l’app funziona lo stesso.',
    more: 'Altro aiuto',
    dismiss: 'Ho capito',
  },
  scale: {
    title: 'Usi una bilancia Withings?',
    helpLabel: 'Cos’è Withings?',
    exampleCaption: 'Esempio — qualsiasi bilancia Withings\nnel tuo account',
    lead:
      'Nessun problema — inserisci il peso nei passaggi successivi; l’app funziona lo stesso. Sì — sincronizziamo peso e composizione dal tuo account Withings (cloud, non Bluetooth). Body, Body Scan e simili vanno bene.',
  },
  watch: {
    title: 'Usi un orologio o bracciale Withings?',
    helpLabel: 'Cos’è Withings?',
    exampleCaption: 'Esempio — qualsiasi orologio o bracciale Withings\nnel tuo account',
    lead:
      'Nessun problema — passi e FC possono arrivare da Health Connect / Apple Health (Garmin, Apple Watch, Samsung…). Sì — attività dal tuo account Withings.',
  },
  cgm: {
    title: 'Usi un CGM per il glucosio?',
    helpLabel: 'Aiuto — CGM',
    exampleCaption: 'Glucosio dall’app salute\ndel telefono',
    lead:
      'Nessun problema — i PDF di laboratorio si possono importare dopo. Sì — glucosio continuo via Health Connect (Android) o Apple Health (iPhone).',
  },
  link: {
    title: 'Collega il tuo account Withings',
    helpLabel: 'Aiuto — collegamento',
    exampleCaption: 'Un collegamento: Healthings ↔ Withings\n(bilancia e orologio)',
    lead: 'Lo stesso account dell’app Withings. Un collegamento — per bilancia e orologio.',
    connected: 'Withings collegato',
    relinkHint: 'Puoi ricollegare in qualsiasi momento dal Profilo.',
    linkBtn: 'Collega Withings',
    opening: 'Apertura Withings…',
    skipHint:
      'O tocca Continua per saltare — collega dopo in Profilo. Fino ad allora, gli obiettivi possono basarsi su una stima del peso.',
  },
  weight: {
    title: 'Peso iniziale',
    helpLabel: 'Aiuto — peso',
    lead: 'Necessario per obiettivi e bilancio energetico.',
    linkedHint:
      'Collegato — inserisci il peso se la bilancia non ha ancora sincronizzato, oppure continua e attendi il cloud.',
    enterNow: 'Inserisci peso ora',
    skipWithings: 'Salta — peso da Withings',
    currentWeight: 'Peso attuale',
    manualGuide: 'Come inserire manualmente',
  },
  phoneHealth: {
    titleIos: 'Consenti Apple Health',
    titleAndroid: 'Consenti Health Connect',
    helpLabel: 'Salute del telefono',
    exampleCaptionIos: 'Passi e FC da Apple Health',
    exampleCaptionAndroid: 'Passi e FC via Health Connect',
    leadIos:
      'Tocca Continua — Apple Health può chiedere permesso una volta. Allow access: passi e FC quando l’orologio Withings è spento.',
    leadAndroid:
      'Tocca Continua — Health Connect può aprirsi una volta. Senza orologio Withings: passi e FC da qualsiasi marca che scrive su Health Connect.',
    cgmIos: 'CGM: CareSens Air → condividi con Apple Health → consenti Blood Glucose.',
    cgmAndroid: 'Glicemia — per grafici CGM e impatto dei pasti.',
  },
  pdfs: {
    title: 'Report — opzionali',
    helpLabel: 'Report PDF',
    lead: 'Hai già un PDF? Importalo ora. Altrimenti — continua e fallo dopo nell’app.',
    labTitle: 'Referto di laboratorio',
    labHint: 'Lipidi, reni e altro — per obiettivi macro più precisi.',
    imported: 'Importato',
    importLab: 'Importa PDF di laboratorio',
    nutritionTitle: 'Sessione con nutrizionista',
    nutritionHint: 'Riepilogo visita — i coach seguono il testo del piano.',
    importSession: 'Importa PDF sessione',
  },
  targets: {
    title: 'I tuoi obiettivi',
    helpLabel: 'Aiuto — obiettivi',
    lead: 'L’IA propone un obiettivo corporeo dal tuo profilo. I macro arrivano da My Rules — tue o della clinica — non dal profilo.',
    waitOrRetry: 'In attesa degli obiettivi… o tocca Riprova.',
    retry: 'Riprova',
    usingSaved:
      'Si usa l’obiettivo corporeo salvato. Rigenera solo se vuoi un nuovo numero dall’IA.',
    bodyTarget: 'Obiettivo corporeo',
    dailyMacros: 'Macro',
    macrosFromRules: 'Macro live ricostruiti da My Rules.',
    macrosNeedRules: 'Ancora niente My Rules — i macro restano vuoti finché non li scrivi tu o la clinica.',
    regenerate: 'Rigenera con AI',
  },
  meals: {
    title: 'Come registrare i pasti',
    helpLabel: 'Registro pasti',
    exampleCaption: 'Foto, testo o coach\n— poi salva nel diario pasti',
    lead:
      'Registra cosa mangi — il coach lavora secondo My Rules e mostra l’impatto live sui grafici.',
    b1: '1. Tocca + sul grafico metabolico → diario alimentare.',
    b2: '2. Foto — scatta il piatto; l’IA elenca le voci; tu approvi.',
    b3: '3. Testo — descrivi il pasto; l’IA calcola i macro.',
    b4: '4. Anche dalla chat del coach — salva dal diario alimentare.',
    logFirst: 'Registra il mio primo pasto',
  },
};

const TR: QuickStartCopy = {
  quickStart: 'Hızlı başlangıç',
  progress: (n, total) => `Adım ${n}/${total}`,
  welcomeTo: 'Healthings’e hoş geldiniz',
  back: 'Geri',
  next: 'Devam',
  finish: 'Bitir',
  working: 'Bir dakika…',
  help: 'Yardım',
  yes: 'Evet',
  no: 'Hayır',
  tapYesNo: 'Evet veya Hayır’a dokunun',
  genderMale: 'Erkek',
  genderFemale: 'Kadın',
  genderOther: 'Diğer',
  ageYears: (n) => `Yaş: ${n}`,
  brandTag: 'Kişisel metabolik sistem — diyetisyeninizle birlikte',
  language: {
    title: 'Uygulama ve koç dili',
    helpLabel: 'Yardım — dil',
    lead:
      'Hızlı başlangıç, koç sohbeti, öğün adları ve raporlar bu dilde çalışır. Yardım sayfaları da aynı dilde açılır.',
    mentorVoice: 'Uygulama mentoru',
    mentorHint: 'Erkek veya kadın — yapay zekâ mentorunuzun konuşma biçimi. Profil cinsiyetiniz değil.',
  },
  appearance: {
    title: 'Açık mı koyu mu?',
    helpLabel: 'Görünüm',
    lead: 'Uygulama nasıl görünsün. “Sistem” telefonu izler. Sonra Profil’den değiştirebilirsiniz.',
  },
  names: {
    title: 'Adınız',
    helpLabel: 'Neden soruyoruz',
    lead: 'Kliniğin sizi hasta listesinde bulabilmesi için. Sonra Profil’den düzenleyebilirsiniz.',
    firstName: 'Ad',
    lastName: 'Soyad',
    required: 'Ad ve soyad girin.',
    saveFailed: 'Ad kaydedilemedi — ağı kontrol edip tekrar deneyin.',
  },
  welcome: {
    title: 'Hoş geldiniz',
    helpLabel: 'Healthings nasıl çalışır',
    lead:
      'Healthings vücudunuzu öğrenir, o anda ne olduğunu açıklar ve diyetisyeninize net geri bildirim verir — hedeflerinize giden yol her gün biraz daha keskinleşir.',
    card1Title: 'Vücudunuzu öğrenir. Size anlatır.',
    card1Body:
      'Kilo, vücut bileşimi, aktivite ve glukoz (bağlıysa) canlı grafikler. Model vücudunuzun nasıl yanıt verdiğini anlar, sayıları sade bir dille açıklar ve My Rules altında koçluk yapar — ilerlemeyi anlamak için, sadece kaydetmek değil.',
    card2Title: 'Takipten tam döngüye',
    card2Body:
      'Çoğu uygulama takipte kalır. Burada döngü kapanır:\n\n• Diyetisyeniniz My Rules’ta klinik niyeti belirler\n• Siz planı yaşarsınız — öğünler, vücut, aktivite, tahliller\n• Healthings uygular, öğrenir ve açıklar\n• Paylaştığınızda diyetisyeniniz vücutta ne olduğunu görür\n• Birlikte planı netleştirirsiniz\n\nKlinikten kopuk bir başka yemek günlüğü değil.',
    card3Title: 'Wellness — profesyonel standart',
    card3Body:
      'Tanı yok, reçete yok, doktorunuzun yerini almaz. Değer yöntemdedir: lisanslı rehberlik, canlı vücut görüntüsü ve iyi bir muayene hissi veren geri bildirim.',
    card4Title: 'Tıbbi bakım değildir',
    card4Body:
      'Healthings My Rules altında planı uygular. Acil durum ve tıbbi kararlar lisanslı profesyonellere aittir. Ayrıntılar ve gizlilik: ?',
    privacyLink: 'Nasıl çalışır · Gizlilik',
  },
  units: {
    title: 'Ölçü birimleri',
    helpLabel: 'Birimler',
    lead: 'Kilo, boy, enerji, su ve glikoz uygulamada nasıl görünür. Profil’de istediğiniz zaman değiştirebilirsiniz.',
  },
  body: {
    title: 'Sizin hakkınızda',
    helpLabel: 'Neden soruyoruz',
    lead: 'BMR, BMI ve enerji hedefleri için.',
    gender: 'Cinsiyet',
    height: 'Boy',
    birthDate: 'Doğum tarihi',
  },
  withingsTip: {
    title: 'Withings nedir?',
    body:
      'Withings akıllı tartı ve saat üretir. Varsa hesabınızı bağlayın — Healthings kilo ve aktiviteyi buluttan okur, Bluetooth’tan değil. Withings yok mu? Hayır’a dokunun, sonra kilo girin; uygulama yine çalışır.',
    more: 'Daha fazla yardım',
    dismiss: 'Anladım',
  },
  scale: {
    title: 'Withings tartı kullanıyor musunuz?',
    helpLabel: 'Withings nedir?',
    exampleCaption: 'Örnek — hesabınızdaki herhangi bir\nWithings tartı',
    lead:
      'Hayır sorun değil — sonraki adımlarda kilo girin; uygulama yine çalışır. Evet — kilo ve vücut kompozisyonunu Withings hesabınızdan senkronlarız (bulut, Bluetooth değil). Body, Body Scan ve benzerleri uygundur.',
  },
  watch: {
    title: 'Withings saat veya bileklik kullanıyor musunuz?',
    helpLabel: 'Withings nedir?',
    exampleCaption: 'Örnek — hesabınızdaki herhangi bir\nWithings saat veya bileklik',
    lead:
      'Hayır sorun değil — adım ve nabız Health Connect / Apple Health’ten gelebilir (Garmin, Apple Watch, Samsung…). Evet — aktivite Withings hesabınızdan.',
  },
  cgm: {
    title: 'Glukoz için CGM kullanıyor musunuz?',
    helpLabel: 'Yardım — CGM',
    exampleCaption: 'Telefondaki sağlık uygulamasından\nglikoz',
    lead:
      'Hayır sorun değil — laboratuvar PDF’lerini sonra içe aktarabilirsiniz. Evet — sürekli glukoz Health Connect (Android) veya Apple Health (iPhone) üzerinden.',
  },
  link: {
    title: 'Withings hesabınızı bağlayın',
    helpLabel: 'Yardım — bağlama',
    exampleCaption: 'Tek bağlantı: Healthings ↔ Withings\n(tartı ve saat)',
    lead: 'Withings uygulamasındaki aynı hesap. Tek bağlantı — tartı ve saat için.',
    connected: 'Withings bağlı',
    relinkHint: 'Profil’den istediğiniz zaman yeniden bağlayabilirsiniz.',
    linkBtn: 'Withings bağla',
    opening: 'Withings açılıyor…',
    skipHint:
      'Veya Devam’a dokunarak atlayın — Profil’de sonra bağlayın. O zamana kadar hedefler geçici kilo tahminine dayanabilir.',
  },
  weight: {
    title: 'Başlangıç kilosu',
    helpLabel: 'Yardım — kilo',
    lead: 'Hedefler ve enerji dengesi için gerekli.',
    linkedHint:
      'Bağlı — tartı henüz senkronize olmadıysa kilo girin veya Devam deyip bulutu bekleyin.',
    enterNow: 'Kiloyu şimdi gir',
    skipWithings: 'Atla — kilo Withings’ten gelecek',
    currentWeight: 'Güncel kilo',
    manualGuide: 'Manuel giriş rehberi',
  },
  phoneHealth: {
    titleIos: 'Apple Health’e izin ver',
    titleAndroid: 'Health Connect’e izin ver',
    helpLabel: 'Telefon sağlığı',
    exampleCaptionIos: 'Apple Health’ten adım ve nabız',
    exampleCaptionAndroid: 'Health Connect üzerinden adım ve nabız',
    leadIos:
      'Devam’a dokunun — Apple Health bir kez izin isteyebilir. Allow access: Withings saati kapalıyken adım ve nabız.',
    leadAndroid:
      'Devam’a dokunun — Health Connect bir kez açılabilir. Withings saati yoksa: Health Connect’e yazan her markadan adım ve nabız.',
    cgmIos: 'CGM: CareSens Air → Apple Health ile paylaş → Blood Glucose’a izin ver.',
    cgmAndroid: 'Kan glukozu — CGM grafikleri ve öğün etkisi için.',
  },
  pdfs: {
    title: 'Raporlar — isteğe bağlı',
    helpLabel: 'PDF raporlar',
    lead: 'Hazır PDF’niz var mı? Şimdi içe aktarın. Yoksa — devam edin, uygulamada sonra yapın.',
    labTitle: 'Laboratuvar raporu',
    labHint: 'Lipidler, böbrek ve daha fazlası — daha doğru makro hedefleri için.',
    imported: 'İçe aktarıldı',
    importLab: 'Laboratuvar PDF içe aktar',
    nutritionTitle: 'Diyetisyen seansı',
    nutritionHint: 'Ziyaret özeti — koçlar plan metnini takip eder.',
    importSession: 'Seans PDF içe aktar',
  },
  targets: {
    title: 'Hedefleriniz',
    helpLabel: 'Yardım — hedefler',
    lead: 'Yapay zekâ profilinizden bir vücut hedefi önerir. Makrolar My Rules’tan gelir — sizin veya kliniğin — profilden değil.',
    waitOrRetry: 'Hedefler bekleniyor… veya Yeniden dene.',
    retry: 'Yeniden dene',
    usingSaved:
      'Kayıtlı vücut hedefi kullanılıyor. Yalnızca yeni bir yapay zekâ sayısı istiyorsanız Yeniden oluştur.',
    bodyTarget: 'Vücut hedefi',
    dailyMacros: 'Makrolar',
    macrosFromRules: 'Canlı makrolar My Rules’tan yeniden kuruldu.',
    macrosNeedRules: 'Henüz My Rules yok — siz veya klinik yazana kadar makrolar boş kalır.',
    regenerate: 'AI ile yeniden oluştur',
  },
  meals: {
    title: 'Öğün nasıl kaydedilir',
    helpLabel: 'Öğün kaydı',
    exampleCaption: 'Fotoğraf, metin veya koç\n— yemek günlüğüne kaydedin',
    lead:
      'Ne yediğinizi kaydedin — koç My Rules altında çalışır ve etkiyi grafiklerde canlı gösterir.',
    b1: '1. Metabolik grafikte + → yemek günlüğü.',
    b2: '2. Fotoğraf — tabağı çekin; yapay zekâ kalemleri listeler; onaylayın.',
    b3: '3. Metin — öğünü tarif edin; yapay zekâ makrolara ayırır.',
    b4: '4. Koç sohbetinden de öneri alabilirsiniz — kayıt yemek günlüğünden.',
    logFirst: 'İlk öğünümü kaydet',
  },
};

export function isRtlLang(code: string): boolean {
  const c = (code || '').toLowerCase().slice(0, 2);
  return c === 'he' || c === 'ar';
}

/**
 * AI mentor gender picker — all app languages.
 * Controls coach *voice* (how the AI addresses you), not profile gender.
 * Was he/ar-only for grammar; English still needs the voice choice on coach step.
 */
export function usesMentorGenderUi(_code: string | null | undefined): boolean {
  return true;
}

export function getQuickStartCopy(langCode: string): QuickStartCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  if (c === 'de') return DE;
  if (c === 'es') return ES;
  if (c === 'fr') return FR;
  if (c === 'ar') return AR;
  if (c === 'ru') return RU;
  if (c === 'pt') return PT;
  if (c === 'it') return IT;
  if (c === 'tr') return TR;
  return EN;
}
