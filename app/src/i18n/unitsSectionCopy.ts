/**
 * Units preference section labels (prompt81).
 * Unit symbols (mg/dL, kg, kcal…) stay English — glossary.
 */

export type UnitsSectionCopy = {
  title: string;
  hint: string;
  glucose: string;
  weight: string;
  height: string;
  water: string;
  energy: string;
};

const EN: UnitsSectionCopy = {
  title: 'Units & measurements',
  hint: 'Display and input only — data stays in standard clinical units.',
  glucose: 'Glucose',
  weight: 'Weight',
  height: 'Height',
  water: 'Water',
  energy: 'Energy',
};

/** Native Israeli microcopy — not EN→HE. Unit codes stay Latin. */
const HE: UnitsSectionCopy = {
  title: 'יחידות מידה',
  hint: 'לתצוגה ולהקלדה בלבד. מאחורי הקלעים נשמרים ביחידות קליניות סטנדרטיות.',
  glucose: 'גלוקוז',
  weight: 'משקל',
  height: 'גובה',
  water: 'מים',
  energy: 'אנרגיה',
};

/** Native DACH microcopy — not EN→DE. Unit codes stay Latin. */
const DE: UnitsSectionCopy = {
  title: 'Maßeinheiten',
  hint: 'Nur Anzeige und Eingabe. Gespeichert wird in klinischen Standard-Einheiten.',
  glucose: 'Glukose',
  weight: 'Gewicht',
  height: 'Größe',
  water: 'Wasser',
  energy: 'Energie',
};

/** Native Spanish clinic microcopy — not EN→ES. Unit codes stay Latin. */
const ES: UnitsSectionCopy = {
  title: 'Unidades de medida',
  hint: 'Solo visualización e introducción. Se guarda en unidades clínicas estándar.',
  glucose: 'Glucosa',
  weight: 'Peso',
  height: 'Altura',
  water: 'Agua',
  energy: 'Energía',
};

/** Native French clinic microcopy — not EN→FR. Unit codes stay Latin. */
const FR: UnitsSectionCopy = {
  title: 'Unités de mesure',
  hint: 'Affichage et saisie seulement. Stockage en unités cliniques standard.',
  glucose: 'Glucose',
  weight: 'Poids',
  height: 'Taille',
  water: 'Eau',
  energy: 'Énergie',
};

/** Native Arabic clinic microcopy — not EN→AR. Unit codes stay Latin. */
const AR: UnitsSectionCopy = {
  title: 'وحدات القياس',
  hint: 'للعرض والإدخال فقط. التخزين بوحدات سريرية قياسية.',
  glucose: 'الجلوكوز',
  weight: 'الوزن',
  height: 'الطول',
  water: 'الماء',
  energy: 'الطاقة',
};

/** Native Russian clinic microcopy — not EN→RU. Unit codes stay Latin. */
const RU: UnitsSectionCopy = {
  title: 'Единицы измерения',
  hint: 'Только отображение и ввод. Хранение — в стандартных клинических единицах.',
  glucose: 'Глюкоза',
  weight: 'Вес',
  height: 'Рост',
  water: 'Вода',
  energy: 'Энергия',
};

/** Native Brazilian Portuguese microcopy — not EN→PT. Unit codes stay Latin. */
const PT: UnitsSectionCopy = {
  title: 'Unidades de medida',
  hint: 'Só para exibição e entrada. Os dados ficam em unidades clínicas padrão.',
  glucose: 'Glicose',
  weight: 'Peso',
  height: 'Altura',
  water: 'Água',
  energy: 'Energia',
};

/** Native Italian clinic microcopy — not EN→IT. Unit codes stay Latin. */
const IT: UnitsSectionCopy = {
  title: 'Unità di misura',
  hint: 'Solo visualizzazione e inserimento. I dati restano in unità cliniche standard.',
  glucose: 'Glucosio',
  weight: 'Peso',
  height: 'Altezza',
  water: 'Acqua',
  energy: 'Energia',
};

/** Native Turkish clinic microcopy — not EN→TR. Unit codes stay Latin. */
const TR: UnitsSectionCopy = {
  title: 'Ölçü birimleri',
  hint: 'Yalnızca görüntüleme ve giriş. Veriler standart klinik birimlerde saklanır.',
  glucose: 'Glukoz',
  weight: 'Kilo',
  height: 'Boy',
  water: 'Su',
  energy: 'Enerji',
};

export function getUnitsSectionCopy(langCode?: string | null): UnitsSectionCopy {
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
