/**
 * Concept plate collections (prompt118) — EN + HE meals for Michal review.
 * Other locales fall back to EN plates; page chrome localizes in the generator.
 * Reuse existing photos until collection-specific shots exist.
 */

const IMG = {
  breakfast: 'yogurt-breakfast.jpg?v=20260816a',
  lunch: 'lunch-protein.jpg?v=20260816a',
  dinner: 'dinner-sashimi.jpg?v=20260816a',
  snack: 'yogurt-evening.jpg?v=20260816b',
};

function plate(id, slot, title, why, alt, img, items, hint) {
  return { id, slot, title, why, alt, img, items, hint };
}

export const BUNDLED_COLLECTIONS = {
  'glycemic-protocol': {
    indexCard: {
      en: {
        slot: 'Stable-GI day',
        title: 'Yogurt · quinoa lunch · salmon evening',
        why: 'Four plates with paired protein and fiber — steady energy, not spikes.',
        img: IMG.breakfast,
      },
      he: {
        slot: 'יום GI יציב',
        title: 'יוגורט · צהריים עם קינואה · סלמון בערב',
        why: 'ארבע צלחות עם חלבון וסיבים יחד — אנרגיה יציבה, בלי קפיצות.',
        img: IMG.breakfast,
      },
    },
    pageUi: {
      en: {
        pageTitle: 'Glycemic example plates',
        h1: 'Four plates for a glycemic order',
        lead:
          'Steady-GI meals with protein and fiber at every slot — rough amounts you can type into <strong>Log Meal</strong>. Concept draft for clinician review.',
        disclaimer:
          '<strong>Not medical advice.</strong> Illustrations for a glycemic order — not a promise about glucose response. Your clinician sets <strong>My Rules</strong>; confirm every meal in the app before it saves.',
      },
      he: {
        pageTitle: 'צלחות לדוגמה — גlicemic',
        h1: 'ארבע צלחות להוראה גlicemic',
        lead:
          'ארוחות עם GI יציב — חלבון וסיבים בכל מנה. כמויות שאפשר להקליד ב־<strong>רישום ארוחה</strong>. טיוטת קונסепט לבדיקת קלינאית.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להמחשה של הוראה גlicemic — לא הבטחה על תגובת סוכר. הקלינאist קובע את <strong>הכללים שלי</strong>; מאשרים כל ארוחה לפני ששומרים.',
      },
    },
    plates: {
      en: [
        plate(
          'gi-yogurt-breakfast',
          'Breakfast',
          'Greek yogurt, berries, cinnamon & walnuts',
          'Protein + soluble fiber to open the day without a fast carb hit.',
          'Yogurt bowl with berries, cinnamon, and walnuts',
          IMG.breakfast,
          [
            ['Greek yogurt 0%', 'yogurtG'],
            ['Blueberries', 'berriesG'],
            ['Cinnamon', 'cinnamon'],
            ['Walnuts', 'walnuts'],
          ],
          'In the app: {log} → text, e.g. “Greek yogurt 0% 150g, blueberries 50g, cinnamon ½ tsp, 3 walnut halves”.',
        ),
        plate(
          'gi-quinoa-lunch',
          'Lunch',
          'Grilled chicken, quinoa & roasted vegetables',
          'Balanced plate — lean protein, whole grain, volume from veg.',
          'Lunch plate with chicken, quinoa, and vegetables',
          IMG.lunch,
          [
            ['Grilled chicken', 'chickenG'],
            ['Quinoa, cooked', 'quinoaG'],
            ['Roasted vegetables', 'vegMixG'],
            ['Olive oil', 'oliveSmall'],
          ],
          'In the app: {log} → text, e.g. “grilled chicken 120g, quinoa 150g, roasted vegetables 150g, olive oil 1 tbsp”.',
        ),
        plate(
          'gi-salmon-dinner',
          'Evening',
          'Baked salmon, lentils & leafy greens',
          'Omega-3 protein with legumes and greens — no sweet sauce at dinner.',
          'Dinner plate with salmon, lentils, and greens',
          IMG.dinner,
          [
            ['Baked salmon', 'sashimi'],
            ['Cooked lentils', 'lentilsCooked'],
            ['Leafy greens', 'greensG'],
            ['Olive oil', 'oliveSmall'],
          ],
          'In the app: {log} → text, e.g. “baked salmon 100g, lentils 100g, leafy greens 100g, olive oil 1 tbsp”.',
        ),
        plate(
          'gi-cottage-snack',
          'Snack',
          'Cottage cheese & cucumber',
          'Small protein anchor between meals — no fruit juice or dry crackers alone.',
          'Cottage cheese with cucumber',
          IMG.snack,
          [
            ['Cottage cheese 5%', 'cottageG'],
            ['Cucumber', 'cucumberHalf'],
          ],
          'In the app: {log} → text, e.g. “cottage cheese 5% 100g, cucumber half 150g”.',
        ),
      ],
      he: [
        plate(
          'gi-yogurt-breakfast',
          'בוקר',
          'יוגורט יווני, פירות יער, קינמון ואגוזי מלך',
          'חלבון וסיבים מסיסים לפתיחת היום — בלי פחמימה מהירה.',
          'קערת יוגורט עם פירות יער, קינמון ואגוזי מלך',
          IMG.breakfast,
          [
            ['יוגורט יווני 0%', 'yogurtG'],
            ['פירות יער', 'berriesG'],
            ['קינמון', 'cinnamon'],
            ['אגוזי מלך', 'walnuts'],
          ],
          'באפליקציה: {log} → טקסט, למשל «יוגורט יווני 0% 150ג, פירות יער 50ג, קינמון חצי כפית, 3 חצאי אגוז מלך».',
        ),
        plate(
          'gi-quinoa-lunch',
          'צהריים',
          'עוף בגריל, קינואה וירקות אפויים',
          'צלחת מאוזנת — חלבון רזה, דגן שלם, נפח מירקות.',
          'צלחת צהריים עם עוף, קינואה וירקות',
          IMG.lunch,
          [
            ['עוף בגריל', 'chickenG'],
            ['קינואה מבושלת', 'quinoaG'],
            ['ירקות אפויים', 'vegMixG'],
            ['שמן זית', 'oliveSmall'],
          ],
          'באפליקציה: {log} → טקסט, למשל «עוף בגריל 120ג, קינואה 150ג, ירקות אפויים 150ג, שמן זית כף».',
        ),
        plate(
          'gi-salmon-dinner',
          'ערב',
          'סלמון אפוי, עדשים וירק עלים',
          'חלבון עם אומגה-3 וקטניות — בלי רוטב מתוק בערב.',
          'צלחת ערב עם סלמון, עדשים וירק עלים',
          IMG.dinner,
          [
            ['סלמון אפוי', 'sashimi'],
            ['עדשים מבושלות', 'lentilsCooked'],
            ['ירק עלים', 'greensG'],
            ['שמן זית', 'oliveSmall'],
          ],
          'באפליקציה: {log} → טקסט, למשל «סלמון אפוי 100ג, עדשים 100ג, ירק עלים 100ג, שמן זית כף».',
        ),
        plate(
          'gi-cottage-snack',
          'בין ארוחות',
          'גבינת קוטג׳ ומלפפון',
          'עוגן חלבון קטן בין ארוחות — בלי מיץ או קרקרים יבשים לבד.',
          'גבינת קוטג׳ עם מלפפון',
          IMG.snack,
          [
            ['גבינת קוטג׳ 5%', 'cottageG'],
            ['מלפפון', 'cucumberHalf'],
          ],
          'באפליקציה: {log} → טקסט, למשל «גבינת קוטג׳ 5% 100ג, חצי מלפפון 150ג».',
        ),
      ],
    },
  },

  'weight-protocol': {
    indexCard: {
      en: {
        slot: 'Satiety day',
        title: 'Eggs · turkey salad · stir-fry evening',
        why: 'Protein-forward plates with volume from vegetables — built to stay full.',
        img: IMG.lunch,
      },
      he: {
        slot: 'יום שובע',
        title: 'ביצים · סלט הודו · מוקפץ בערב',
        why: 'צלחות עשירות בחלבון עם נפח מירקות — כדי להישאר שבעים.',
        img: IMG.lunch,
      },
    },
    pageUi: {
      en: {
        pageTitle: 'Weight example plates',
        h1: 'Four plates for a body-composition order',
        lead:
          'Protein-forward meals with vegetables for volume — rough amounts for <strong>Log Meal</strong>. Concept draft for clinician review.',
        disclaimer:
          '<strong>Not medical advice.</strong> Illustrations for a weight / body-composition order. Your clinician sets kcal and protein floors in <strong>My Rules</strong>; confirm every meal in the app.',
      },
      he: {
        pageTitle: 'צלחות לדוגמה — משקל',
        h1: 'ארבע צלחות להוראת הרכב גוף',
        lead:
          'ארוחות עם דגש חלבון ונפח מירקות — כמויות ל־<strong>רישום ארוחה</strong>. טיוטת קונסепט לבדיקת קלינאית.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להמחשה של הוראת משקל / הרכב גוף. הקלינאist קובע kcal ורצפות חלבון ב־<strong>הכללים שלי</strong>; מאשרים כל ארוחה באפליקציה.',
      },
    },
    plates: {
      en: [
        plate(
          'wt-eggs-breakfast',
          'Breakfast',
          'Eggs, whole-grain toast & avocado',
          'Protein and fat at breakfast — toast portion stays modest.',
          'Breakfast plate with eggs, toast, and avocado',
          IMG.breakfast,
          [
            ['Eggs', 'eggWhole'],
            ['Whole-grain toast', 'toastSlice'],
            ['Avocado (¼)', 'avocadoHalf'],
          ],
          'In the app: {log} → text, e.g. “2 eggs, whole-grain toast 1 slice, avocado quarter 70g”.',
        ),
        plate(
          'wt-turkey-lunch',
          'Lunch',
          'Turkey breast, big salad & chickpeas',
          'Half the plate is vegetables; protein stays lean.',
          'Large salad with turkey and chickpeas',
          IMG.lunch,
          [
            ['Turkey breast', 'turkeyG'],
            ['Mixed salad', 'saladG'],
            ['Chickpeas', 'chickpeas'],
            ['Olive oil', 'oliveSmall'],
          ],
          'In the app: {log} → text, e.g. “turkey breast 120g, mixed salad 200g, chickpeas 3 tbsp, olive oil 1 tbsp”.',
        ),
        plate(
          'wt-stirfry-dinner',
          'Evening',
          'Lean beef stir-fry, broccoli & brown rice',
          'Small starch portion; vegetables fill the wok.',
          'Stir-fry with lean beef, broccoli, and rice',
          IMG.dinner,
          [
            ['Lean beef strips', 'proteinG'],
            ['Broccoli', 'broccoliG'],
            ['Brown rice, cooked', 'riceG'],
            ['Olive oil', 'oliveSmall'],
          ],
          'In the app: {log} → text, e.g. “lean beef 150g, broccoli 150g, brown rice 80g cooked, olive oil 1 tbsp”.',
        ),
        plate(
          'wt-shake-snack',
          'Snack',
          'Protein shake & apple',
          'Liquid protein plus a whole fruit — not a bar or pastry.',
          'Protein shake with an apple',
          IMG.snack,
          [
            ['Protein shake', 'shakeMl'],
            ['Apple', 'appleMedium'],
          ],
          'In the app: {log} → text, e.g. “protein shake 200ml, apple 1 medium”.',
        ),
      ],
      he: [
        plate(
          'wt-eggs-breakfast',
          'בוקר',
          'ביצים, טוסט מחיטה מלאה ואבוקדו',
          'חלבון ושומן בבוקר — מנה של לחם נשארת צנועה.',
          'ארוחת בוקר עם ביצים, טוסט ואבוקדו',
          IMG.breakfast,
          [
            ['ביצים', 'eggWhole'],
            ['טוסט מחיטה מלאה', 'toastSlice'],
            ['אבוקדו (רבע)', 'avocadoHalf'],
          ],
          'באפליקציה: {log} → טקסט, למשל «2 ביצים, טוסט מחיטה מלאה פרוסה, רבע אבוקדו 70ג».',
        ),
        plate(
          'wt-turkey-lunch',
          'צהריים',
          'חזה הודו, סלט גדול וגרגרי חומוס',
          'חצי הצלחת ירקות; החלבון נשאר רזה.',
          'סלט גדול עם הודו וחומוס',
          IMG.lunch,
          [
            ['חזה הודו', 'turkeyG'],
            ['סלט מעורב', 'saladG'],
            ['גרגרי חומוס', 'chickpeas'],
            ['שמן זית', 'oliveSmall'],
          ],
          'באפליקציה: {log} → טקסט, למשל «חזה הודו 120ג, סלט 200ג, חומוס 3 כפות, שמן זית כף».',
        ),
        plate(
          'wt-stirfry-dinner',
          'ערב',
          'מוקפץ בקר רזה, ברוקולי ואורז מלא',
          'מנה קטנה של פ starch; הירקות ממלאים את המחבת.',
          'מוקפץ עם בקר, ברוקולי ואורז',
          IMG.dinner,
          [
            ['רצועות בקר רזות', 'proteinG'],
            ['ברוקולי', 'broccoliG'],
            ['אורז מלא מבושל', 'riceG'],
            ['שמן זית', 'oliveSmall'],
          ],
          'באפליקציה: {log} → טקסט, למשל «בקר רזה 150ג, ברוקולי 150ג, אורז מלא 80ג מבושל, שמן זית כף».',
        ),
        plate(
          'wt-shake-snack',
          'בין ארוחות',
          'שייק חלבון ותפוח',
          'חלבון נוזלי ופרי שלם — לא חטיף או מאפה.',
          'שייק חלבון עם תפוח',
          IMG.snack,
          [
            ['שייק חלבון', 'shakeMl'],
            ['תפוח', 'appleMedium'],
          ],
          'באפליקציה: {log} → טקסט, למשל «שייק חלבון 200 מ״ל, תפוח בינוני».',
        ),
      ],
    },
  },

  'glp1-support': {
    indexCard: {
      en: {
        slot: 'Small-volume day',
        title: 'Soft eggs · fish · chicken soup',
        why: 'Modest portions with protein preserved — nausea-friendly textures.',
        img: IMG.snack,
      },
      he: {
        slot: 'יום נפח קטן',
        title: 'ביצים רכות · דג · מרק עוף',
        why: 'מנות צנועות עם חלבון שמור — מרקמים שסובלים GLP-1 טוב יותר.',
        img: IMG.snack,
      },
    },
    pageUi: {
      en: {
        pageTitle: 'GLP-1 support plates',
        h1: 'Four small-volume plates for GLP-1 support',
        lead:
          'Gentle textures, modest portions, protein and fiber still present — for <strong>Log Meal</strong>. Concept draft; your clinician sets exact floors.',
        disclaimer:
          '<strong>Not medical advice.</strong> Support illustrations only — not dosing or medication guidance. Confirm every meal in the app; lean-mass protection is set in <strong>My Rules</strong>.',
      },
      he: {
        pageTitle: 'צלחות תמיכה — GLP-1',
        h1: 'ארבע צלחות נפח קטן לתמיכה ב־GLP-1',
        lead:
          'מרקמים עדינים, מנות צנועות, חלבון וסיבים עדיין שם — ל־<strong>רישום ארוחה</strong>. טיוטת קונסepט; הקלינאist קובע רצפות מדויקות.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להמחשה בלבד — לא הנחיות תרופה או מינון. מאשרים כל ארוחה באפליקציה; שמירה על מסת שריר מוגדרת ב־<strong>הכללים שלי</strong>.',
      },
    },
    plates: {
      en: [
        plate(
          'glp-eggs-breakfast',
          'Breakfast',
          'Soft scrambled eggs & small toast',
          'Easy to eat when appetite is low — protein first, small starch.',
          'Soft scrambled eggs with toast',
          IMG.breakfast,
          [
            ['Soft scrambled eggs', 'eggWhole'],
            ['White toast', 'toastSlice'],
          ],
          'In the app: {log} → text, e.g. “soft scrambled eggs 2, white toast 1 slice”.',
        ),
        plate(
          'glp-fish-lunch',
          'Lunch',
          'White fish & mashed cauliflower',
          'Half a usual lunch volume — protein on a soft base.',
          'White fish with mashed cauliflower',
          IMG.lunch,
          [
            ['White fish, baked', 'fishSmall'],
            ['Mashed cauliflower', 'cauliflowerG'],
            ['Olive oil', 'oliveSmall'],
          ],
          'In the app: {log} → text, e.g. “white fish baked 80g, mashed cauliflower 100g, olive oil 1 tbsp”.',
        ),
        plate(
          'glp-soup-dinner',
          'Evening',
          'Chicken soup with soft vegetables',
          'Warm, sippable dinner when a full plate feels like too much.',
          'Chicken soup with soft vegetables',
          IMG.dinner,
          [
            ['Chicken soup', 'soupMl'],
            ['Soft vegetables in soup', 'zucchiniG'],
            ['Chicken pieces', 'chickenG'],
          ],
          'In the app: {log} → text, e.g. “chicken soup 250ml, soft vegetables 150g, chicken 120g”.',
        ),
        plate(
          'glp-yogurt-snack',
          'Snack',
          'Greek yogurt (small bowl)',
          'Protein anchor you can finish — stop at satiety, not the bowl size.',
          'Small bowl of Greek yogurt',
          IMG.snack,
          [
            ['Greek yogurt 0%', 'yogurtSmall'],
            ['Pumpkin seeds', 'pumpkin'],
          ],
          'In the app: {log} → text, e.g. “Greek yogurt 0% 100g, pumpkin seeds 1 tbsp”.',
        ),
      ],
      he: [
        plate(
          'glp-eggs-breakfast',
          'בוקר',
          'ביצים מקושקשות רכות וטוסט קטן',
          'קל לאכול כשאין תיאבון — קודם חלבון, מעט פ starch.',
          'ביצים מקושקשות עם טוסט',
          IMG.breakfast,
          [
            ['ביצים מקושקשות רכות', 'eggWhole'],
            ['טוסט לבן', 'toastSlice'],
          ],
          'באפליקציה: {log} → טקסט, למשל «ביצים מקושקשות רכות 2, טוסט לבן פרוסה».',
        ),
        plate(
          'glp-fish-lunch',
          'צהריים',
          'דג לבן וcauliflower ממוחת',
          'חצי נפח צהריים רגיל — חלבון על בסיס רך.',
          'דג לבן עםcauliflower ממוחת',
          IMG.lunch,
          [
            ['דג לבן, אפוי', 'fishSmall'],
            ['cauliflower ממוחת', 'cauliflowerG'],
            ['שמן זית', 'oliveSmall'],
          ],
          'באפליקציה: {log} → טקסט, למשל «דג לבן אפוי 80ג,cauliflower ממוחת 100ג, שמן זית כף».',
        ),
        plate(
          'glp-soup-dinner',
          'ערב',
          'מרק עוף עם ירקות רכים',
          'ארוחת ערב חמה ונוחה כשצלחת מלאה מרגישה יותר מדי.',
          'מרק עוף עם ירקות רכים',
          IMG.dinner,
          [
            ['מרק עוף', 'soupMl'],
            ['ירקות רכים במרק', 'zucchiniG'],
            ['חתיכות עוף', 'chickenG'],
          ],
          'באפליקציה: {log} → טקסט, למשל «מרק עוף 250 מ״ל, ירקות רכים 150ג, עוף 120ג».',
        ),
        plate(
          'glp-yogurt-snack',
          'בין ארוחות',
          'יוגורט יווני (קערה קטנה)',
          'עוגן חלבון שאפשר לסיים — עוצרים בשובע, לא בגודל הקערה.',
          'קערת יוגורט יווני קטנה',
          IMG.snack,
          [
            ['יוגורט יווני 0%', 'yogurtSmall'],
            ['זרעי דלעת', 'pumpkin'],
          ],
          'באפליקציה: {log} → טקסט, למשל «יוגורט יווני 0% 100ג, זרעי דלעת כף».',
        ),
      ],
    },
  },

  'renal-protocol': {
    indexCard: {
      en: {
        slot: 'Protein-controlled day',
        title: 'Egg whites · pasta · rice & fish',
        why: 'Portion-controlled protein at every slot — clinician sets the gram cap.',
        img: IMG.lunch,
      },
      he: {
        slot: 'יום חלבון מבוקר',
        title: 'חלבון ביצה · פasta · אורז ודג',
        why: 'חלבון במנה מבוקרת בכל ארוחה — הקלינאist קובע את תקרת הגרם.',
        img: IMG.lunch,
      },
    },
    pageUi: {
      en: {
        pageTitle: 'Renal example plates',
        h1: 'Four plates for a renal protein cap',
        lead:
          'Smaller protein portions with starches and vegetables filling the plate — for <strong>Log Meal</strong>. Concept draft; the cap in <strong>My Rules</strong> is the law.',
        disclaimer:
          '<strong>Not medical advice.</strong> Protein-controlled illustrations only. The renal cap comes from your clinician and labs — never from these example amounts.',
      },
      he: {
        pageTitle: 'צלחות לדוגמה — כלייה',
        h1: 'ארבע צלחות לתקרת חלבון כלייתית',
        lead:
          'מנות חלבון קטנות יותר, עם פ starch וירקות שממלאים את הצלחת — ל־<strong>רישום ארוחה</strong>. טיוטת קונסepט; התקרה ב־<strong>הכללים שלי</strong> היא הקובעת.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להמחשה של בקרת חלבון בלבד. תקרת החלבון מגיעה מהקלינאist ומהמעבדה — לא מהכמויות כאן.',
      },
    },
    plates: {
      en: [
        plate(
          'rn-eggwhite-breakfast',
          'Breakfast',
          'Egg-white omelette & white bread',
          'Most breakfast protein from whites; one small starch slice.',
          'Egg-white omelette with bread',
          IMG.breakfast,
          [
            ['Egg-white omelette', 'eggWhite'],
            ['White bread', 'breadWhite'],
            ['Jam', 'jam'],
          ],
          'In the app: {log} → text, e.g. “egg-white omelette 3 whites, white bread 1 slice, jam 1 tbsp”.',
        ),
        plate(
          'rn-pasta-lunch',
          'Lunch',
          'Small pasta portion & zucchini',
          'Starch-forward lunch with a modest protein sauce — veg for volume.',
          'Pasta with zucchini',
          IMG.lunch,
          [
            ['Pasta, dry weight', 'pastaG'],
            ['Zucchini', 'zucchiniG'],
            ['Olive oil', 'oliveSmall'],
          ],
          'In the app: {log} → text, e.g. “pasta 60g dry, zucchini 150g, olive oil 1 tbsp”.',
        ),
        plate(
          'rn-rice-dinner',
          'Evening',
          'Rice, vegetables & small fish portion',
          'Fish portion stays small; rice and veg carry the plate.',
          'Rice with vegetables and fish',
          IMG.dinner,
          [
            ['White rice, cooked', 'riceG'],
            ['Steamed vegetables', 'vegMixG'],
            ['White fish', 'fishSmall'],
          ],
          'In the app: {log} → text, e.g. “white rice 80g cooked, steamed vegetables 150g, white fish 80g”.',
        ),
        plate(
          'rn-apple-snack',
          'Snack',
          'Apple (one medium)',
          'Whole fruit snack — portion counted, not juice.',
          'One medium apple',
          IMG.snack,
          [['Apple', 'appleMedium']],
          'In the app: {log} → text, e.g. “apple 1 medium”.',
        ),
      ],
      he: [
        plate(
          'rn-eggwhite-breakfast',
          'בוקר',
          'חביתת חלבון ביצה ולחם לבן',
          'רוב החלבון מחלבוני ביצה; פרוסת לחם קטנה.',
          'חביתת חלבונים עם לחם',
          IMG.breakfast,
          [
            ['חביתת חלבון ביצה', 'eggWhite'],
            ['לחם לבן', 'breadWhite'],
            ['ריבה', 'jam'],
          ],
          'באפליקציה: {log} → טקסט, למשל «חביתת 3 חלבוני ביצה, לחם לבן פרוסה, ריבה כף».',
        ),
        plate(
          'rn-pasta-lunch',
          'צהריים',
          'מנה קטנה של פasta וקישואים',
          'צהריים עם דגש פ starch ורוטב חלבון צנוע — ירקות לנפח.',
          'פasta עם קישואים',
          IMG.lunch,
          [
            ['פasta, משקל יבש', 'pastaG'],
            ['קישואים', 'zucchiniG'],
            ['שמן זית', 'oliveSmall'],
          ],
          'באפליקציה: {log} → טקסט, למשל «פasta 60ג יבש, קישואים 150ג, שמן זית כף».',
        ),
        plate(
          'rn-rice-dinner',
          'ערב',
          'אורז, ירקות ומנה קטנה של דג',
          'מנת הדג נשארת קטנה; האורז והירקות נושאים את הצלחת.',
          'אורז עם ירקות ודג',
          IMG.dinner,
          [
            ['אורז לבן מבושל', 'riceG'],
            ['ירקות מאודים', 'vegMixG'],
            ['דג לבן', 'fishSmall'],
          ],
          'באפליקציה: {log} → טקסט, למשל «אורז לבן 80ג מבושל, ירקות 150ג, דג לבן 80ג».',
        ),
        plate(
          'rn-apple-snack',
          'בין ארוחות',
          'תפוח (בינוני אחד)',
          'חטיף פרי שלם — מנה נספרת, לא מיץ.',
          'תפוח בינוני',
          IMG.snack,
          [['תפוח', 'appleMedium']],
          'באפליקציה: {log} → טקסט, למשל «תפוח בינוני».',
        ),
      ],
    },
  },

  'low-carb-protocol': {
    indexCard: {
      en: {
        slot: 'Low-carb day',
        title: 'Eggs · caesar chicken · steak evening',
        why: 'Explicit low-carb order — protein and veg, starch kept out.',
        img: IMG.dinner,
      },
      he: {
        slot: 'יום דל פחמימות',
        title: 'ביצים · עוף קaesar · סטייק בערב',
        why: 'הוראה מפורשת דלת פחמימות — חלבון וירקות, בלי starch.',
        img: IMG.dinner,
      },
    },
    pageUi: {
      en: {
        pageTitle: 'Low-carb example plates',
        h1: 'Four plates for an explicit low-carb order',
        lead:
          'Only when the clinician wrote low-carb or keto in the order — rough amounts for <strong>Log Meal</strong>. Concept draft; net carb cap lives in <strong>My Rules</strong>.',
        disclaimer:
          '<strong>Not medical advice.</strong> For an explicit low-carb order only — never inferred from labs. Confirm every meal in the app before it saves.',
      },
      he: {
        pageTitle: 'צלחות לדוגמה — דל פחמימות',
        h1: 'ארבע צלחות להוראה מפורשת דלת פחמימות',
        lead:
          'רק כשהקלינאist כתב דל פחמימות או קeto בהוראה — כמויות ל־<strong>רישום ארוחה</strong>. טיוטת קונסepט; תקרת net carb ב־<strong>הכללים שלי</strong>.',
        disclaimer:
          '<strong>לא ייעוץ רפואי.</strong> להוראה מפורשת בלבד — לא מסיקים ממעבדה. מאשרים כל ארוחה לפני ששומרים.',
      },
    },
    plates: {
      en: [
        plate(
          'lc-eggs-breakfast',
          'Breakfast',
          'Eggs, cheese & avocado',
          'No toast or fruit at breakfast — fat and protein carry the meal.',
          'Eggs with cheese and avocado',
          IMG.breakfast,
          [
            ['Eggs', 'eggWhole'],
            ['Hard cheese', 'cheeseG'],
            ['Avocado (½)', 'avocado'],
          ],
          'In the app: {log} → text, e.g. “2 eggs, hard cheese 30g, half avocado 100g”.',
        ),
        plate(
          'lc-caesar-lunch',
          'Lunch',
          'Caesar salad with chicken (no croutons)',
          'Big salad, full dressing — croutons stay out.',
          'Caesar salad with grilled chicken',
          IMG.lunch,
          [
            ['Grilled chicken', 'chickenG'],
            ['Romaine & caesar salad', 'saladG'],
            ['Parmesan', 'cheeseG'],
            ['Olive oil', 'oliveSmall'],
          ],
          'In the app: {log} → text, e.g. “grilled chicken 120g, caesar salad 200g no croutons, parmesan 30g, olive oil 1 tbsp”.',
        ),
        plate(
          'lc-steak-dinner',
          'Evening',
          'Steak, asparagus & butter',
          'Protein and green veg — no potato or rice on the side.',
          'Steak with asparagus',
          IMG.dinner,
          [
            ['Lean steak', 'steakG'],
            ['Asparagus', 'asparagusG'],
            ['Butter', 'butter'],
          ],
          'In the app: {log} → text, e.g. “lean steak 150g, asparagus 200g, butter 1 tbsp”.',
        ),
        plate(
          'lc-nuts-snack',
          'Snack',
          'Nuts & cheese',
          'Small handful — counted, not open bowl.',
          'Nuts and cheese snack',
          IMG.snack,
          [
            ['Mixed nuts', 'nutsG'],
            ['Cheese cubes', 'cheeseG'],
          ],
          'In the app: {log} → text, e.g. “mixed nuts 20g, cheese cubes 30g”.',
        ),
      ],
      he: [
        plate(
          'lc-eggs-breakfast',
          'בוקר',
          'ביצים, גבינה ואבוקדו',
          'בלי טוסט או פרי בבוקר — שומן וחלבון נושאים את הארוחה.',
          'ביצים עם גבינה ואבוקדו',
          IMG.breakfast,
          [
            ['ביצים', 'eggWhole'],
            ['גבינה קשה', 'cheeseG'],
            ['אבוקדו (חצי)', 'avocado'],
          ],
          'באפליקציה: {log} → טקסט, למשל «2 ביצים, גבינה קשה 30ג, חצי אבוקדו 100ג».',
        ),
        plate(
          'lc-caesar-lunch',
          'צהריים',
          'סלט קaesar עם עוף (בלי croutons)',
          'סלט גדול, רוטב מלא — croutons נשארים בחוץ.',
          'סלט קaesar עם עוף בגריל',
          IMG.lunch,
          [
            ['עוף בגריל', 'chickenG'],
            ['חסה וסלט קaesar', 'saladG'],
            ['פרמזן', 'cheeseG'],
            ['שמן זית', 'oliveSmall'],
          ],
          'באפליקציה: {log} → טקסט, למשל «עוף בגריל 120ג, סלט קaesar 200ג בלי croutons, פרמזן 30ג, שמן זית כף».',
        ),
        plate(
          'lc-steak-dinner',
          'ערב',
          'סטייק, asparagus וחמאה',
          'חלבון וירק ירוק — בלי תפוח אדמה או אורז בצד.',
          'סטייק עם asparagus',
          IMG.dinner,
          [
            ['סטייק רזה', 'steakG'],
            ['asparagus', 'asparagusG'],
            ['חמאה', 'butter'],
          ],
          'באפליקציה: {log} → טקסט, למשל «סטייק רזה 150ג, asparagus 200ג, חמאה כף».',
        ),
        plate(
          'lc-nuts-snack',
          'בין ארוחות',
          'אגוזים וגבינה',
          'חופן קטן — נספר, לא קערה פתוחה.',
          'חטיף אגוזים וגבינה',
          IMG.snack,
          [
            ['אגוזים מעורבים', 'nutsG'],
            ['קוביות גבינה', 'cheeseG'],
          ],
          'באפליקציה: {log} → טקסט, למשל «אגוזים 20ג, קוביות גבינה 30ג».',
        ),
      ],
    },
  },
};

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
