/**
 * Food Log chrome — meal slots, energy labels, action buttons (coach language, 7 locales).
 */

export type FoodLogUiCopy = {
  breakfast: string;
  lunch: string;
  snack: string;
  dinner: string;
  eaten: string;
  activity: string;
  burned: string;
  deficit: string;
  surplus: string;
  meal: string;
  water: string;
};

const EN: FoodLogUiCopy = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  eaten: 'eaten',
  activity: 'activity',
  burned: 'burned',
  deficit: 'deficit',
  surplus: 'surplus',
  meal: 'Meal',
  water: 'Water',
};

const HE: FoodLogUiCopy = {
  breakfast: 'ארוחת בוקר',
  lunch: 'ארוחת צהריים',
  snack: 'חטיף',
  dinner: 'ארוחת ערב',
  eaten: 'נאכל',
  activity: 'פעילות',
  burned: 'נשרף',
  deficit: 'גירעון',
  surplus: 'עודף',
  meal: 'ארוחה',
  water: 'מים',
};

const ES: FoodLogUiCopy = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Snack',
  dinner: 'Cena',
  eaten: 'comido',
  activity: 'actividad',
  burned: 'quemado',
  deficit: 'déficit',
  surplus: 'superávit',
  meal: 'Comida',
  water: 'Agua',
};

const FR: FoodLogUiCopy = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  snack: 'Collation',
  dinner: 'Dîner',
  eaten: 'mangé',
  activity: 'activité',
  burned: 'brûlé',
  deficit: 'déficit',
  surplus: 'surplus',
  meal: 'Repas',
  water: 'Eau',
};

const DE: FoodLogUiCopy = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  snack: 'Snack',
  dinner: 'Abendessen',
  eaten: 'gegessen',
  activity: 'Aktivität',
  burned: 'verbrannt',
  deficit: 'Defizit',
  surplus: 'Überschuss',
  meal: 'Mahlzeit',
  water: 'Wasser',
};

const AR: FoodLogUiCopy = {
  breakfast: 'الفطور',
  lunch: 'الغداء',
  snack: 'وجبة خفيفة',
  dinner: 'العشاء',
  eaten: 'مأكول',
  activity: 'نشاط',
  burned: 'محروق',
  deficit: 'عجز',
  surplus: 'فائض',
  meal: 'وجبة',
  water: 'ماء',
};

const RU: FoodLogUiCopy = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  snack: 'Перекус',
  dinner: 'Ужин',
  eaten: 'съедено',
  activity: 'активность',
  burned: 'сожжено',
  deficit: 'дефицит',
  surplus: 'профицит',
  meal: 'Приём пищи',
  water: 'Вода',
};

const BY_CODE: Record<string, FoodLogUiCopy> = {
  en: EN,
  he: HE,
  es: ES,
  fr: FR,
  de: DE,
  ar: AR,
  ru: RU,
};

export function getFoodLogUiCopy(langCode?: string | null): FoodLogUiCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}
