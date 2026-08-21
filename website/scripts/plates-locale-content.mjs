/**
 * Example plates — multi-locale copy (same 10 langs as help).
 * Keep g / ml English (language-policy). Localize tbsp / halves via PLATES_UI.
 */
import { HELP_LOCALES } from './help-locale-content.mjs';

export { HELP_LOCALES };

export { CSS_VER } from './css-version.mjs';

/** Shared amount defs — tbsp/halves words come from PLATES_UI per locale. */
export const AMOUNT_DEFS = {
  yogurtG: { text: '150 g' },
  waterMl: { text: '100 ml' },
  blueberriesG: { text: '40 g' },
  oatBran: { tbsp: 1, approx: '~17 g' },
  psyllium: { tbsp: 1, approx: '~5 g' },
  chia: { tbsp: 1, approx: '~10 g' },
  pumpkin: { tbsp: 1, approx: '~8 g' },
  walnuts: { halves: 3, approx: '~5 g' },
  almonds: { text: '4 (~6 g)' },
  proteinG: { text: '150 g' },
  lentils: { tbsp: 5 },
  cucumberLunch: { tbsp: 2 },
  oilLunch: { tbsp: 2 },
  sashimi: { text: '~100 g' },
  avocado: { text: '~90–100 g' },
  ginger: { text: '~10 g' },
  teriyaki: { text: '~10–15 g' },
  sprouts: { text: '50 g' },
  pepper: { text: '40 g' },
  cucumberDinner: { text: '30 g' },
  onion: { text: '20 g' },
  lettuce: { text: '30 g' },
  fresh: { fresh: true },
};

/** Format amount for a locale UI (needs tbsp1 / tbspN / halves / fresh). */
export function formatAmount(ui, key) {
  const d = AMOUNT_DEFS[key];
  if (!d) return '';
  if (d.fresh) return ui.fresh || '';
  if (d.text) return d.text;
  if (d.tbsp != null) {
    const n = d.tbsp;
    const unit = n === 1 ? ui.tbsp1 : ui.tbspN;
    return d.approx ? `${n} ${unit} (${d.approx})` : `${n} ${unit}`;
  }
  if (d.halves != null) {
    return `${d.halves} ${ui.halves} (${d.approx})`;
  }
  return '';
}

/** @deprecated — use formatAmount; kept so older imports fail loudly if still string-keyed. */
export const AMOUNTS = AMOUNT_DEFS;

/**
 * PLATES_UI[code] — chrome + page shell.
 * PLATE_COPY[code] — four plates (ids fixed).
 */
export const PLATES_UI = {};
export const PLATE_COPY = {};

function ui(code, o) {
  PLATES_UI[code] = o;
}
function plates(code, list) {
  PLATE_COPY[code] = list;
}

// ─── English ───────────────────────────────────────────────────────────────
ui('en', {
  navPlates: 'Plates',
  badge: 'Example plates',
  indexTitle: 'Example plates',
  indexLead: 'Meals from a real food log — with amounts you can type into Log Meal.',
  indexCardSlot: 'From the log',
  indexCardTitle: 'Yogurt · lunch · sashimi evening',
  indexCardWhy: 'Four plates from one day — breakfast through after-dinner yogurt.',
  indexDisclaimer: '<strong>Not medical advice.</strong> Personal log examples — not a treatment plan.',
  pageTitle: 'Example plates',
  h1: 'Four plates from one day in the food log',
  lead: 'Breakfast through after dinner — rough amounts you can type into <strong>Log Meal</strong>. From a real diary around cholesterol lab checks.',
  disclaimer:
    '<strong>Not medical advice.</strong> This is one person’s logged food during a lab period — not a promise that these plates lower cholesterol. Your clinician sets <strong>My Rules</strong> and treatment markers; confirm every meal in the app before it saves.',
  moreTitle: 'Next',
  moreBody: 'More plates can join this collection later.',
  howToLog: 'How to log meals →',
  allPlates: '← All plate collections',
  logMeal: 'Log Meal',
  fresh: 'fresh',
  tbsp1: 'tbsp',
  tbspN: 'tbsp',
  halves: 'halves',
  helpIndexLink: 'Example plates — a day from the log',
  mealLoggingBlurb:
    '<p><a href="../plates/lipid-protocol.html">Example plates</a> — meals from the log with amounts you can type into Log Meal.</p>',
  inApp: 'In the app',
  textEg: 'text, e.g.',
});

