/**
 * Seed rows for diet_marker_catalog (be-47).
 * Clinic-added nutrients are extra rows; this list is upserted on migrate.
 */

export type DietMarkerUnit = 'g' | 'mg' | 'mcg';
export type DietMarkerDirection = 'cap' | 'floor';

export type DietMarkerLabels = Record<string, { short: string; full: string }>;

export type DietMarkerCatalogSeedRow = {
  code: string;
  unit: DietMarkerUnit;
  defaultDirection: DietMarkerDirection;
  linkedLabCodes: string[];
  labels: DietMarkerLabels;
  /**
   * Required. This is the only definition Gemini gets of what the field means —
   * without it the model estimates from the JSON field name alone and quietly
   * fills sat_fat_g with total fat. Say what counts, what does not, and which
   * neighbouring macro must never be copied in.
   */
  estimateGuidance: string;
  /** Set only when a clinic may cap this as a share of daily energy (sat fat 9, sugar 4). */
  kcalPerGram?: number;
  sortOrder: number;
};

const SAT_FAT_GUIDANCE =
  'SAT_FAT_G (sat_fat_g): count **saturated fatty acids only** — the saturated share of this ' +
  'item\'s fat (Hebrew: שומן רווי). Main sources: butter, ghee, cream, full-fat dairy and hard ' +
  'cheese, fatty meat, chicken skin, processed meat, coconut oil, palm oil, cocoa butter. ' +
  'Do **not** count mono- or polyunsaturated fat (olive oil, avocado, nuts, seeds, oily fish) ' +
  'even though those raise fat_g. Do **not** copy total fat_g into this field — for most mixed ' +
  'foods saturated fat is well under half of total fat.';

const CHOLESTEROL_GUIDANCE =
  'CHOLESTEROL_MG (cholesterol_mg): estimate **dietary cholesterol in mg** (Hebrew: כולסטרול תזונתי). ' +
  'Only animal foods contain it: egg yolk (~185 mg per large egg), liver and other organ meats, ' +
  'shellfish and shrimp, butter, cheese, cream, fatty meat and poultry. ' +
  'All plant foods are 0.0 — vegetables, fruit, grains, legumes, nuts, and vegetable oils, ' +
  'including coconut and palm oil. Dietary cholesterol is **not** saturated fat: do not copy ' +
  'sat_fat_g into this field, and do not scale one from the other.';

const SOLUBLE_FIBER_GUIDANCE =
  'SOLUBLE_FIBER_G (soluble_fiber_g): count the **soluble fraction of dietary fiber only** ' +
  '(Hebrew: סיבים מסיסים). Main sources: oats and oat bran (beta-glucan), barley, legumes and ' +
  'lentils, psyllium, apple and citrus pectin, carrot, aubergine, okra. ' +
  'Do **not** count insoluble fiber — wheat bran, whole-grain bread, vegetable skins, most seeds. ' +
  'In mixed foods the soluble share is typically a quarter to a third of total fiber. ' +
  'Do **not** copy fiber_g into this field.';

const OMEGA3_GUIDANCE =
  'OMEGA3_G (omega3_g): estimate **total omega-3 fatty acids in grams** (EPA + DHA + ALA; ' +
  'Hebrew: אומגה 3). Main sources: oily fish (salmon, sardine, mackerel, herring, anchovy, trout), ' +
  'fish oil, flaxseed and flax oil, chia, walnut, and canola or soybean oil. ' +
  'Lean white fish, shellfish, meat, dairy and eggs contribute little unless omega-3 enriched. ' +
  'Do **not** count omega-6 or total fat — do not copy fat_g into this field. ' +
  'Amounts are small: a typical salmon portion is around 1–2 g, most foods are 0.0–0.1 g.';

const SODIUM_GUIDANCE =
  'SODIUM_MG (sodium_mg): estimate **sodium in mg, not salt in grams** (Hebrew: נתרן). ' +
  'Convert when the food is described by salt: 1 g of salt (NaCl) is about 400 mg sodium, and ' +
  'one teaspoon of salt is about 2300 mg sodium. Count added and cooking salt, bread and baked ' +
  'goods, cheese, cured and processed meat, canned goods, pickles and olives, soy sauce, stock ' +
  'cubes, sauces, and salty snacks. Fresh produce, plain grains, unsalted meat and oils are ' +
  'near 0. Do **not** report grams of salt in this field.';

const POTASSIUM_GUIDANCE =
  'POTASSIUM_MG (potassium_mg): estimate **potassium in mg** (Hebrew: אשלגן). ' +
  'High sources: potato and sweet potato, banana, avocado, tomato and especially tomato paste, ' +
  'orange and citrus juice, dried fruit, legumes, nuts, spinach and leafy greens, dairy, coffee, ' +
  'and potassium-chloride salt substitutes. Refined grains, oils, and sugar are low. ' +
  'When the description says a vegetable or potato was **boiled and drained**, lower the estimate ' +
  'substantially — leaching removes a large share. Do **not** copy sodium_mg into this field.';

const PHOSPHORUS_GUIDANCE =
  'PHOSPHORUS_MG (phosphorus_mg): estimate **phosphorus in mg** (Hebrew: זרחן). ' +
  'Count dairy and cheese, meat, fish, eggs, legumes, nuts and seeds, and whole grains. ' +
  'Give particular weight to **phosphate additives** in processed foods, processed cheese, cola ' +
  'and other dark soft drinks, and enhanced or brined meat — additive phosphorus is almost fully ' +
  'absorbed, so do not treat those items as low. Fruit, most vegetables, oils and sugar are low. ' +
  'Do **not** copy protein_g or potassium_mg into this field.';

