/**
 * Quick Start copy — English + Hebrew (prompt81 Phase A).
 * Glossary (kcal, Withings, CGM, BMR, My Rules, AI…) stays English inside Hebrew.
 *
 * Hebrew voice (native Israeli microcopy — not EN→HE):
 * - Write as if the screen was born in Hebrew; never mirror English sentence shape.
 * - Plural “אתם” for inclusivity; prefer infinitive CTAs (להמשיך, להזין) over gendered imperative.
 * - Short, direct, spoken — like a sharp WhatsApp from a clinic, not a brochure.
 * - Cut filler (“על מנת”, “במסגרת”, “אופטימיזציה”); keep one idea per line.
 * - When revising with AI: paste EN + this brief; ask for mother-tongue rewrite, then human pass (e.g. Idit).
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
  scale: {
    title: string;
    helpLabel: string;
    lead: string;
  };
  watch: {
    title: string;
    helpLabel: string;
    lead: string;
  };
  cgm: {
    title: string;
    helpLabel: string;
    lead: string;
  };
  link: {
    title: string;
    helpLabel: string;
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
    rulesApplied: string;
    regenerate: string;
  };
  meals: {
    title: string;
    helpLabel: string;
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
  progress: (n, total) => `Quick Start · ${n} of ${total}`,
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
    mentorVoice: 'Mentor voice gender',
    mentorHint: 'How the coach addresses you in Hebrew or Arabic — not your profile gender.',
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
    lead: 'How weight, height, and energy appear in the app. You can change this later in My Profile.',
  },
  body: {
    title: 'About you',
    helpLabel: 'Why we ask',
    lead: 'Used for BMR, BMI, and energy targets.',
    gender: 'Gender',
    height: 'Height',
    birthDate: 'Birth date',
  },
  scale: {
    title: 'Do you have a Withings body scale?',
    helpLabel: 'Scale help',
    lead:
      'Any Withings scale on your Withings account works — Body, Body Scan, and similar. Healthings reads the cloud after you link (not Bluetooth).',
  },
  watch: {
    title: 'Do you have a Withings watch or activity band?',
    helpLabel: 'Watch help',
    lead:
      'Yes → activity and heart rate from Withings cloud. No → from Health Connect / Apple Health (Garmin, Apple Watch, Samsung, etc.).',
  },
  cgm: {
    title: 'Do you track glucose with a CGM?',
    helpLabel: 'CGM help',
    lead:
      'Continuous glucose via Health Connect (Android) or Apple Health (iPhone). You can also import lab PDFs later.',
  },
  link: {
    title: 'Link your Withings account',
    helpLabel: 'Linking help',
    lead: 'Sign in with the same account used in the Withings app. One link covers scale and watch data.',
    connected: 'Withings connected',
    relinkHint: 'You can re-link anytime in My Profile.',
    linkBtn: 'Link Withings',
    opening: 'Opening Withings…',
    skipHint:
      'Or tap Next to skip — link later in My Profile. Targets may use a temporary weight estimate until you link.',
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
    lead: 'AI suggests body and macro targets from your profile.',
    waitOrRetry: 'Wait for targets or tap Retry.',
    retry: 'Retry',
    usingSaved:
      'Using your saved targets — My Rules and prior edits are kept. Tap Regenerate only if you want fresh AI numbers.',
    bodyTarget: 'Body target',
    dailyMacros: 'Daily macros',
    rulesApplied: 'Rules applied',
    regenerate: 'Regenerate with AI',
  },
  meals: {
    title: 'How to log meals',
    helpLabel: 'Meal logging',
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
  progress: (n, total) => `התחלה מהירה · ${n} מתוך ${total}`,
  welcomeTo: 'ברוכים הבאים ל־Healthings',
  back: 'חזרה',
  next: 'המשך',
  finish: 'סיום',
  working: 'רגע…',
  help: 'עזרה',
  yes: 'כן',
  no: 'לא',
  tapYesNo: 'כן או לא?',
  genderMale: 'גבר',
  genderFemale: 'אישה',
  genderOther: 'אחר',
  ageYears: (n) => `גיל ${n}`,
  brandTag: 'מערכת מטבולית אישית — עם התזונאי שלכם',
  language: {
    title: 'שפת האפליקציה והמאמן',
    helpLabel: 'עזרה — שפה',
    lead: 'בשפה הזו עוברים את ההתחלה, מדברים עם המאמן, רואים שמות ארוחות ודוחות. גם העזרה נפתחת בה.',
    mentorVoice: 'איך המאמן פונה',
    mentorHint: 'פנייה בעברית או בערבית — לא המגדר שבפרופיל.',
  },
  welcome: {
    title: 'ברוכים הבאים',
    helpLabel: 'איך Healthings עובד',
    lead:
      'Healthings לומדת את הגוף, מסבירה בזמן אמת, ומעבירה משוב ברור לתזונאי — כדי שהדרך ליעדים תהיה חדה יותר בכל יום.',
    card1Title: 'לומדת את הגוף. מלמדת אתכם.',
    card1Body:
      'גרפים חיים: משקל, הרכב גוף, פעילות וגלוקוז (כשמחוברים). המודל מבין איך הגוף מגיב, מסביר את המספרים בפשטות, ומאמן לפי My Rules — כדי להבין התקדמות, לא רק לאסוף מספרים.',
    card2Title: 'המעגל לא נשבר באמצע',
    card2Body:
      'רוב האפליקציות עוצרות במעקב. כאן זה מעגל מלא:\n\n• התזונאי כותב כוונה ב־My Rules\n• אתם חיים את זה — אוכל, גוף, פעילות, בדיקות\n• Healthings מבצעת, לומדת ומסבירה\n• כשמשתפים — התזונאי רואה מה קורה בגוף\n• יחד מחדדים את התוכנית\n\nלא עוד יומן אוכל מנותק מהקליניקה.',
    card3Title: 'Wellness בכוונה. רמה מקצועית.',
    card3Body:
      'בלי אבחון, בלי מרשמים, בלי להחליף רופא. הערך הוא השיטה: ליווי מורשה, תמונת גוף חיה, ומשוב שמרגיש כמו קליניקה טובה.',
    card4Title: 'לא טיפול רפואי',
    card4Body:
      'Healthings רצה לפי My Rules. חירום והחלטות רפואיות — רק אצל אנשי מקצוע. לפרטים ולפרטיות: ?',
    privacyLink: 'איך זה עובד ופרטיות',
  },
  units: {
    title: 'יחידות מידה',
    helpLabel: 'יחידות',
    lead: 'בחרו איך יוצגו משקל, גובה ואנרגיה. אפשר לשנות אחר כך ב־My Profile.',
  },
  body: {
    title: 'קצת עליכם',
    helpLabel: 'למה שואלים',
    lead: 'כדי לחשב BMR, BMI ויעדי אנרגיה.',
    gender: 'מגדר',
    height: 'גובה',
    birthDate: 'תאריך לידה',
  },
  scale: {
    title: 'יש משקל Withings?',
    helpLabel: 'עזרה — משקל',
    lead:
      'Body, Body Scan — כל משקל Withings בחשבון. אחרי החיבור קוראים מהענן, לא מ־Bluetooth.',
  },
  watch: {
    title: 'יש שעון או צמיד Withings?',
    helpLabel: 'עזרה — שעון',
    lead:
      'כן → פעילות ודופק מענן Withings.\nלא → מ־Health Connect / Apple Health (Garmin, Apple Watch, Samsung…).',
  },
  cgm: {
    title: 'יש CGM לגלוקוז?',
    helpLabel: 'עזרה — CGM',
    lead:
      'דרך Health Connect באנדרואיד או Apple Health באייפון. אפשר גם לייבא PDF של מעבדה אחר כך.',
  },
  link: {
    title: 'חיבור ל־Withings',
    helpLabel: 'עזרה — חיבור',
    lead: 'אותו חשבון כמו באפליקציית Withings. חיבור אחד — למשקל ולשעון.',
    connected: 'Withings מחובר',
    relinkHint: 'אפשר לחבר שוב מ־My Profile.',
    linkBtn: 'לחיבור Withings',
    opening: 'פותח את Withings…',
    skipHint:
      'אפשר לדלג ולהמשיך — תחברו אחר כך ב־My Profile. עד אז היעדים עלולים להתבסס על אומדן משקל.',
  },
  weight: {
    title: 'משקל התחלתי',
    helpLabel: 'עזרה — משקל',
    lead: 'צריך בשביל יעדים ומאזן אנרגיה.',
    linkedHint:
      'מחוברים. אם המשקל עדיין לא עלה — אפשר להזין ידנית, או להמשיך ולחכות לענן.',
    enterNow: 'להזין משקל עכשיו',
    skipWithings: 'לדלג — המשקל יגיע מ־Withings',
    currentWeight: 'משקל עכשיו',
    manualGuide: 'איך מזינים ידנית',
  },
  phoneHealth: {
    titleIos: 'גישה ל־Apple Health',
    titleAndroid: 'גישה ל־Health Connect',
    helpLabel: 'בריאות מהטלפון',
    leadIos:
      'בהמשך — Apple Health עלול לבקש אישור פעם אחת. Allow access למטה: צעדים ודופק כששעון Withings לא פעיל.',
    leadAndroid:
      'בהמשך — Health Connect עלול להיפתח פעם אחת. בלי שעון Withings: צעדים ודופק מכל מותג שכותב ל־Health Connect.',
    cgmIos: 'CGM: CareSens Air → שיתוף ל־Apple Health → Blood Glucose.',
    cgmAndroid: 'גלוקוז בדם — לגרפי CGM ולהשפעת ארוחות.',
  },
  pdfs: {
    title: 'דוחות — לא חובה',
    helpLabel: 'דוחות PDF',
    lead: 'יש PDF מוכן? אפשר לייבא עכשיו. אם לא — ממשיכים ועושים אחר כך.',
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
    lead: 'ה־AI מציע יעדי גוף ומאקרו לפי הפרופיל.',
    waitOrRetry: 'מחכים ליעדים… או ניסיון חוזר.',
    retry: 'ניסיון חוזר',
    usingSaved:
      'נשארים עם היעדים השמורים — כולל My Rules. «יצירה מחדש» רק אם רוצים מספרים חדשים מה־AI.',
    bodyTarget: 'יעד גוף',
    dailyMacros: 'מאקרו ליום',
    rulesApplied: 'כללים פעילים',
    regenerate: 'יצירה מחדש עם AI',
  },
  meals: {
    title: 'איך רושמים ארוחה',
    helpLabel: 'רישום ארוחות',
    lead: 'רושמים מה אוכלים — והמאמן עובד לפי My Rules עם השפעה חיה בגרפים.',
    b1: '1. + בגרף המטבולי → יומן האוכל.',
    b2: '2. תמונה — מצלמים את הצלחת, מאשרים מה שה־AI מציע.',
    b3: '3. טקסט — כותבים מה אכלתם, ה־AI מפרק למקרו.',
    b4: '4. אפשר גם מהצ׳אט — השמירה ביומן האוכל.',
    logFirst: 'לרשום ארוחה ראשונה',
  },
};

export function isRtlLang(code: string): boolean {
  const c = (code || '').toLowerCase().slice(0, 2);
  return c === 'he' || c === 'ar';
}

export function getQuickStartCopy(langCode: string): QuickStartCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  return EN;
}
