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
  estimateGuidance?: string;
  sortOrder: number;
};

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