const SUGAR_GUIDANCE =
  'SUGAR_G (sugar_g): count **simple sugars only** — mono- and disaccharides ' +
  '(glucose, fructose, sucrose, lactose, maltose; Hebrew: חד־סוכר ודו־סוכר / סוכרים פשוטים). ' +
  'Include intrinsic sugars in fruit, milk, honey, and sweetened foods. ' +
  'Do **not** count starch (bread, rice, potato, pasta) or fiber. ' +
  'Do **not** copy total carb_g or net carbs into this field — only the simple-sugar portion.';

const IODINE_GUIDANCE =
  'IODINE_MCG (iodine_mcg): estimate dietary iodine in **mcg** (not mg). Count iodized salt, ' +
  'dairy, eggs, fish/seafood, seaweed, and iodine-fortified foods. Un-iodized salt and most ' +
  'fresh produce contribute little. Do **not** copy sodium_mg into this field.';

const SELENIUM_GUIDANCE =
  'SELENIUM_MCG (selenium_mcg): estimate dietary selenium in **mcg** (not mg). Count Brazil nuts, ' +
  'seafood, organ meats, eggs, poultry, and whole grains when relevant. Amounts vary a lot by soil; ' +
  'prefer typical food averages. Do **not** copy iodine_mcg or sodium_mg into this field.';

export const DIET_MARKER_CATALOG_SEED: DietMarkerCatalogSeedRow[] = [
  {
    code: 'SAT_FAT_G',
    unit: 'g',
    defaultDirection: 'cap',
    linkedLabCodes: ['CHOLESTEROL_LDL', 'CHOLESTEROL'],
    labels: {
      en: { short: 'Sat. fat', full: 'Saturated fat' },
      he: { short: 'רווי', full: 'שומן רווי' },
    },
    estimateGuidance: SAT_FAT_GUIDANCE,
    kcalPerGram: 9,
    sortOrder: 10,
  },
  {
    code: 'CHOLESTEROL_MG',
    unit: 'mg',
    defaultDirection: 'cap',
    linkedLabCodes: ['CHOLESTEROL_LDL', 'CHOLESTEROL'],
    labels: {
      en: { short: 'Chol.', full: 'Dietary cholesterol' },
      he: { short: 'כול׳', full: 'כולסטרול תזונתי' },
    },
    estimateGuidance: CHOLESTEROL_GUIDANCE,
    sortOrder: 20,
  },
  {
    code: 'SOLUBLE_FIBER_G',
    unit: 'g',
    defaultDirection: 'floor',
    linkedLabCodes: ['CHOLESTEROL_LDL'],
    labels: {
      en: { short: 'Sol. fiber', full: 'Soluble fiber' },
      he: { short: 'מסיסים', full: 'סיבים מסיסים' },
    },
    estimateGuidance: SOLUBLE_FIBER_GUIDANCE,
    sortOrder: 30,
  },
  {
    code: 'OMEGA3_G',
    unit: 'g',
    defaultDirection: 'floor',
    linkedLabCodes: ['TRIGLYCERIDES'],
    labels: {
      en: { short: 'Ω3', full: 'Omega-3' },
      he: { short: 'אומגה‑3', full: 'אומגה‑3' },
    },
    estimateGuidance: OMEGA3_GUIDANCE,
    sortOrder: 40,
  },
  {
    code: 'SUGAR_G',
    unit: 'g',
    defaultDirection: 'cap',
    linkedLabCodes: ['HBA1C', 'GLUCOSE', 'TRIGLYCERIDES'],
    labels: {
      en: { short: 'Sugar', full: 'Simple sugars' },
      he: { short: 'סוכר', full: 'סוכרים פשוטים' },
    },
    estimateGuidance: SUGAR_GUIDANCE,
    kcalPerGram: 4,
    sortOrder: 50,
  },
  {
    code: 'SODIUM_MG',
    unit: 'mg',
    defaultDirection: 'cap',
    linkedLabCodes: [],
    labels: {
      en: { short: 'Na', full: 'Sodium' },
      he: { short: 'נתרן', full: 'נתרן' },
    },
    estimateGuidance: SODIUM_GUIDANCE,
    sortOrder: 60,
  },
  {
    code: 'POTASSIUM_MG',
    unit: 'mg',
    defaultDirection: 'cap',
    linkedLabCodes: ['CREATININE', 'UREA'],
    labels: {
      en: { short: 'K', full: 'Potassium' },
      he: { short: 'אשלגן', full: 'אשלגן' },
    },
    estimateGuidance: POTASSIUM_GUIDANCE,
    sortOrder: 70,
  },
  {
    code: 'PHOSPHORUS_MG',
    unit: 'mg',
    defaultDirection: 'cap',
    linkedLabCodes: ['CREATININE', 'UREA'],
    labels: {
      en: { short: 'P', full: 'Phosphorus' },
      he: { short: 'זרחן', full: 'זרחן' },
    },
    estimateGuidance: PHOSPHORUS_GUIDANCE,
    sortOrder: 80,
  },
  {
    code: 'IODINE_MCG',
    unit: 'mcg',
    defaultDirection: 'floor',
    linkedLabCodes: ['TSH'],
    labels: {
      en: { short: 'Iod', full: 'Iodine' },
      he: { short: 'יוד', full: 'יוד' },
    },
    estimateGuidance: IODINE_GUIDANCE,
    sortOrder: 90,
  },
  {
    code: 'SELENIUM_MCG',
    unit: 'mcg',
    defaultDirection: 'floor',
    linkedLabCodes: ['TSH'],
    labels: {
      en: { short: 'Se', full: 'Selenium' },
      he: { short: 'סלניום', full: 'סלניום' },
    },
    estimateGuidance: SELENIUM_GUIDANCE,
    sortOrder: 100,
  },
];
