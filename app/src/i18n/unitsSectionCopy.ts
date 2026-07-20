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
  hint: 'לתצוגה ולהקלדה בלבד — הנתונים נשמרים ביחידות קליניות סטנדרטיות.',
  glucose: 'גלוקוז',
  weight: 'משקל',
  height: 'גובה',
  water: 'מים',
  energy: 'אנרגיה',
};

export function getUnitsSectionCopy(langCode?: string | null): UnitsSectionCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  return EN;
}
