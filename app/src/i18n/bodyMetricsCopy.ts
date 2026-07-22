/**
 * Body composition metric labels — coach language.
 * Unit symbols (kg, lb, %) stay English — glossary.
 */

export type BodyMetricsCopy = {
  weight: string;
  fat: string;
  fatPct: string;
  muscle: string;
  /** Short suffix when fat % is estimated from profile. */
  fatEst: string;
  a11yWeight: (value: string) => string;
  a11yMuscle: (value: string) => string;
  a11yFat: (value: string) => string;
};

const EN: BodyMetricsCopy = {
  weight: 'Weight',
  fat: 'Fat',
  fatPct: 'Fat %',
  muscle: 'Muscle',
  fatEst: '(est.)',
  a11yWeight: (v) => `Weight ${v}`,
  a11yMuscle: (v) => `Muscle mass ${v}`,
  a11yFat: (v) => `Fat mass ${v}`,
};

const HE: BodyMetricsCopy = {
  weight: 'משקל',
  fat: 'שומן',
  fatPct: 'שומן %',
  muscle: 'שריר',
  fatEst: '(משוער)',
  a11yWeight: (v) => `משקל ${v}`,
  a11yMuscle: (v) => `מסת שריר ${v}`,
  a11yFat: (v) => `מסת שומן ${v}`,
};

const ES: BodyMetricsCopy = {
  weight: 'Peso',
  fat: 'Grasa',
  fatPct: 'Grasa %',
  muscle: 'Músculo',
  fatEst: '(est.)',
  a11yWeight: (v) => `Peso ${v}`,
  a11yMuscle: (v) => `Masa muscular ${v}`,
  a11yFat: (v) => `Masa grasa ${v}`,
};

const FR: BodyMetricsCopy = {
  weight: 'Poids',
  fat: 'Graisse',
  fatPct: 'Graisse %',
  muscle: 'Muscle',
  fatEst: '(est.)',
  a11yWeight: (v) => `Poids ${v}`,
  a11yMuscle: (v) => `Masse musculaire ${v}`,
  a11yFat: (v) => `Masse grasse ${v}`,
};

const DE: BodyMetricsCopy = {
  weight: 'Gewicht',
  fat: 'Fett',
  fatPct: 'Fett %',
  muscle: 'Muskel',
  fatEst: '(gesch.)',
  a11yWeight: (v) => `Gewicht ${v}`,
  a11yMuscle: (v) => `Muskelmasse ${v}`,
  a11yFat: (v) => `Fettmasse ${v}`,
};

const AR: BodyMetricsCopy = {
  weight: 'الوزن',
  fat: 'الدهون',
  fatPct: 'الدهون %',
  muscle: 'العضلات',
  fatEst: '(تقديري)',
  a11yWeight: (v) => `الوزن ${v}`,
  a11yMuscle: (v) => `كتلة العضلات ${v}`,
  a11yFat: (v) => `كتلة الدهون ${v}`,
};

const RU: BodyMetricsCopy = {
  weight: 'Вес',
  fat: 'Жир',
  fatPct: 'Жир %',
  muscle: 'Мышцы',
  fatEst: '(оценка)',
  a11yWeight: (v) => `Вес ${v}`,
  a11yMuscle: (v) => `Мышечная масса ${v}`,
  a11yFat: (v) => `Жировая масса ${v}`,
};

export function getBodyMetricsCopy(langCode?: string | null): BodyMetricsCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  if (c === 'es') return ES;
  if (c === 'fr') return FR;
  if (c === 'de') return DE;
  if (c === 'ar') return AR;
  if (c === 'ru') return RU;
  return EN;
}
