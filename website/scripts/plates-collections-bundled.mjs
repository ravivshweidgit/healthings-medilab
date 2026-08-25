/**
 * Concept plate collections (prompt118) — EN + HE for Michal review.
 * Items only — portions live in My Rules. Lipid stays in plates-locale-content.mjs.
 * Each collection has its own photos under website/images/plates/{slug}-*.jpg
 */

const V = '?v=20260825a';

function img(slug, slot) {
  return `${slug}-${slot}.jpg${V}`;
}

function plate(id, slot, title, why, alt, image, itemNames, hint) {
  return {
    id,
    slot,
    title,
    why,
    alt,
    img: image,
    items: itemNames.map((name) => [name, '']),
    hint,
  };
}

/** @param {string[]} names */
function hintItems(names) {
  return names.join(', ');
}

export const BUNDLED_COLLECTIONS = {
  'glycemic-protocol': {
    indexCard: {
      en: {
        slot: 'Steady-glucose day',
        title: 'Cottage cheese · chicken · salmon',
        why: 'Protein and fiber every slot — no juice or white bread alone.',
        img: img('gi', 'breakfast'),
      },
      he: {
        slot: 'יום עם סוכר יציב',
        title: 'גבינה לבנה · עוף · סלмон',
        why: 'חלבון וסיבים בכל ארוחה — בלי מיץ או לחם לבן לבד.',
        img: img('gi', 'breakfast'),
      },
    },
    pageUi: {
      en: {
        pageTitle: 'Glycemic example plates',
        h1: 'Glycemic protocol — blood sugar stability',
        lead:
          'Example meals for a glycemic order — list the items in <strong>Log Meal</strong>. Your clinician sets portions in <strong>My Rules</strong>.',
        disclaimer:
          '<strong>Not medical advice.</strong> Illustrations for a glycemic order — not a promise about glucose response. Confirm every meal in the app before it saves.',
      },
      he: {
        pageTitle: 'צלחות לדוגמה — גלוקמיות',
        h1: 'פרוטוקול גלוקמי — יציבות סוכר',
        lead:
          'ארוחות לדוגמה להוראה גלוקמית — מפרטים את הרכיבים ב<strong>רישום ארוחה</strong>. המנות קובעות ב<strong>הכללים שלי</strong>.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להמחשה של הוראה גלוקמית — לא הבטחה על תגובת סוכר. מאשרים כל ארוחה לפני ששומרים.',
      },
    },
    plates: {
      en: [
        plate(
          'gi-cottage-breakfast',
          'Breakfast',
          'Cottage cheese, apple, cinnamon & walnuts',
          'Protein and fiber to open the day — whole fruit, not juice.',
          'Bowl with cottage cheese, apple slices, cinnamon, and walnuts',
          img('gi', 'breakfast'),
          ['Cottage cheese', 'Apple', 'Cinnamon', 'Walnuts'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'gi-chicken-lunch',
          'Lunch',
          'Grilled chicken, chickpeas, salad & cucumber',
          'Lean protein with legumes and vegetables — not a carb-only lunch.',
          'Plate with grilled chicken, chickpeas, mixed salad, and cucumber',
          img('gi', 'lunch'),
          ['Grilled chicken', 'Chickpeas', 'Mixed salad', 'Cucumber', 'Olive oil'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'gi-salmon-dinner',
          'Evening',
          'Baked salmon, zucchini, bell pepper & green beans',
          'Protein and non-starchy vegetables at dinner — no sweet drink on the side.',
          'Plate with baked salmon, zucchini, bell pepper, and green beans',
          img('gi', 'dinner'),
          ['Baked salmon', 'Zucchini', 'Bell pepper', 'Green beans', 'Lemon'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'gi-yogurt-evening',
          'After dinner',
          'Greek yogurt, blueberries & chia',
          'Protein anchor before sleep — berries plus seeds, not a pastry.',
          'Bowl with Greek yogurt, blueberries, and chia seeds',
          img('gi', 'evening'),
          ['Greek yogurt', 'Blueberries', 'Chia seeds'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
      ],
      he: [
        plate(
          'gi-cottage-breakfast',
          'בוקר',
          'גבינה לבנה, תפוח, קינמון ואגוזי מלך',
          'חלבון וסיבים לפתיחת היום — פרי שלם, לא מיץ.',
          'קערה עם גבינה לבנה, פרוסות תפוח, קינמון ואגוזי מלך',
          img('gi', 'breakfast'),
          ['גבינה לבנה', 'תפוח', 'קינמון', 'אגוזי מלך'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'gi-chicken-lunch',
          'צהריים',
          'עוף בגריל, חומוס, סלט ומלפפון',
          'חלבון רזה עם קטניות וירקות — לא ארוחת צהריים של פחמימה לבד.',
          'צלחת עם עוף בגריל, חומוס, סלט מעורב ומלפפון',
          img('gi', 'lunch'),
          ['עוף בגריל', 'חומוס', 'סלט מעורב', 'מלפפון', 'שמן זית'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'gi-salmon-dinner',
          'ערב',
          'סלמון אפוי, קישוא, גמבה ושעועית ירוקה',
          'חלבון וירקות לא עמילניים בערב — בלי משקה מתוק בצד.',
          'צלחת עם סלמון אפוי, קישוא, גמבה ושעועית ירוקה',
          img('gi', 'dinner'),
          ['סלמון אפוי', 'קישוא', 'גמבה', 'שעועית ירוקה', 'לימון'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'gi-yogurt-evening',
          'אחרי ערב',
          'יוגורט יווני, אוכמניות וצ׳יה',
          'עוגן חלבון לפני השינה — פירות יער וזרעים, לא מאפה.',
          'קערה עם יוגורט יווני, אוכמניות וזרעי צ׳יה',
          img('gi', 'evening'),
          ['יוגורט יווני', 'אוכמניות', 'זרעי צ׳יה'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
      ],
    },
  },

  'weight-protocol': {
    indexCard: {
      en: {
        slot: 'Satiety day',
        title: 'Eggs · turkey · stir-fry',
        why: 'Protein-forward plates with vegetable volume — built to stay full.',
        img: img('wt', 'breakfast'),
      },
      he: {
        slot: 'יום שובע',
        title: 'ביצים · הודו · מוקפץ',
        why: 'צלחות עשירות בחלבון עם נפח מירקות — כדי להישאר שבעים.',
        img: img('wt', 'breakfast'),
      },
    },
    pageUi: {
      en: {
        pageTitle: 'Weight example plates',
        h1: 'Weight protocol — satiety and lean protein',
        lead:
          'Example meals for a weight order — list the items in <strong>Log Meal</strong>. Your clinician sets portions in <strong>My Rules</strong>.',
        disclaimer:
          '<strong>Not medical advice.</strong> Illustrations for a weight order. Confirm every meal in the app before it saves.',
      },
      he: {
        pageTitle: 'צלחות לדוגמה — משקל',
        h1: 'פרוטוקול משקל — שובע וחלבון רזה',
        lead:
          'ארוחות לדוגמה להוראת משקל — מפרטים את הרכיבים ב<strong>רישום ארוחה</strong>. המנות קובעות ב<strong>הכללים שלי</strong>.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להמחשה של הוראת משקל. מאשרים כל ארוחה לפני ששומרים.',
      },
    },
    plates: {
      en: [
        plate(
          'wt-eggs-breakfast',
          'Breakfast',
          'Eggs, whole-grain toast, avocado & tomato',
          'Protein and fat at breakfast — modest starch, lots of volume from veg.',
          'Plate with eggs, whole-grain toast, avocado, and tomato',
          img('wt', 'breakfast'),
          ['Eggs', 'Whole-grain toast', 'Avocado', 'Tomato'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'wt-turkey-lunch',
          'Lunch',
          'Turkey breast, big salad & chickpeas',
          'Half the plate is vegetables; protein stays lean.',
          'Large salad plate with turkey breast and chickpeas',
          img('wt', 'lunch'),
          ['Turkey breast', 'Mixed salad', 'Chickpeas', 'Olive oil'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'wt-stirfry-dinner',
          'Evening',
          'Lean beef stir-fry, broccoli & brown rice',
          'Vegetables fill the wok — starch stays on the side.',
          'Stir-fry plate with lean beef, broccoli, and brown rice',
          img('wt', 'dinner'),
          ['Lean beef', 'Broccoli', 'Brown rice', 'Olive oil'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'wt-shake-snack',
          'Snack',
          'Protein shake & apple',
          'Liquid protein plus whole fruit — not a bar or pastry.',
          'Protein shake beside a whole apple',
          img('wt', 'snack'),
          ['Protein shake', 'Apple'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
      ],
      he: [
        plate(
          'wt-eggs-breakfast',
          'בוקר',
          'ביצים, טוסט מחיטה מלאה, אבוקדו ועגבנייה',
          'חלבון ושומן בבוקר — מעט פחמימה, הרבה נפח מירקות.',
          'צלחת עם ביצים, טוסט מחיטה מלאה, אבוקדו ועגבנייה',
          img('wt', 'breakfast'),
          ['ביצים', 'טוסט מחיטה מלאה', 'אבוקדו', 'עגבנייה'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'wt-turkey-lunch',
          'צהריים',
          'חזה הודו, סלט גדול וחומוס',
          'חצי הצלחת ירקות; החלבון נשאר רזה.',
          'צלחת סלט גדולה עם חזה הודו וחומוס',
          img('wt', 'lunch'),
          ['חזה הודו', 'סלט מעורב', 'חומוס', 'שמן זית'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'wt-stirfry-dinner',
          'ערב',
          'מוקפץ בקר רזה, ברוקולי ואורז מלא',
          'הירקות ממלאים את המחבת — הפחמימה בצד.',
          'צלחת מוקפץ עם בקר רזה, ברוקולי ואורז מלא',
          img('wt', 'dinner'),
          ['בקר רזה', 'ברוקולי', 'אורז מלא', 'שמן זית'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'wt-shake-snack',
          'בין ארוחות',
          'שייק חלבון ותפוח',
          'חלבון נוזלי ופרי שלם — לא חטיף או מאפה.',
          'שייק חלבון ליד תפוח שלם',
          img('wt', 'snack'),
          ['שייק חלבון', 'תפוח'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
      ],
    },
  },

  'glp1-support': {
    indexCard: {
      en: {
        slot: 'Small-volume day',
        title: 'Soft eggs · fish · chicken soup',
        why: 'Modest portions with protein preserved — gentle textures.',
        img: img('glp1', 'breakfast'),
      },
      he: {
        slot: 'יום נפח קטן',
        title: 'ביצים רכות · דג · מרק עוף',
        why: 'מנות צנועות עם חלבון שמור — מרקמים עדינים.',
        img: img('glp1', 'breakfast'),
      },
    },
    pageUi: {
      en: {
        pageTitle: 'GLP-1 support plates',
        h1: 'GLP-1 support — small portions, protein kept',
        lead:
          'Example meals for GLP-1 support — list the items in <strong>Log Meal</strong>. Your clinician sets portions in <strong>My Rules</strong>.',
        disclaimer:
          '<strong>Not medical advice.</strong> Support illustrations only — not dosing or medication guidance. Confirm every meal in the app.',
      },
      he: {
        pageTitle: 'צלחות תמיכה — GLP-1',
        h1: 'תמיכה ב־GLP-1 — מנות קטנות, חלבון שמור',
        lead:
          'ארוחות לדוגמה לתמיכה ב־GLP-1 — מפרטים את הרכיבים ב<strong>רישום ארוחה</strong>. המנות קובעות ב<strong>הכללים שלי</strong>.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להמחשה בלבד — לא הנחיות תרופה או מינון. מאשרים כל ארוחה לפני ששומרים.',
      },
    },
    plates: {
      en: [
        plate(
          'glp-eggs-breakfast',
          'Breakfast',
          'Soft scrambled eggs & white toast',
          'Easy to eat when appetite is low — protein first, small starch.',
          'Plate with soft scrambled eggs and white toast',
          img('glp1', 'breakfast'),
          ['Soft scrambled eggs', 'White toast'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'glp-fish-lunch',
          'Lunch',
          'Baked white fish & mashed cauliflower',
          'Protein on a soft base — half a usual lunch volume.',
          'Plate with baked white fish and mashed cauliflower',
          img('glp1', 'lunch'),
          ['Baked white fish', 'Mashed cauliflower', 'Olive oil'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'glp-soup-dinner',
          'Evening',
          'Chicken soup with soft vegetables',
          'Warm, sippable dinner when a full plate feels like too much.',
          'Bowl of chicken soup with soft vegetables and chicken pieces',
          img('glp1', 'dinner'),
          ['Chicken soup', 'Soft zucchini', 'Chicken pieces'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'glp-yogurt-snack',
          'Snack',
          'Greek yogurt',
          'Protein anchor you can finish — stop at satiety.',
          'Small bowl of Greek yogurt',
          img('glp1', 'snack'),
          ['Greek yogurt'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
      ],
      he: [
        plate(
          'glp-eggs-breakfast',
          'בוקר',
          'ביצים מקושקשות רכות וטוסט לבן',
          'קל לאכול כשהתיאבון נמוך — חלבון קודם, מעט פחמימה.',
          'צלחת עם ביצים מקושקשות רכות וטוסט לבן',
          img('glp1', 'breakfast'),
          ['ביצים מקושקשות רכות', 'טוסט לבן'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'glp-fish-lunch',
          'צהריים',
          'דג לבן אפוי וכרובית מעוכה',
          'חלבון על בסיס רך — נפח צהריים מצומצם.',
          'צלחת עם דג לבן אפוי וכרובית מעוכה',
          img('glp1', 'lunch'),
          ['דג לבן אפוי', 'כרובית מעוכה', 'שמן זית'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'glp-soup-dinner',
          'ערב',
          'מרק עוף עם ירקות רכים',
          'ארוחת ערב חמה ונוחה כשצלחת מלאה מרגישה יותר מדי.',
          'קערת מרק עוף עם ירקות רכים וחתיכות עוף',
          img('glp1', 'dinner'),
          ['מרק עוף', 'קישוא רך', 'חתיכות עוף'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'glp-yogurt-snack',
          'בין ארוחות',
          'יוגורט יווני',
          'עוגן חלבון שאפשר לסיים — עוצרים בשובע.',
          'קערה קטנה של יוגורט יווני',
          img('glp1', 'snack'),
          ['יוגורט יווני'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
      ],
    },
  },

  'renal-protocol': {
    indexCard: {
      en: {
        slot: 'Protein-cap day',
        title: 'Egg · fish · tofu',
        why: 'Protein-controlled plates — clinician sets the cap in My Rules.',
        img: img('renal', 'breakfast'),
      },
      he: {
        slot: 'יום תקרת חלבון',
        title: 'ביצה · דג · טופו',
        why: 'צלחות עם חלבון מבוקר — התקרה קובעת הקלינאית בהכללים שלי.',
        img: img('renal', 'breakfast'),
      },
    },
    pageUi: {
      en: {
        pageTitle: 'Renal example plates',
        h1: 'Renal protocol — protein-controlled portions',
        lead:
          'Example meals for a renal protein cap — list the items in <strong>Log Meal</strong>. The cap comes from your clinician, not these plates.',
        disclaimer:
          '<strong>Not medical advice.</strong> Protein-controlled illustrations only. Confirm every meal in the app before it saves.',
      },
      he: {
        pageTitle: 'צלחות לדוגמה — כלייה',
        h1: 'פרוטוקול כלייה — חלבון במנה מבוקרת',
        lead:
          'ארוחות לדוגמה לתקרת חלבון כלייתית — מפרטים את הרכיבים ב<strong>רישום ארוחה</strong>. התקרה מהקלינאית, לא מהצלחות.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להמחשה של חלבון מבוקר בלבד. מאשרים כל ארוחה לפני ששומרים.',
      },
    },
    plates: {
      en: [
        plate(
          'renal-egg-breakfast',
          'Breakfast',
          'Egg, white toast & cucumber',
          'One protein anchor at breakfast — veg for volume.',
          'Plate with egg, white toast, and cucumber slices',
          img('renal', 'breakfast'),
          ['Egg', 'White toast', 'Cucumber'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'renal-fish-lunch',
          'Lunch',
          'White fish, zucchini & green salad',
          'Lean protein with low-potassium vegetables.',
          'Plate with white fish, zucchini, and green salad',
          img('renal', 'lunch'),
          ['White fish', 'Zucchini', 'Green salad', 'Olive oil'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'renal-tofu-dinner',
          'Evening',
          'Tofu, lentils, tomato & cucumber',
          'Plant protein with modest legumes — clinician sets the cap.',
          'Plate with tofu, lentils, tomato, and cucumber',
          img('renal', 'dinner'),
          ['Tofu', 'Lentils', 'Tomato', 'Cucumber'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'renal-cottage-snack',
          'Snack',
          'Cottage cheese & cucumber',
          'Small protein snack — not a large bowl.',
          'Small bowl of cottage cheese with cucumber',
          img('renal', 'snack'),
          ['Cottage cheese', 'Cucumber'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
      ],
      he: [
        plate(
          'renal-egg-breakfast',
          'בוקר',
          'ביצה, טוסט לבן ומלפפון',
          'עוגן חלבון אחד בבוקר — ירקות לנפח.',
          'צלחת עם ביצה, טוסט לבן ופרוסות מלפפון',
          img('renal', 'breakfast'),
          ['ביצה', 'טוסט לבן', 'מלפפון'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'renal-fish-lunch',
          'צהריים',
          'דג לבן, קישוא וסלט ירוק',
          'חלבון רזה עם ירקות.',
          'צלחת עם דג לבן, קישוא וסלט ירוק',
          img('renal', 'lunch'),
          ['דג לבן', 'קישוא', 'סלט ירוק', 'שמן זית'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'renal-tofu-dinner',
          'ערב',
          'טופו, עדשים, עגבנייה ומלפפון',
          'חלבון צמחי עם קטניות מצומצמות — התקרה מהקלינאית.',
          'צלחת עם טופו, עדשים, עגבנייה ומלפפון',
          img('renal', 'dinner'),
          ['טופו', 'עדשים', 'עגבנייה', 'מלפפון'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'renal-cottage-snack',
          'בין ארוחות',
          'גבינה לבנה ומלפפון',
          'חטיף חלבון קטן — לא קערה גדולה.',
          'קערה קטנה של גבינה לבנה עם מלפפון',
          img('renal', 'snack'),
          ['גבינה לבנה', 'מלפפון'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
      ],
    },
  },

  'low-carb-protocol': {
    indexCard: {
      en: {
        slot: 'Low-carb day',
        title: 'Eggs · chicken · steak',
        why: 'Explicit low-carb order only — protein and veg, starch kept out.',
        img: img('lc', 'breakfast'),
      },
      he: {
        slot: 'יום דל פחמימות',
        title: 'ביצים · עוף · סטייק',
        why: 'רק בהוראה מפורשת — חלבון וירקות, בלי עמילן.',
        img: img('lc', 'breakfast'),
      },
    },
    pageUi: {
      en: {
        pageTitle: 'Low-carb example plates',
        h1: 'Low-carb protocol — explicit order only',
        lead:
          'Example meals for an explicit low-carb order — list the items in <strong>Log Meal</strong>. Net carb cap lives in <strong>My Rules</strong>.',
        disclaimer:
          '<strong>Not medical advice.</strong> For an explicit low-carb order only — never inferred from labs. Confirm every meal in the app.',
      },
      he: {
        pageTitle: 'צלחות לדוגמה — דל פחמימות',
        h1: 'פרוטוקול דל פחמימות — רק בהוראה מפורשת',
        lead:
          'ארוחות לדוגמה להוראה מפורשת דלת פחמימות — מפרטים את הרכיבים ב<strong>רישום ארוחה</strong>. תקרת net carbs ב<strong>הכללים שלי</strong>.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> רק בהוראה מפורשת — לא מסיקנים מבדיקות. מאשרים כל ארוחה לפני ששומרים.',
      },
    },
    plates: {
      en: [
        plate(
          'lc-eggs-breakfast',
          'Breakfast',
          'Eggs, avocado & cucumber',
          'Protein and fat — no bread or cereal at this slot.',
          'Plate with eggs, avocado, and cucumber',
          img('lc', 'breakfast'),
          ['Eggs', 'Avocado', 'Cucumber'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'lc-chicken-lunch',
          'Lunch',
          'Grilled chicken & big salad',
          'Protein and vegetables — no rice, pasta, or legumes.',
          'Large salad plate with grilled chicken',
          img('lc', 'lunch'),
          ['Grilled chicken', 'Mixed salad', 'Olive oil'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'lc-steak-dinner',
          'Evening',
          'Steak, asparagus & butter',
          'Protein and non-starchy vegetables — no potato or bread.',
          'Plate with steak, asparagus, and butter',
          img('lc', 'dinner'),
          ['Steak', 'Asparagus', 'Butter'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
        plate(
          'lc-nuts-snack',
          'Snack',
          'Mixed nuts & cheese',
          'Small handful — counted, not an open bowl.',
          'Small portion of mixed nuts and cheese cubes',
          img('lc', 'snack'),
          ['Mixed nuts', 'Cheese'],
          'In the app: {log} → text, e.g. “{items}”.',
        ),
      ],
      he: [
        plate(
          'lc-eggs-breakfast',
          'בוקר',
          'ביצים, אבוקדו ומלפפון',
          'חלבון ושומן — בלי לחם או דגנים בארוחה הזו.',
          'צלחת עם ביצים, אבוקדו ומלפפון',
          img('lc', 'breakfast'),
          ['ביצים', 'אבוקדו', 'מלפפון'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'lc-chicken-lunch',
          'צהריים',
          'עוף בגריל וסלט גדול',
          'חלבון וירקות — בלי אורז, פסטה או קטניות.',
          'צלחת סלט גדולה עם עוף בגריל',
          img('lc', 'lunch'),
          ['עוף בגריל', 'סלט מעורב', 'שמן זית'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'lc-steak-dinner',
          'ערב',
          'סטייק, אספרגוס וחמאה',
          'חלבון וירקות לא עמילניים — בלי תפוח אדמה או לחם.',
          'צלחת עם סטייק, אספרגוס וחמאה',
          img('lc', 'dinner'),
          ['סטייק', 'אספרגוס', 'חמאה'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
        plate(
          'lc-nuts-snack',
          'בין ארוחות',
          'אגוזים מעורבים וגבינה',
          'חופן קטן — נספר, לא קערה פתוחה.',
          'מנה קטנה של אגוזים מעורבים וקוביות גבינה',
          img('lc', 'snack'),
          ['אגוזים מעורבים', 'גבינה'],
          'באפליקציה: {log} → טקסט, למשל «{items}».',
        ),
      ],
    },
  },
};

/** Fill {items} placeholder in hints from plate item names. */
for (const slug of Object.keys(BUNDLED_COLLECTIONS)) {
  const b = BUNDLED_COLLECTIONS[slug];
  for (const lang of ['en', 'he']) {
    const list = b.plates[lang];
    if (!list) continue;
    for (const p of list) {
      const names = p.items.map(([name]) => name).join(', ');
      p.hint = p.hint.replace('{items}', names);
    }
  }
}

/** Resolve bundled page UI — EN fallback for locales without a dedicated draft. */
export function bundledPageUi(slug, lang) {
  const b = BUNDLED_COLLECTIONS[slug];
  if (!b) return null;
  return b.pageUi[lang] || b.pageUi.en;
}

/** Resolve bundled index card — EN fallback. */
export function bundledIndexCard(slug, lang) {
  const b = BUNDLED_COLLECTIONS[slug];
  if (!b) return null;
  return b.indexCard[lang] || b.indexCard.en;
}

/** Resolve bundled plates — EN fallback for non en/he locales. */
export function bundledPlates(slug, lang) {
  const b = BUNDLED_COLLECTIONS[slug];
  if (!b) return null;
  return b.plates[lang] || b.plates.en;
}