plates('en', [
  {
    id: 'yogurt-breakfast',
    slot: 'Breakfast',
    title: 'Yogurt with bran, seeds, nuts & blueberries',
    why: 'Morning bowl — yogurt, bran and seeds, blueberries. Add 100 ml water so chia, bran, and psyllium can soak it up.',
    alt: 'Yogurt bowl with bran, seeds, nuts, and blueberries',
    img: 'yogurt-breakfast.jpg?v=20260816a',
    items: [
      ['Yogurt 0%', 'yogurtG'],
      ['Water', 'waterMl'],
      ['Blueberries', 'blueberriesG'],
      ['Oat bran', 'oatBran'],
      ['Psyllium', 'psyllium'],
      ['Chia seeds', 'chia'],
      ['Pumpkin seeds', 'pumpkin'],
      ['Walnuts', 'walnuts'],
      ['Almonds', 'almonds'],
    ],
    hint: 'Chia, bran, and psyllium drink the water. In the app: {log} → text, e.g. “yogurt 0% 150g, water 100ml, blueberries 40g, oat bran 1 tbsp, psyllium 1 tbsp, chia 1 tbsp, pumpkin seeds 1 tbsp, 3 walnut halves, 4 almonds”.',
  },
  {
    id: 'lunch-protein',
    slot: 'Lunch',
    title: 'White fish (or chicken / tofu), lentils & cucumber',
    why: 'Lunch: white fish with lentils, cucumber, and olive oil. Swap for chicken or tofu — no avocado at lunch.',
    alt: 'Lunch plate with white fish, lentils, cucumber, and olive oil',
    img: 'lunch-protein.jpg?v=20260816a',
    items: [
      ['White fish / chicken / tofu', 'proteinG'],
      ['Cooked lentils', 'lentils'],
      ['Cucumber', 'cucumberLunch'],
      ['Olive oil', 'oilLunch'],
    ],
    hint: 'In the app: {log} → text, e.g. “grilled white fish 150g, lentils 5 tbsp, cucumber 2 tbsp, olive oil 2 tbsp” — or chicken / tofu instead of fish.',
  },
  {
    id: 'dinner-sashimi',
    slot: 'Evening',
    title: 'Salmon sashimi, avocado, ginger, teriyaki & Thai salad',
    why: 'Evening: sashimi and avocado, with a finely chopped salad (sprouts, pepper, cucumber, onion, lettuce, mint, basil), ginger, and teriyaki.',
    alt: 'Dinner plate with salmon sashimi, avocado, and salad',
    img: 'dinner-sashimi.jpg?v=20260816a',
    items: [
      ['Salmon sashimi', 'sashimi'],
      ['Avocado (½)', 'avocado'],
      ['Pickled ginger', 'ginger'],
      ['Teriyaki sauce', 'teriyaki'],
      ['Sprouts', 'sprouts'],
      ['Bell pepper', 'pepper'],
      ['Cucumber', 'cucumberDinner'],
      ['Onion', 'onion'],
      ['Lettuce', 'lettuce'],
      ['Mint', 'fresh'],
      ['Basil', 'fresh'],
    ],
    hint: 'Chop the salad veg finely. In the app: {log} → text, e.g. “salmon sashimi 100g, half avocado 100g, pickled ginger 10g, teriyaki 15g, sprouts 50g, bell pepper 40g, cucumber 30g, onion 20g, lettuce 30g, mint, basil — all finely chopped”.',
  },
  {
    id: 'yogurt-evening',
    slot: 'After dinner',
    title: 'Yogurt with bran, seeds & nuts',
    why: 'Same bowl as breakfast — without blueberries. Again 100 ml water; chia, bran, and psyllium soak it up.',
    alt: 'Yogurt bowl with bran, seeds, and nuts — no blueberries',
    img: 'yogurt-evening.jpg?v=20260816b',
    items: [
      ['Yogurt 0%', 'yogurtG'],
      ['Water', 'waterMl'],
      ['Oat bran', 'oatBran'],
      ['Psyllium', 'psyllium'],
      ['Chia seeds', 'chia'],
      ['Pumpkin seeds', 'pumpkin'],
      ['Walnuts', 'walnuts'],
      ['Almonds', 'almonds'],
    ],
    hint: 'In the app: {log} → text, e.g. “yogurt 0% 150g, water 100ml, oat bran 1 tbsp, psyllium 1 tbsp, chia 1 tbsp, pumpkin seeds 1 tbsp, 3 walnut halves, 4 almonds”.',
  },
]);

