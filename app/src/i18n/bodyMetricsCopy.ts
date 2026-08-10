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
  /** prompt108 — save adds a history reading */
  weightHistoryHint: string;
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
  weightHistoryHint: 'Saving adds a new weight reading to your history (does not erase past entries).',
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
  weightHistoryHint: 'שמירה מוסיפה מדידת משקל חדשה להיסטוריה (לא מוחקת מדידות קודמות).',
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
  weightHistoryHint: 'Guardar añade una nueva lectura de peso al historial (no borra entradas anteriores).',
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
  weightHistoryHint: 'Enregistrer ajoute une nouvelle mesure de poids à l’historique (sans effacer le passé).',
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
  weightHistoryHint: 'Speichern fügt eine neue Gewichtsmessung zur Historie hinzu (löscht keine alten).',
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
  weightHistoryHint: 'الحفظ يضيف قراءة وزن جديدة إلى السجل (ولا يمحو القراءات السابقة).',
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
  weightHistoryHint: 'Сохранение добавляет новое измерение веса в историю (старые не удаляются).',
  a11yWeight: (v) => `Вес ${v}`,
  a11yMuscle: (v) => `Мышечная масса ${v}`,
  a11yFat: (v) => `Жировая масса ${v}`,
};

const PT: BodyMetricsCopy = {
  weight: 'Peso',
  fat: 'Gordura',
  fatPct: 'Gordura %',
  muscle: 'Músculo',
  fatEst: '(est.)',
  weightHistoryHint: 'Guardar adiciona uma nova leitura de peso ao histórico (não apaga as anteriores).',
  a11yWeight: (v) => `Peso ${v}`,
  a11yMuscle: (v) => `Massa muscular ${v}`,
  a11yFat: (v) => `Massa gorda ${v}`,
};

const IT: BodyMetricsCopy = {
  weight: 'Peso',
  fat: 'Grasso',
  fatPct: 'Grasso %',
  muscle: 'Muscolo',
  fatEst: '(stim.)',
  weightHistoryHint: 'Salvare aggiunge una nuova lettura del peso alla cronologia (non cancella le precedenti).',
  a11yWeight: (v) => `Peso ${v}`,
  a11yMuscle: (v) => `Massa muscolare ${v}`,
  a11yFat: (v) => `Massa grassa ${v}`,
};

const TR: BodyMetricsCopy = {
  weight: 'Kilo',
  fat: 'Yağ',
  fatPct: 'Yağ %',
  muscle: 'Kas',
  fatEst: '(tah.)',
  weightHistoryHint: 'Kaydetmek geçmişe yeni bir kilo ölçümü ekler (eski kayıtları silmez).',
  a11yWeight: (v) => `Kilo ${v}`,
  a11yMuscle: (v) => `Kas kütlesi ${v}`,
  a11yFat: (v) => `Yağ kütlesi ${v}`,
};

export function getBodyMetricsCopy(langCode?: string | null): BodyMetricsCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  if (c === 'es') return ES;
  if (c === 'fr') return FR;
  if (c === 'de') return DE;
  if (c === 'ar') return AR;
  if (c === 'ru') return RU;
  if (c === 'pt') return PT;
  if (c === 'it') return IT;
  if (c === 'tr') return TR;
  return EN;
}
