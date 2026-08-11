/**
 * Treatment marker labels + Food Log meter copy (prompt110).
 */

import type { DietMarkerCode } from '../services/TreatmentMarkerService';

export type TreatmentMarkersCopy = {
  clinicBadge: string;
  estimated: string;
  capLabel: string;
  floorLabel: string;
  detailTitle: string;
  setByClinic: string;
  noLab: string;
  labProvenance: (code: string, value: string, date: string) => string;
  nudgeTitle: string;
  nudgeBody: (markerLabel: string, labCode: string) => string;
  nudgeDismiss: string;
  shortLabel: Record<DietMarkerCode, string>;
  fullLabel: Record<DietMarkerCode, string>;
};

const SHORT_EN: Record<DietMarkerCode, string> = {
  SAT_FAT_G: 'SatF',
  CHOLESTEROL_MG: 'Chol',
  SOLUBLE_FIBER_G: 'SolFi',
  OMEGA3_G: 'Ω3',
  ADDED_SUGAR_G: 'Sugar',
  SODIUM_MG: 'Na',
  POTASSIUM_MG: 'K',
  PHOSPHORUS_MG: 'P',
};

const FULL_EN: Record<DietMarkerCode, string> = {
  SAT_FAT_G: 'Saturated fat',
  CHOLESTEROL_MG: 'Dietary cholesterol',
  SOLUBLE_FIBER_G: 'Soluble fiber',
  OMEGA3_G: 'Omega-3',
  ADDED_SUGAR_G: 'Added sugar',
  SODIUM_MG: 'Sodium',
  POTASSIUM_MG: 'Potassium',
  PHOSPHORUS_MG: 'Phosphorus',
};

const EN: TreatmentMarkersCopy = {
  clinicBadge: 'Clinic',
  estimated: 'Estimated',
  capLabel: 'Cap',
  floorLabel: 'Floor',
  detailTitle: 'Treatment marker',
  setByClinic: 'Set by your clinic',
  noLab: 'No linked lab result yet',
  labProvenance: (code, value, date) => `${code} ${value} · ${date}`,
  nudgeTitle: 'New lab result',
  nudgeBody: (markerLabel, labCode) =>
    `New ${labCode} result — review your ${markerLabel} target with your nutritionist.`,
  nudgeDismiss: 'Got it',
  shortLabel: SHORT_EN,
  fullLabel: FULL_EN,
};

const HE: TreatmentMarkersCopy = {
  clinicBadge: 'מרפאה',
  estimated: 'הערכה',
  capLabel: 'תקרה',
  floorLabel: 'רצפה',
  detailTitle: 'מדד טיפול',
  setByClinic: 'הוגדר על ידי המרפאה',
  noLab: 'אין עדיין תוצאת מעבדה מקושרת',
  labProvenance: (code, value, date) => `${code} ${value} · ${date}`,
  nudgeTitle: 'תוצאת מעבדה חדשה',
  nudgeBody: (markerLabel, labCode) =>
    `תוצאת ${labCode} חדשה — בדקו עם התזונאית את יעד ${markerLabel}.`,
  nudgeDismiss: 'הבנתי',
  shortLabel: {
    SAT_FAT_G: 'שומן רווי',
    CHOLESTEROL_MG: 'כולסטרול',
    SOLUBLE_FIBER_G: 'סיבים מסיסים',
    OMEGA3_G: 'אומגה‑3',
    ADDED_SUGAR_G: 'סוכר',
    SODIUM_MG: 'נתרן',
    POTASSIUM_MG: 'אשלגן',
    PHOSPHORUS_MG: 'זרחן',
  },
  fullLabel: {
    SAT_FAT_G: 'שומן רווי',
    CHOLESTEROL_MG: 'כולסטרול תזונתי',
    SOLUBLE_FIBER_G: 'סיבים מסיסים',
    OMEGA3_G: 'אומגה‑3',
    ADDED_SUGAR_G: 'סוכר מוסף',
    SODIUM_MG: 'נתרן',
    POTASSIUM_MG: 'אשלגן',
    PHOSPHORUS_MG: 'זרחן',
  },
};

export function getTreatmentMarkersCopy(langCode?: string | null): TreatmentMarkersCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  // Other locales: English labels for v1 (glossary units stay English anyway).
  return EN;
}