// ─── Hebrew (natural) ──────────────────────────────────────────────────────
ui('he', {
  navPlates: 'צלחות',
  badge: 'צלחות לדוגמה',
  indexTitle: 'צלחות לדוגמה',
  indexLead: 'ארוחות מהיומן — עם כמויות שאפשר להקליד ברישום ארוחה.',
  indexCardSlot: 'מהיומן',
  indexCardTitle: 'יוגורט · צהריים · סשימי בערב',
  indexCardWhy: 'ארבע צלחות מיום אחד — מבוקר עד יוגורט אחרי ערב.',
  indexDisclaimer: '<strong>לא ייעוץ רפואי.</strong> דוגמאות מיומן אישי — לא תוכנית טיפול.',
  pageTitle: 'צלחות לדוגמה',
  h1: 'ארבע צלחות מיום אחד ביומן',
  lead: 'מבוקר עד אחרי ערב — עם כמויות שאפשר להקליד ב־<strong>רישום ארוחה</strong>. מיומן אמיתי, מתקופה של בדיקות כולסטרול.',
  disclaimer:
    '<strong>לא ייעוץ רפואי.</strong> זה מה שאדם אחד תיעד ביומן בתקופת מעבדה — לא הבטחה שהצלחות האלה מורידות כולסטרול. את <strong>הכללים שלי</strong> ומדדי הטיפול קובע הקלינאי; באפליקציה מאשרים כל ארוחה לפני ששומרים.',
  moreTitle: 'עוד',
  moreBody: 'נוסיף צלחות נוספות בהמשך.',
  howToLog: 'איך רושמים ארוחה →',
  allPlates: '← כל הצלחות',
  logMeal: 'רישום ארוחה',
  fresh: 'טרי',
  tbsp1: 'כף',
  tbspN: 'כפות',
  halves: 'חצאים',
  helpIndexLink: 'צלחות לדוגמה — יום מהיומן',
  mealLoggingBlurb:
    '<p><a href="../plates/lipid-protocol.html">צלחות לדוגמה</a> — ארוחות מהיומן עם כמויות שאפשר להקליד ברישום ארוחה.</p>',
});

