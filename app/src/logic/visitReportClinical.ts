/**
 * Professional nutrition assessment narrative for visit reports.
 * Reads like an internal clinic note + app-collected evidence.
 */

import { localDayKeyFromMs, periodDeltaKg, periodEndpointsKg, resolveCompositionPeriodAnchor } from './metabolicTrend7d';
import {
  analyzeMealGlucoseResponse,
  buildPeriodDayNightGlucoseLines,
  buildPeriodMealGlucoseSection,
} from './mealGlucoseAnalysis';
import type { FoodEntry } from '../services/FoodLogService';
import { getDailyMacros } from '../services/FoodLogService';
import {
  buildLipidTrendPoints,
  getLatestKidneyLabStatus,
  getLatestLabReport,
  scanGlycemicLabStatus,
  scanLipidLabStatus,
  type LabReport,
  type LipidTrendPoint,
} from '../services/LabLogService';
import { computeBurnKcalByDay } from '../services/ReviewService';
import type { TimePoint } from '../services/HealthConnectService';
import type { CgmSessionStart } from './cgmWarmupFilter';
import type {
  CoachMessage,
  DailyMacroTarget,
  Gender,
  UserLanguage,
  UserRules,
} from '../services/TargetService';
import type { MetabolicTrend7dDay, CompositionSession } from './metabolicTrend7d';
import type { WorkoutSession } from '../services/WithingsApiService';
import type { VisitReportProfile } from './visitReportExport';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';
import {
  formatEnergy,
  formatGlucose,
  formatHeight,
  formatMass,
  kgToDisplay,
  massUnitLabel,
} from './unitConvert';
import { DEFAULT_UNITS_PREFS } from '../services/UnitsPreferenceService';

export type ClinicalTable = {
  headers: string[];
  rows: string[][];
};

export type ClinicalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  table?: ClinicalTable;
};

export type VisitReportClinicalNote = {
  documentTitle: string;
  headerLines: string[];
  sections: ClinicalSection[];
  impressionTitle: string;
  impressionParagraphs: string[];
  appendixTitle: string;
  appendixIntro: string;
};

export type BuildClinicalNoteInput = {
  dayCount: number;
  exportedAt: string;
  lang?: UserLanguage | null;
  gender: Gender | null;
  profile: VisitReportProfile;
  macroTarget: DailyMacroTarget | null;
  userRules: UserRules | null;
  labs: LabReport[];
  coachMsg: CoachMessage | null;
  includeCoach: boolean;
  bodyTrendDays: MetabolicTrend7dDay[];
  compositionSessions: CompositionSession[];
  workouts: WorkoutSession[];
  caloriePoints: import('../services/WithingsApiService').WithingsCaloriePoint[];
  heartRatePoints: import('../services/WithingsApiService').WithingsHeartRatePoint[];
  glucose: TimePoint[];
  cgmSessionStarts: CgmSessionStart[];
  cgmStatSummary: string | null;
  periodReviewText: string;
  unitsPrefs?: UnitsPrefs;
};

function dayKeyDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return localDayKeyFromMs(d.getTime());
}

function windowDayKeys(dayCount: number): string[] {
  const n = Math.min(dayCount, 128);
  const keys: string[] = [];
  for (let daysAgo = n - 1; daysAgo >= 0; daysAgo--) {
    keys.push(dayKeyDaysAgo(daysAgo));
  }
  return keys;
}