plates('he', [
  {
    id: 'yogurt-breakfast',
    slot: 'בוקר',
    title: 'יוגורט עם סובין, זרעים, אגוזים ואוכמניות',
    why: 'קערת הבוקר: יוגורט, סובין וזרעים, אוכמניות. מוסיפים 100 מ״ל מים — הצ׳יה, הסובין והפסיליום שותים אותם.',
    alt: 'קערת יוגורט עם סובין, זרעים, אגוזים ואוכמניות',
    img: 'yogurt-breakfast.jpg?v=20260816a',
    items: [
      ['יוגורט 0%', 'yogurtG'],
      ['מים', 'waterMl'],
      ['אוכמניות', 'blueberriesG'],
      ['סובין שיבולת שועל', 'oatBran'],
      ['פסיליום', 'psyllium'],
      ['צ׳יה', 'chia'],
      ['זרעי דלעת', 'pumpkin'],
      ['אגוזי מלך', 'walnuts'],
      ['שקדים', 'almonds'],
    ],
    hint: 'באפליקציה: {log} → טקסט, למשל «יוגורט 0% 150ג, מים 100 מ״ל, אוכמניות 40ג, סובין שיבולת שועל כף, פסיליום כף, ציה כף, זרעי דלעת כף, 3 חצאי אגוז מלך, 4 שקדים».',
  },
  {
    id: 'lunch-protein',
    slot: 'צהריים',
    title: 'דג לבן (או עוף / טופו), עדשים ומלפפון',
    why: 'צהריים: דג לבן עם עדשים, מלפפון ושמן זית. אפשר להחליף לעוף או טופו — בלי אבוקדו בצהריים.',
    alt: 'צלחת צהריים עם דג לבן, עדשים ומלפפון',
    img: 'lunch-protein.jpg?v=20260816a',
    items: [
      ['דג לבן / עוף / טופו', 'proteinG'],
      ['עדשים מבושלות', 'lentils'],
      ['מלפפון', 'cucumberLunch'],
      ['שמן זית', 'oilLunch'],
    ],
    hint: 'באפליקציה: {log} → טקסט, למשל «דג לבן בגריל 150ג, עדשים 5 כפות, מלפפון 2 כפות, שמן זית 2 כפות» — או עוף / טופו במקום הדג.',
  },
  {
    id: 'dinner-sashimi',
    slot: 'ערב',
    title: 'סשימי סלמון, אבוקדו, ג׳ינג׳ר, טריאקי וסלט תאילנדי',
    why: 'בערב: סשימי ואבוקדו, עם סלט קצוץ דק (נבטים, גמבה, מלפפון, בצל, חסה, נענע ובזיליקום), ג׳ינג׳ר וטריאקי.',
    alt: 'צלחת ערב עם סשימי סלמון, אבוקדו וסלט',
    img: 'dinner-sashimi.jpg?v=20260816a',
    items: [
      ['סשימי סלמון', 'sashimi'],
      ['אבוקדו (חצי)', 'avocado'],
      ['ג׳ינג׳ר כבוש', 'ginger'],
      ['רוטב טריאקי', 'teriyaki'],
      ['נבטים', 'sprouts'],
      ['גמבה', 'pepper'],
      ['מלפפון', 'cucumberDinner'],
      ['בצל', 'onion'],
      ['חסה', 'lettuce'],
      ['נענע', 'fresh'],
      ['בזיליקום', 'fresh'],
    ],
    hint: 'את ירקות הסלט קוצצים דק. באפליקציה: {log} → טקסט, למשל «סשימי סלמון 100ג, חצי אבוקדו 100ג, ג׳ינג׳ר כבוש 10ג, טריאקי 15ג, נבטים 50ג, גמבה 40ג, מלפפון 30ג, בצל 20ג, חסה 30ג, נענע, בזיליקום — הכל קצוץ דק».',
  },
  {
    id: 'yogurt-evening',
    slot: 'אחרי ערב',
    title: 'יוגורט עם סובין, זרעים ואגוזים',
    why: 'אותה קערה כמו בבוקר — בלי אוכמניות. גם כאן 100 מ״ל מים; הצ׳יה, הסובין והפסיליום שותים אותם.',
    alt: 'קערת יוגורט עם סובין וזרעים — בלי אוכמניות',
    img: 'yogurt-evening.jpg?v=20260816b',
    items: [
      ['יוגורט 0%', 'yogurtG'],
      ['מים', 'waterMl'],
      ['סובין שיבולת שועל', 'oatBran'],
      ['פסיליום', 'psyllium'],
      ['צ׳יה', 'chia'],
      ['זרעי דלעת', 'pumpkin'],
      ['אגוזי מלך', 'walnuts'],
      ['שקדים', 'almonds'],
    ],
    hint: 'באפליקציה: {log} → טקסט, למשל «יוגורט 0% 150ג, מים 100 מ״ל, סובין שיבולת שועל כף, פסיליום כף, ציה כף, זרעי דלעת כף, 3 חצאי אגוז מלך, 4 שקדים».',
  },
]);