function fmtDate(iso: string, lang?: UserLanguage | null): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  const locale = lang?.code === 'he' ? 'he-IL' : lang?.code === 'ar' ? 'ar' : undefined;
  try {
    return new Date(t).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg == null || heightCm == null || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function deltaPhrase(delta: number, unit: string, labels: ReturnType<typeof clinicalLabels>): string {
  const sign = delta >= 0 ? '+' : '';
  if (delta < 0 && labels.improved) return `${sign}${delta.toFixed(1)} ${unit} (${labels.improved})`;
  if (delta > 0 && labels.worsened) return `${sign}${delta.toFixed(1)} ${unit} (${labels.worsened})`;
  return `${sign}${delta.toFixed(1)} ${unit}`;
}

function clinicalLabels(lang?: UserLanguage | null) {
  if (lang?.code === 'he') {
    return {
      documentTitle: 'הערכת תזונה — דוח ביקור פנימי',
      headerType: 'סוג מסמך: הערכת תזונה פנימית (נתוני wellness מ-self-tracking)',
      period: 'תקופת דיווח',
      days: 'ימים',
      exported: 'תאריך הפקה',
      disclaimer:
        'מקור: HEALTHINGS.AI — יומן ארוחות, CGM, Withings, בדיקות מעבדה שהועלו. לשיתוף מקצועי בלבד; אינו אבחון רפואי.',
      s1: '1. נתוני מטופל ותקופה',
      s2: '2. אנתרופומטריה והרכב גוף',
      s3: '3. סקירת מעבדה',
      s4: '4. הערכת intake תזונתי',
      s5: '5. תגובת גלוקוז (CGM) וקשר לארוחות',
      s6: '6. איזון אנרגטי ופעילות גופנית',
      s7: '7. תוכנית תזונה נוכחית',
      s8: '8. סיכום קליני / רושם',
      impressionTitle: 'סיכום קליני',
      appendixTitle: 'נספח ב — נתונים מפורטים',
      appendixIntro: 'טבלאות מעבדה מלאות + יומן יומי (CGM, ארוחות, אימונים).',
      noData: 'אין נתונים בתקופה זו',
      male: 'זכר',
      female: 'נקבה',
      other: 'אחר',
      age: 'גיל',
      sex: 'מין',
      height: 'גובה',
      weight: 'משקל',
      bmi: 'BMI',
      measured: 'נמדד',
      lipidTrend: 'מגמת שומנים בדם',
      lipidTrendNarrative: 'מגמת LDL',
      latestLabs: 'מעבדה אחרונה',
      kidney: 'סימנים renal',
      glycemic: 'סימנים glycemic',
      high: 'גבוה',
      low: 'נמוך',
      avgIntake: 'ממוצע intake בימים עם דיווח',
      daysLogged: 'ימים עם דיווח ארוחות',
      of: 'מתוך',
      targets: 'יעדים',
      carbOver: 'ימים מעל יעד פחמימות',
      proteinUnder: 'ימים מתחת ל-90% יעד חלבון',
      sparseLogging: 'דיווח ארוחות חלקי — הממוצעים עלולים לה infrrepresent intake.',
      workouts: 'אימונים',
      sessions: 'מפגשים',
      activeKcal: 'kcal פעילות',
      energyBalance: 'ממוצע אנרגיה יומי (ימים עם דיווח)',
      eaten: 'נצרך',
      burn: 'הוצאה משוערת',
      surplus: 'עודף',
      deficit: 'גירעון',
      rules: 'כללי תזונה מתועדים',
      macroRx: 'מרשם מקרו',
      coachNotes: 'הערות מנטור תזונה (היום)',
      improved: 'שיפור',
      worsened: 'עלייה',
      ldl: 'LDL',
      hdl: 'HDL',
      tc: 'כולסטרול כולל',
      tg: 'טריגליצרides',
      date: 'תאריך',
      noLipidTrend: 'ייבאו לפחות 2 דוחות עם panel שומנים כדי לראות מגמה.',
      singleLipid: 'panel שומנים אחרון',
      problemFoodsHeader: 'מזונות שחוזרים לפני עליות גלוקוז לאחר ארוחה',
      foodRiseTag: 'עליות לאחר ארוחה',
      noCgm: 'אין נתוני CGM בחלון הדיווח.',
      cgmCoverage: 'ימים עם CGM',
      impressionClosing: 'המלצות ושינוי תוכנית — באחריות התזונאית/צוות רפואי.',
    };
  }
  if (lang?.code === 'ar') {
    return {
      documentTitle: 'تقييم التغذية — تقرير زيارة داخلي',
      headerType: 'نوع المستند: تقييم تغذية داخلي (بيانات wellness ذاتية)',
      period: 'فترة التقرير',
      days: 'أيام',
      exported: 'تاريخ الإصدار',
      disclaimer:
        'المصدر: HEALTHINGS.AI — سجل الوجبات، CGM، Withings، نتائج المختبر المرفوعة. للتعاون المهني فقط.',
      s1: '1. بيانات المريض والفترة',
      s2: '2. القياسات وتكوين الجسم',
      s3: '3. مراجعة المختبر',
      s4: '4. تقيim التغذية',
      s5: '5. استجابة السكر (CGM) والوجبات',
      s6: '6. التوازن الطاقي والنشاط',
      s7: '7. خطة التغذية الحالية',
      s8: '8. الانطباع السريري',
      impressionTitle: 'الانطباع السريري',
      appendixTitle: 'ملحق ب — بيانات تفصيلية',
      appendixIntro: 'جداول مختبر كاملة + سجل يومي.',
      noData: 'لا بيانات في هذه الفترة',
      male: 'ذكر',
      female: 'أنثى',
      other: 'آخر',
      age: 'العمر',
      sex: 'الجنس',
      height: 'الطول',
      weight: 'الوزن',
      bmi: 'BMI',
      measured: 'ق measured',
      lipidTrend: 'اتجاه الدهون في الدم',
      lipidTrendNarrative: 'اتجاه LDL',
      latestLabs: 'آخر مختبر',
      kidney: 'علامات renal',
      glycemic: 'علامات glycemic',
      high: 'مرتفع',
      low: 'منخفض',
      avgIntake: 'متوسط intake في أيام مسجلة',
      daysLogged: 'أيام مع وجبات',
      of: 'من',
      targets: 'أهداف',
      carbOver: 'أيام فوق هدف الكarb',
      proteinUnder: 'أيام تحت 90% هدف البrotein',
      sparseLogging: 'تسجيل وجبات جزئي — المتوسطات قد لا تعكس intake كاملاً.',
      workouts: 'تمارين',
      sessions: 'جلسات',
      activeKcal: 'kcal نشط',
      energyBalance: 'متوسط الطاقة اليومية',
      eaten: 'م consumed',
      burn: 'إنفاق تقديري',
      surplus: 'فائض',
      deficit: 'عجz',
      rules: 'قواعد التغذية',
      macroRx: 'وصفة الماكرو',
      coachNotes: 'ملاحظات مرشد التغذية (اليوم)',
      improved: 'تحسن',
      worsened: 'ارتفاع',
      ldl: 'LDL',
      hdl: 'HDL',
      tc: 'كولسترول كلي',
      tg: 'TG',
      date: 'التاريخ',
      noLipidTrend: 'ارفع تقريرين+ مع lipids لرؤية الاتجاه.',
      singleLipid: 'آخر lipids',
      problemFoodsHeader: 'أطعمة مرتبطة بارتفاعات بعد الوجبات',
      foodRiseTag: 'ارتفاع بعد وجبة',
      noCgm: 'لا CGM في هذه الفترة.',
      cgmCoverage: 'أيام مع CGM',
      impressionClosing: 'التوصيات — للأخصائي/الفريق الطبي.',
    };
  }
  return {
    documentTitle: 'Nutrition Assessment — Internal Visit Report',
    headerType: 'Document type: Internal nutrition assessment (self-tracked wellness data)',
    period: 'Reporting period',
    days: 'days',
    exported: 'Generated',
    disclaimer:
      'Source: HEALTHINGS.AI — food diary, CGM, Withings body composition/activity, uploaded lab PDFs. For professional collaboration only; not a medical diagnosis.',
    s1: '1. Client & reporting period',
    s2: '2. Anthropometrics & body composition',
    s3: '3. Laboratory review',
    s4: '4. Dietary intake assessment',
    s5: '5. Glycemic response (CGM) & meal linkage',
    s6: '6. Energy balance & physical activity',
    s7: '7. Current nutrition plan',
    s8: '8. Clinical impression',
    impressionTitle: 'Clinical impression',
    appendixTitle: 'Appendix B — Detailed daily data',
    appendixIntro: 'Full laboratory tables + day-by-day log (CGM, meals, workouts).',
    noData: 'No data in this period',
    male: 'Male',
    female: 'Female',
    other: 'Other',
    age: 'Age',
    sex: 'Sex',
    height: 'Height',
    weight: 'Weight',
    bmi: 'BMI',
    measured: 'Measured',
    lipidTrend: 'Blood lipid trend',
    lipidTrendNarrative: 'LDL trend',
    latestLabs: 'Most recent laboratory draw',
    kidney: 'Renal markers',
    glycemic: 'Glycemic markers',
    high: 'high',
    low: 'low',
    avgIntake: 'Average intake on logged days',
    daysLogged: 'Days with meal logs',
    of: 'of',
    targets: 'Targets',
    carbOver: 'Days above carb target',
    proteinUnder: 'Days below 90% protein target',
    sparseLogging: 'Partial meal logging — averages may under-represent true intake.',
    workouts: 'Workouts',
    sessions: 'sessions',
    activeKcal: 'active kcal',
    energyBalance: 'Average daily energy (logged days)',
    eaten: 'Intake',
    burn: 'Estimated expenditure',
    surplus: 'surplus',
    deficit: 'deficit',
    rules: 'Documented nutrition rules',
    macroRx: 'Macro prescription',
    coachNotes: 'Nutrition coach notes (today)',
    improved: 'improvement',
    worsened: 'increase',
    ldl: 'LDL',
    hdl: 'HDL',
    tc: 'Total chol',
    tg: 'TG',
    date: 'Date',
    noLipidTrend: 'Import at least 2 lab draws with lipid panels to show a trend.',
    singleLipid: 'Latest lipid panel',
    problemFoodsHeader: 'Foods repeatedly linked to post-meal glucose rises',
    foodRiseTag: 'post-meal rise',
    noCgm: 'No CGM data in the reporting window.',
    cgmCoverage: 'Days with CGM',
    impressionClosing: 'Recommendations and prescription changes remain with the treating clinician/nutritionist.',
  };
}

function formatWeightNarrative(
  lang: UserLanguage | null | undefined,
  wEnd: { start: number; end: number },
  weightDelta: number,
  dayCount: number,
  massUnit: UnitsPrefs['mass'],
): string {
  const start = kgToDisplay(wEnd.start, massUnit).toFixed(1);
  const end = kgToDisplay(wEnd.end, massUnit).toFixed(1);
  const d = `${weightDelta >= 0 ? '+' : ''}${kgToDisplay(weightDelta, massUnit).toFixed(1)}`;
  const unit = massUnitLabel(massUnit);
  if (lang?.code === 'he') {
    return `משקל ${start} → ${end} ${unit} (Δ ${d}) במהלך ${dayCount} ימי הדיווח.`;
  }
  return `Weight ${start} → ${end} ${unit} (Δ ${d} ${unit}) during the ${dayCount}-day reporting period.`;
}

function formatBodyCompNarrative(
  lang: UserLanguage | null | undefined,
  anchor: {
    start: { dayKey: string; fatMassKg: number; muscleMassKg: number };
    end: { dayKey: string; fatMassKg: number; muscleMassKg: number };
  },
  massUnit: UnitsPrefs['mass'],
): string {
  const fatD = anchor.end.fatMassKg - anchor.start.fatMassKg;
  const muscleD = anchor.end.muscleMassKg - anchor.start.muscleMassKg;
  const fd = `${fatD >= 0 ? '+' : ''}${kgToDisplay(fatD, massUnit).toFixed(1)}`;
  const md = `${muscleD >= 0 ? '+' : ''}${kgToDisplay(muscleD, massUnit).toFixed(1)}`;
  const unit = massUnitLabel(massUnit);
  const f0 = kgToDisplay(anchor.start.fatMassKg, massUnit).toFixed(1);
  const f1 = kgToDisplay(anchor.end.fatMassKg, massUnit).toFixed(1);
  const m0 = kgToDisplay(anchor.start.muscleMassKg, massUnit).toFixed(1);
  const m1 = kgToDisplay(anchor.end.muscleMassKg, massUnit).toFixed(1);
  if (lang?.code === 'he') {
    return `הרכב גוף (Withings BIA ${anchor.start.dayKey}→${anchor.end.dayKey}): שומן ${f0}→${f1} ${unit} (Δ ${fd}), שריר ${m0}→${m1} ${unit} (Δ ${md}).`;
  }
  return `Body composition (Withings BIA ${anchor.start.dayKey}→${anchor.end.dayKey}): fat mass ${f0}→${f1} ${unit} (Δ ${fd}), muscle ${m0}→${m1} ${unit} (Δ ${md}).`;
}

function parsePeriodGlucoseAvgs(dayNightLines: string[]): { dayAvg: number | null; nightAvg: number | null } {
  const line = dayNightLines.find((l) => l.includes('Period avg:'));
  if (!line) return { dayAvg: null, nightAvg: null };
  const dayM = line.match(/day (\d+) mg\/dL/);
  const nightM = line.match(/night (\d+) mg\/dL/);
  return {
    dayAvg: dayM ? parseInt(dayM[1], 10) : null,
    nightAvg: nightM ? parseInt(nightM[1], 10) : null,
  };
}

function formatCgmNarrative(
  lang: UserLanguage | null | undefined,
  L: ReturnType<typeof clinicalLabels>,
  dayKeys: string[],
  dayNightLines: string[],
  glucoseSection: string | null,
  glucoseUnit: UnitsPrefs['glucose'] = 'mgdl',
): string {
  const { dayAvg, nightAvg } = parsePeriodGlucoseAvgs(dayNightLines);
  const daysMatch = glucoseSection?.match(/Days with CGM: (\d+)\/(\d+)/);
  const cgmDays = daysMatch ? `${daysMatch[1]}/${daysMatch[2]}` : null;
  const dayDisp = dayAvg != null ? formatGlucose(dayAvg, glucoseUnit) : null;
  const nightDisp = nightAvg != null ? formatGlucose(nightAvg, glucoseUnit) : null;
  if (lang?.code === 'he') {
    const parts: string[] = [];
    if (dayDisp != null && nightDisp != null) {
      parts.push(`ממוצע CGM בתקופה: יום ${dayDisp}, לילה ${nightDisp}.`);
    }
    if (cgmDays) parts.push(`${L.cgmCoverage}: ${cgmDays} ימים.`);
    if (dayAvg != null && dayAvg <= 100 && (nightAvg == null || nightAvg <= 100)) {
      parts.push('במגמה כללית — שליטה טובה בטווחי יום/לילה.');
    } else if (dayAvg != null && dayAvg > 140) {
      parts.push('ממוצעי יום גבוהים — לבחון תזמון ארוחות ומנות.');
    } else {
      parts.push('יש תנודתיות — ל correlate עם רשימת המזונות למטה.');
    }
    return parts.join(' ');
  }
  const parts: string[] = [];
  if (dayDisp != null && nightDisp != null) {
    parts.push(`Period CGM average: daytime ${dayDisp}, nighttime ${nightDisp}.`);
  }
  if (cgmDays) parts.push(`${L.cgmCoverage}: ${cgmDays} days.`);
  if (dayAvg != null && dayAvg <= 100 && (nightAvg == null || nightAvg <= 100)) {
    parts.push('Overall pattern appears well controlled on trusted days.');
  } else if (dayAvg != null && dayAvg > 140) {
    parts.push('Elevated daytime averages — review meal timing and portions.');
  } else {
    parts.push('Some variability — correlate with foods listed below.');
  }
  return parts.join(' ');
}

function genderLabel(g: Gender | null, L: ReturnType<typeof clinicalLabels>): string {
  if (g === 'male') return L.male;
  if (g === 'female') return L.female;
  if (g === 'other') return L.other;
  return '—';
}

function fmtVal(v: number | null, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}

function buildLipidTrendTable(points: LipidTrendPoint[], L: ReturnType<typeof clinicalLabels>): ClinicalTable {
  return {
    headers: [L.date, L.ldl, L.hdl, L.tc, L.tg],
    rows: points.map((p) => [
      p.dateKey,
      fmtVal(p.ldl),
      fmtVal(p.hdl),
      fmtVal(p.totalCholesterol),
      fmtVal(p.triglycerides),
    ]),
  };
}

function lipidTrendNarrative(points: LipidTrendPoint[], L: ReturnType<typeof clinicalLabels>): string[] {
  const paragraphs: string[] = [];
  const withLdl = points.filter((p) => p.ldl != null);
  if (withLdl.length >= 2) {
    const first = withLdl[0].ldl!;
    const last = withLdl[withLdl.length - 1].ldl!;
    const delta = last - first;
    paragraphs.push(
      `${L.lipidTrendNarrative}: ${first} → ${last} mg/dL (${deltaPhrase(delta, 'mg/dL', L)}) across ${withLdl.length} draws (${withLdl[0].dateKey} → ${withLdl[withLdl.length - 1].dateKey}).`,
    );
  }
  return paragraphs;
}

function latestLabBullets(latest: LabReport | null, L: ReturnType<typeof clinicalLabels>): string[] {
  if (!latest) return [];
  const lipids = scanLipidLabStatus(latest);
  const glycemic = scanGlycemicLabStatus(latest);
  const bullets: string[] = [];
  const flag = (f: string | undefined, v: string) =>
    f === 'high' || f === 'low' ? `${v} (${f === 'high' ? L.high : L.low})` : v;

  if (lipids.ldl) bullets.push(`${L.ldl}: ${flag(lipids.ldl.flag, `${lipids.ldl.value} ${lipids.ldl.unit}`)}`);
  if (lipids.hdl) bullets.push(`${L.hdl}: ${flag(lipids.hdl.flag, `${lipids.hdl.value} ${lipids.hdl.unit}`)}`);
  if (lipids.totalCholesterol) {
    bullets.push(`${L.tc}: ${flag(lipids.totalCholesterol.flag, `${lipids.totalCholesterol.value} ${lipids.totalCholesterol.unit}`)}`);
  }
  if (lipids.triglycerides) {
    bullets.push(`${L.tg}: ${flag(lipids.triglycerides.flag, `${lipids.triglycerides.value} ${lipids.triglycerides.unit}`)}`);
  }
  if (glycemic.hba1c) bullets.push(`HbA1c: ${flag(glycemic.hba1c.flag, `${glycemic.hba1c.value} ${glycemic.hba1c.unit}`)}`);
  if (glycemic.glucose) bullets.push(`Glucose: ${flag(glycemic.glucose.flag, `${glycemic.glucose.value} ${glycemic.glucose.unit}`)}`);
  return bullets;
}

function mealFoodNames(entry: FoodEntry): string[] {
  return entry.items.map((i) => i.name).filter(Boolean);
}

function glucoseOnDayKey(glucose: TimePoint[], dayKey: string): TimePoint[] {
  return glucose.filter((p) => localDayKeyFromMs(new Date(p.timestamp).getTime()) === dayKey);
}

function collectProblemFoods(
  dayKeys: string[],
  macrosByDay: Map<string, Awaited<ReturnType<typeof getDailyMacros>>>,
  glucose: TimePoint[],
  L: ReturnType<typeof clinicalLabels>,
): string[] {
  const byFood = new Map<string, number>();
  for (const dk of dayKeys) {
    const meals = macrosByDay.get(dk)?.entries ?? [];
    const dayG = glucoseOnDayKey(glucose, dk);
    if (meals.length === 0 || dayG.length === 0) continue;
    const results = analyzeMealGlucoseResponse(meals, dayG);
    const sortedMeals = [...meals].sort((a, b) => a.timestamp - b.timestamp);
    for (const r of results) {
      if (r.assessment !== 'sharp_spike' && r.assessment !== 'moderate_rise') continue;
      const meal = sortedMeals[r.mealIndex - 1];
      if (!meal) continue;
      for (const name of mealFoodNames(meal)) {
        byFood.set(name, (byFood.get(name) ?? 0) + 1);
      }
    }
  }
  return [...byFood.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => `${name} (${count}× ${L.foodRiseTag})`);
}

function buildImpression(input: {
  lang?: UserLanguage | null;
  L: ReturnType<typeof clinicalLabels>;
  dayKeys: string[];
  mealDays: number;
  lipidPoints: LipidTrendPoint[];
  weightDelta: number | null;
  dayAvg: number | null;
  nightAvg: number | null;
  avgCarbs: number | null;
  workoutSessions: number;
  massUnit?: UnitsPrefs['mass'];
}): string[] {
  const parts: string[] = [];
  const { lang, L, dayKeys, mealDays, lipidPoints, weightDelta, dayAvg, nightAvg, avgCarbs, workoutSessions } = input;
  const he = lang?.code === 'he';
  const massUnit = input.massUnit ?? 'kg';
  const unit = massUnitLabel(massUnit);

  if (weightDelta != null) {
    const absDisp = kgToDisplay(Math.abs(weightDelta), massUnit).toFixed(1);
    const deltaDisp = kgToDisplay(weightDelta, massUnit).toFixed(1);
    if (weightDelta <= -0.3) {
      parts.push(
        he
          ? `מגמת משקל יורדת: ${absDisp} ${unit} ב-${dayKeys.length} ימים.`
          : `Body weight trended down ${absDisp} ${unit} over ${dayKeys.length} days.`,
      );
    } else if (weightDelta >= 0.3) {
      parts.push(
        he
          ? `מגמת משקל עולה: ${deltaDisp} ${unit} ב-${dayKeys.length} ימים.`
          : `Body weight trended up ${deltaDisp} ${unit} over ${dayKeys.length} days.`,
      );
    } else {
      parts.push(
        he ? `משקל יציב יחסית ב-${dayKeys.length} ימי הדיווח.` : `Body weight remained stable over ${dayKeys.length} days.`,
      );
    }
  }

  if (lipidPoints.length >= 2) {
    const withLdl = lipidPoints.filter((p) => p.ldl != null);
    if (withLdl.length >= 2) {
      const d = withLdl[withLdl.length - 1].ldl! - withLdl[0].ldl!;
      if (d <= -5) {
        parts.push(
          he
            ? `LDL במעבדה השתפר ב-${Math.abs(Math.round(d))} mg/dL בין הדיגום הראשון לאחרון.`
            : `Laboratory LDL improved by ${Math.abs(Math.round(d))} mg/dL between first and latest draw.`,
        );
      } else if (d >= 5) {
        parts.push(
          he
            ? `LDL עלה ב-${Math.round(d)} mg/dL — לבחון איכות שומן והיצמדות לתוכנית.`
            : `Laboratory LDL increased by ${Math.round(d)} mg/dL — dietary fat quality and adherence warrant review.`,
        );
      }
    }
  }

  if (mealDays > 0 && avgCarbs != null) {
    parts.push(
      he
        ? `intake מדווח: ממוצע ~${Math.round(avgCarbs)} גרם פחמימות/יום ב-${mealDays}/${dayKeys.length} ימים עם דיווח.`
        : `Self-reported intake averaged ~${Math.round(avgCarbs)} g carbohydrate/day on ${mealDays}/${dayKeys.length} logged days.`,
    );
  } else {
    parts.push(he ? 'דיווח ארוחות חלקי — הערכת intake מוגבלת.' : 'Meal logging was sparse; intake analysis is limited.');
  }

  if (dayAvg != null) {
    if (dayAvg <= 100 && (nightAvg == null || nightAvg <= 100)) {
      parts.push(he ? 'CGM: ממוצעי יום/לילה בטווח טוב.' : 'CGM pattern appears well controlled on trusted days.');
    } else if (dayAvg > 140) {
      parts.push(he ? 'CGM: ממוצעי יום גבוהים — לבחון ארוחות ומנות.' : 'CGM shows elevated daytime readings — review meals and timing.');
    } else {
      parts.push(
        he ? 'CGM: תנודתיות — לשקול קשר עם מזונות שברשימה.' : 'CGM shows variability — correlate with identified trigger foods.',
      );
    }
  }

  if (workoutSessions > 0) {
    parts.push(
      he
        ? `${workoutSessions} אימונים מתועדים — תומך בהוצאה האנרגטית.`
        : `${workoutSessions} structured workout session(s) recorded — activity supports energy expenditure goals.`,
    );
  }

  if (parts.length === 0) {
    return [
      he
        ? 'אין מספיק נתונים לסיכום — לעודד דיווח ארוחות ו-CGM.'
        : 'Insufficient tracked data in this window to form a clinical impression — encourage consistent food and CGM logging.',
    ];
  }

  parts.push(L.impressionClosing);
  return parts;
}

export async function buildClinicalVisitNote(input: BuildClinicalNoteInput): Promise<VisitReportClinicalNote> {
  const L = clinicalLabels(input.lang);
  const units = input.unitsPrefs ?? DEFAULT_UNITS_PREFS;
  const dayKeys = windowDayKeys(input.dayCount);
  const periodFrom = dayKeys[0];
  const periodTo = dayKeys[dayKeys.length - 1];

  const macrosList = await Promise.all(dayKeys.map((dk) => getDailyMacros(dk)));
  const macrosByDay = new Map(dayKeys.map((dk, i) => [dk, macrosList[i]]));

  const windowSet = new Set(dayKeys);
  const inWindowBody = input.bodyTrendDays.filter((d) => windowSet.has(d.dayKey));
  const weightVals = inWindowBody.map((d) => d.weightKg);
  const wEnd = periodEndpointsKg(weightVals);
  const weightDelta = periodDeltaKg(weightVals);
  const anchor = resolveCompositionPeriodAnchor(input.compositionSessions, dayKeys);

  const lipidPoints = buildLipidTrendPoints(input.labs);
  const latestReport = input.labs[0] ?? (await getLatestLabReport());
  const kidneyStatus = latestReport ? await getLatestKidneyLabStatus() : null;

  let mealDays = 0;
  let totalKcal = 0;
  let totalP = 0;
  let totalC = 0;
  let totalF = 0;
  let totalFi = 0;
  let daysOverCarb = 0;
  let daysUnderProtein = 0;
  for (const dk of dayKeys) {
    const m = macrosByDay.get(dk);
    if (!m || m.entries.length === 0) continue;
    mealDays++;
    totalKcal += m.kcal;
    totalP += m.protein_g;
    totalC += m.carb_g;
    totalF += m.fat_g;
    totalFi += m.fiber_g ?? 0;
    if (input.macroTarget && m.carb_g > input.macroTarget.carb_g) daysOverCarb++;
    if (input.macroTarget && m.protein_g < input.macroTarget.protein_g * 0.9) daysUnderProtein++;
  }

  const burnByDay = computeBurnKcalByDay(input.bodyTrendDays, input.caloriePoints, input.workouts);
  let energyDays = 0;
  let totalEaten = 0;
  let totalBurn = 0;
  for (const dk of dayKeys) {
    const m = macrosByDay.get(dk);
    const burn = burnByDay.get(dk);
    if (!m || m.entries.length === 0 || burn == null) continue;
    energyDays++;
    totalEaten += m.kcal;
    totalBurn += burn;
  }

  const workoutsInWindow = input.workouts.filter((w) => windowSet.has(localDayKeyFromMs(w.startMs)));
  const workoutKcal = workoutsInWindow.reduce((a, w) => a + w.kcal, 0);

  const glucoseSection = buildPeriodMealGlucoseSection(
    dayKeys,
    macrosByDay,
    input.glucose,
    input.cgmSessionStarts,
    input.cgmStatSummary,
  );
  const dayNightLines = buildPeriodDayNightGlucoseLines(dayKeys, input.glucose);
  const problemFoods = collectProblemFoods(dayKeys, macrosByDay, input.glucose, L);
  const { dayAvg, nightAvg } = parsePeriodGlucoseAvgs(dayNightLines);

  const bmiVal = bmi(input.profile.weightKg, input.profile.heightCm);

  const headerLines = [
    L.headerType,
    `${L.period}: ${input.dayCount} ${L.days} (${periodFrom} → ${periodTo})`,
    `${L.exported}: ${fmtDate(input.exportedAt, input.lang)}`,
    L.disclaimer,
  ];

  const s1Bullets: string[] = [];
  if (input.profile.age != null) s1Bullets.push(`${L.age}: ${input.profile.age}`);
  s1Bullets.push(`${L.sex}: ${genderLabel(input.gender, L)}`);
  if (input.profile.heightCm != null) s1Bullets.push(`${L.height}: ${formatHeight(input.profile.heightCm, units.height)}`);
  if (input.profile.weightKg != null) {
    let w = `${L.weight}: ${formatMass(input.profile.weightKg, units.mass)}`;
    if (input.profile.weightMeasuredAt) w += ` (${L.measured} ${fmtDate(input.profile.weightMeasuredAt, input.lang)})`;
    s1Bullets.push(w);
  }
  if (bmiVal != null) s1Bullets.push(`${L.bmi}: ${bmiVal.toFixed(1)} kg/m²`);

  const s2Paragraphs: string[] = [];
  const s2Bullets: string[] = [];
  if (wEnd && weightDelta != null) {
    s2Paragraphs.push(formatWeightNarrative(input.lang, wEnd, weightDelta, dayKeys.length, units.mass));
  } else if (input.profile.weightTrendLine) {
    s2Bullets.push(input.profile.weightTrendLine);
  }
  if (anchor) {
    s2Paragraphs.push(formatBodyCompNarrative(input.lang, anchor, units.mass));
  }

  const s3Paragraphs: string[] = [];
  const s3Bullets = latestLabBullets(latestReport, L);
  if (kidneyStatus?.hasHighMarker) {
    const renal: string[] = [];
    if (kidneyStatus.creatinine) renal.push(`creatinine ${kidneyStatus.creatinine.value} ${kidneyStatus.creatinine.unit}`);
    if (kidneyStatus.urea) renal.push(`urea ${kidneyStatus.urea.value} ${kidneyStatus.urea.unit}`);
    s3Bullets.push(`${L.kidney}: ${renal.join('; ')} (${L.high})`);
  }
  let s3Table: ClinicalTable | undefined;
  if (lipidPoints.length >= 2) {
    s3Table = buildLipidTrendTable(lipidPoints, L);
    s3Paragraphs.push(...lipidTrendNarrative(lipidPoints, L));
  } else if (lipidPoints.length === 1) {
    s3Paragraphs.push(L.noLipidTrend);
  }

  const s4Paragraphs: string[] = [];
  const s4Bullets: string[] = [];
  if (mealDays === 0) {
    s4Paragraphs.push(L.noData);
  } else {
    s4Paragraphs.push(
      `${L.avgIntake}: ${formatEnergy(totalKcal / mealDays, units.energy)} · P ${Math.round(totalP / mealDays)}g · C ${Math.round(totalC / mealDays)}g · F ${Math.round(totalF / mealDays)}g · Fi ${Math.round(totalFi / mealDays)}g (${L.daysLogged} ${mealDays} ${L.of} ${dayKeys.length}).`,
    );
    if (input.macroTarget) {
      s4Bullets.push(
        `${L.targets} (${input.macroTarget.diet_label}): ${formatEnergy(input.macroTarget.kcal, units.energy)} · P${input.macroTarget.protein_g}g C${input.macroTarget.carb_g}g F${input.macroTarget.fat_g}g`,
      );
      s4Bullets.push(`${L.carbOver}: ${daysOverCarb}`);
      s4Bullets.push(`${L.proteinUnder}: ${daysUnderProtein}`);
    }
    if (mealDays < dayKeys.length * 0.6) s4Bullets.push(L.sparseLogging);
  }

  const s5Paragraphs: string[] = [];
  const s5Bullets: string[] = [];
  if (glucoseSection) {
    s5Paragraphs.push(formatCgmNarrative(input.lang, L, dayKeys, dayNightLines, glucoseSection, units.glucose));
    if (problemFoods.length > 0) {
      s5Bullets.push(L.problemFoodsHeader + ':');
      s5Bullets.push(...problemFoods.map((f) => `• ${f}`));
    }
  } else {
    s5Paragraphs.push(L.noCgm);
  }

  const s6Paragraphs: string[] = [];
  const s6Bullets: string[] = [];
  if (energyDays > 0) {
    const avgEaten = Math.round(totalEaten / energyDays);
    const avgBurn = Math.round(totalBurn / energyDays);
    const bal = avgEaten - avgBurn;
    s6Paragraphs.push(
      `${L.energyBalance}: ${L.eaten} ~${formatEnergy(avgEaten, units.energy)} · ${L.burn} ~${formatEnergy(avgBurn, units.energy)} · ${bal >= 0 ? L.surplus : L.deficit} ${formatEnergy(Math.abs(bal), units.energy)}/day (${energyDays} days).`,
    );
  }
  if (workoutsInWindow.length > 0) {
    s6Bullets.push(
      `${L.workouts}: ${workoutsInWindow.length} ${L.sessions}, ${Math.round(workoutKcal)} ${L.activeKcal}.`,
    );
  }

  const s7Bullets: string[] = [];
  if (input.userRules?.summary) s7Bullets.push(`${L.rules}: ${input.userRules.summary}`);
  if (input.userRules?.constraints?.length) s7Bullets.push(...input.userRules.constraints.map((c) => `• ${c}`));
  if (input.macroTarget) {
    s7Bullets.push(
      `${L.macroRx}: ${input.macroTarget.diet_label} — ${formatEnergy(input.macroTarget.kcal, units.energy)}, P${input.macroTarget.protein_g}/C${input.macroTarget.carb_g}/F${input.macroTarget.fat_g}g`,
    );
  }
  if (input.includeCoach && input.coachMsg) {
    const note =
      input.coachMsg.mentorLines?.nutritionist?.trim() ||
      input.coachMsg.summary?.trim() ||
      input.coachMsg.text.trim();
    if (note) s7Bullets.push(`${L.coachNotes}: ${note.slice(0, 400)}${note.length > 400 ? '…' : ''}`);
  }

  const impressionParagraphs = buildImpression({
    lang: input.lang,
    L,
    dayKeys,
    mealDays,
    lipidPoints,
    weightDelta,
    dayAvg,
    nightAvg,
    avgCarbs: mealDays > 0 ? totalC / mealDays : null,
    workoutSessions: workoutsInWindow.length,
    massUnit: units.mass,
  });

  return {
    documentTitle: L.documentTitle,
    headerLines,
    sections: [
      { id: 'client', title: L.s1, paragraphs: [], bullets: s1Bullets },
      { id: 'anthro', title: L.s2, paragraphs: s2Paragraphs, bullets: s2Bullets },
      {
        id: 'labs',
        title: L.s3,
        paragraphs: s3Paragraphs,
        bullets: s3Bullets.length > 0 ? [`${L.latestLabs}:`, ...s3Bullets] : undefined,
        table: s3Table,
      },
      { id: 'diet', title: L.s4, paragraphs: s4Paragraphs, bullets: s4Bullets },
      { id: 'cgm', title: L.s5, paragraphs: s5Paragraphs, bullets: s5Bullets },
      { id: 'activity', title: L.s6, paragraphs: s6Paragraphs, bullets: s6Bullets },
      { id: 'plan', title: L.s7, paragraphs: [], bullets: s7Bullets.length > 0 ? s7Bullets : undefined },
    ],
    impressionTitle: L.impressionTitle,
    impressionParagraphs,
    appendixTitle: L.appendixTitle,
    appendixIntro: L.appendixIntro,
  };
}
