/**
 * Dashboard metabolic / trend strip chrome — coach language (prompt87).
 * Brand names (Withings, Health Connect, Apple Health, CGM) stay English.
 */

export type MetabolicStripCopy = {
  glucoseTitle: string;
  activityTitle: string;
  trendTitle: string;
  profileSettingsTitle: string;
  noReading: string;
  noCgm: string;
  justNow: string;
  loading: string;
  tapToOpenCharts: string;
  tapToOpen: string;
  genderMale: string;
  genderFemale: string;
  genderOther: string;
  /** Compact age, e.g. "42 y". */
  ageYears: (n: number) => string;
  mentorsCount: (n: number) => string;
  a11yExpandGlucose: string;
  a11yCollapseGlucose: string;
  a11yExpandActivity: string;
  a11yCollapseActivity: string;
  a11yExpandTrend: string;
  a11yCollapseTrend: string;
  a11yExpandProfileSettings: string;
  a11yCollapseProfileSettings: string;
  /** Chart legend labels (sentence case). */
  legendGlucose: string;
  legendHeartRate: string;
  legendSteps: string;
  legendWorkout: string;
  /** Compact relative time: minutes / hours / days. */
  minsAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
};

const EN: MetabolicStripCopy = {
  glucoseTitle: 'GLUCOSE',
  activityTitle: 'ACTIVITY',
  trendTitle: 'TREND & ENERGY',
  profileSettingsTitle: 'PROFILE & SETTINGS',
  noReading: 'No reading',
  noCgm: 'no CGM',
  justNow: 'just now',
  loading: 'Loading…',
  tapToOpenCharts: 'Tap to open charts',
  tapToOpen: 'Tap to open',
  genderMale: 'Male',
  genderFemale: 'Female',
  genderOther: 'Other',
  ageYears: (n) => `${n} y`,
  mentorsCount: (n) => `${n} mentor${n === 1 ? '' : 's'}`,
  a11yExpandGlucose: 'Expand glucose chart',
  a11yCollapseGlucose: 'Collapse glucose chart',
  a11yExpandActivity: 'Expand activity chart',
  a11yCollapseActivity: 'Collapse activity chart',
  a11yExpandTrend: 'Expand trend analysis and energy',
  a11yCollapseTrend: 'Collapse trend analysis and energy',
  a11yExpandProfileSettings: 'Expand profile and settings',
  a11yCollapseProfileSettings: 'Collapse profile and settings',
  legendGlucose: 'Glucose',
  legendHeartRate: 'Heart rate',
  legendSteps: 'Steps',
  legendWorkout: 'Workout',
  minsAgo: (n) => `${n}m ago`,
  hoursAgo: (n) => `${n}h ago`,
  daysAgo: (n) => `${n}d ago`,
};

const HE: MetabolicStripCopy = {
  glucoseTitle: 'גלוקוז',
  activityTitle: 'פעילות',
  trendTitle: 'מגמה ואנרגיה',
  profileSettingsTitle: 'פרופיל והגדרות',
  noReading: 'אין קריאה',
  noCgm: 'ללא CGM',
  justNow: 'עכשיו',
  loading: 'טוען…',
  tapToOpenCharts: 'הקש לפתיחת הגרפים',
  tapToOpen: 'הקש לפתיחה',
  genderMale: 'זכר',
  genderFemale: 'נקבה',
  genderOther: 'אחר',
  ageYears: (n) => `${n} ש׳`,
  mentorsCount: (n) => (n === 1 ? 'מנטור אחד' : `${n} מנטורים`),
  a11yExpandGlucose: 'הרחב גרף גלוקוז',
  a11yCollapseGlucose: 'כווץ גרף גלוקוז',
  a11yExpandActivity: 'הרחב גרף פעילות',
  a11yCollapseActivity: 'כווץ גרף פעילות',
  a11yExpandTrend: 'הרחב מגמה ואנרגיה',
  a11yCollapseTrend: 'כווץ מגמה ואנרגיה',
  a11yExpandProfileSettings: 'הרחב פרופיל והגדרות',
  a11yCollapseProfileSettings: 'כווץ פרופיל והגדרות',
  legendGlucose: 'גלוקוז',
  legendHeartRate: 'דופק',
  legendSteps: 'צעדים',
  legendWorkout: 'אימון',
  minsAgo: (n) => `לפני ${n}ד׳`,
  hoursAgo: (n) => `לפני ${n}ש׳`,
  daysAgo: (n) => `לפני ${n}י׳`,
};

const ES: MetabolicStripCopy = {
  glucoseTitle: 'GLUCOSA',
  activityTitle: 'ACTIVIDAD',
  trendTitle: 'TENDENCIA Y ENERGÍA',
  profileSettingsTitle: 'PERFIL Y AJUSTES',
  noReading: 'Sin lectura',
  noCgm: 'sin CGM',
  justNow: 'ahora mismo',
  loading: 'Cargando…',
  tapToOpenCharts: 'Toca para abrir gráficos',
  tapToOpen: 'Toca para abrir',
  genderMale: 'Hombre',
  genderFemale: 'Mujer',
  genderOther: 'Otro',
  ageYears: (n) => `${n} a`,
  mentorsCount: (n) => `${n} mentor${n === 1 ? '' : 'es'}`,
  a11yExpandGlucose: 'Expandir gráfico de glucosa',
  a11yCollapseGlucose: 'Contraer gráfico de glucosa',
  a11yExpandActivity: 'Expandir gráfico de actividad',
  a11yCollapseActivity: 'Contraer gráfico de actividad',
  a11yExpandTrend: 'Expandir tendencia y energía',
  a11yCollapseTrend: 'Contraer tendencia y energía',
  a11yExpandProfileSettings: 'Expandir perfil y ajustes',
  a11yCollapseProfileSettings: 'Contraer perfil y ajustes',
  legendGlucose: 'Glucosa',
  legendHeartRate: 'Frecuencia cardíaca',
  legendSteps: 'Pasos',
  legendWorkout: 'Entrenamiento',
  minsAgo: (n) => `hace ${n}m`,
  hoursAgo: (n) => `hace ${n}h`,
  daysAgo: (n) => `hace ${n}d`,
};

const FR: MetabolicStripCopy = {
  glucoseTitle: 'GLYCÉMIE',
  activityTitle: 'ACTIVITÉ',
  trendTitle: 'TENDANCE ET ÉNERGIE',
  profileSettingsTitle: 'PROFIL ET RÉGLAGES',
  noReading: 'Pas de lecture',
  noCgm: 'sans CGM',
  justNow: "à l'instant",
  loading: 'Chargement…',
  tapToOpenCharts: 'Appuyer pour ouvrir les graphiques',
  tapToOpen: 'Appuyer pour ouvrir',
  genderMale: 'Homme',
  genderFemale: 'Femme',
  genderOther: 'Autre',
  ageYears: (n) => `${n} ans`,
  mentorsCount: (n) => `${n} mentor${n === 1 ? '' : 's'}`,
  a11yExpandGlucose: 'Développer le graphique glycémie',
  a11yCollapseGlucose: 'Réduire le graphique glycémie',
  a11yExpandActivity: 'Développer le graphique activité',
  a11yCollapseActivity: 'Réduire le graphique activité',
  a11yExpandTrend: 'Développer tendance et énergie',
  a11yCollapseTrend: 'Réduire tendance et énergie',
  a11yExpandProfileSettings: 'Développer profil et réglages',
  a11yCollapseProfileSettings: 'Réduire profil et réglages',
  legendGlucose: 'Glycémie',
  legendHeartRate: 'Fréquence cardiaque',
  legendSteps: 'Pas',
  legendWorkout: 'Séance',
  minsAgo: (n) => `il y a ${n}m`,
  hoursAgo: (n) => `il y a ${n}h`,
  daysAgo: (n) => `il y a ${n}j`,
};

const DE: MetabolicStripCopy = {
  glucoseTitle: 'GLUKOSE',
  activityTitle: 'AKTIVITÄT',
  trendTitle: 'TREND & ENERGIE',
  profileSettingsTitle: 'PROFIL & EINSTELLUNGEN',
  noReading: 'Keine Messung',
  noCgm: 'ohne CGM',
  justNow: 'gerade eben',
  loading: 'Laden…',
  tapToOpenCharts: 'Tippen für Diagramme',
  tapToOpen: 'Tippen zum Öffnen',
  genderMale: 'Männlich',
  genderFemale: 'Weiblich',
  genderOther: 'Divers',
  ageYears: (n) => `${n} J`,
  mentorsCount: (n) => `${n} Mentor${n === 1 ? '' : 'en'}`,
  a11yExpandGlucose: 'Glukose-Diagramm erweitern',
  a11yCollapseGlucose: 'Glukose-Diagramm einklappen',
  a11yExpandActivity: 'Aktivitäts-Diagramm erweitern',
  a11yCollapseActivity: 'Aktivitäts-Diagramm einklappen',
  a11yExpandTrend: 'Trend und Energie erweitern',
  a11yCollapseTrend: 'Trend und Energie einklappen',
  a11yExpandProfileSettings: 'Profil und Einstellungen erweitern',
  a11yCollapseProfileSettings: 'Profil und Einstellungen einklappen',
  legendGlucose: 'Glukose',
  legendHeartRate: 'Herzfrequenz',
  legendSteps: 'Schritte',
  legendWorkout: 'Training',
  minsAgo: (n) => `vor ${n}m`,
  hoursAgo: (n) => `vor ${n}h`,
  daysAgo: (n) => `vor ${n}T`,
};

const AR: MetabolicStripCopy = {
  glucoseTitle: 'الجلوكوز',
  activityTitle: 'النشاط',
  trendTitle: 'الاتجاه والطاقة',
  profileSettingsTitle: 'الملف والإعدادات',
  noReading: 'لا قراءة',
  noCgm: 'بدون CGM',
  justNow: 'الآن',
  loading: 'جارٍ التحميل…',
  tapToOpenCharts: 'اضغط لفتح الرسوم',
  tapToOpen: 'اضغط للفتح',
  genderMale: 'ذكر',
  genderFemale: 'أنثى',
  genderOther: 'آخر',
  ageYears: (n) => `${n} س`,
  mentorsCount: (n) => (n === 1 ? 'مرشد واحد' : `${n} مرشدين`),
  a11yExpandGlucose: 'توسيع مخطط الجلوكوز',
  a11yCollapseGlucose: 'طي مخطط الجلوكوز',
  a11yExpandActivity: 'توسيع مخطط النشاط',
  a11yCollapseActivity: 'طي مخطط النشاط',
  a11yExpandTrend: 'توسيع الاتجاه والطاقة',
  a11yCollapseTrend: 'طي الاتجاه والطاقة',
  a11yExpandProfileSettings: 'توسيع الملف والإعدادات',
  a11yCollapseProfileSettings: 'طي الملف والإعدادات',
  legendGlucose: 'الجلوكوز',
  legendHeartRate: 'معدل القلب',
  legendSteps: 'خطوات',
  legendWorkout: 'تمرين',
  minsAgo: (n) => `منذ ${n}د`,
  hoursAgo: (n) => `منذ ${n}س`,
  daysAgo: (n) => `منذ ${n}ي`,
};

const RU: MetabolicStripCopy = {
  glucoseTitle: 'ГЛЮКОЗА',
  activityTitle: 'АКТИВНОСТЬ',
  trendTitle: 'ТРЕНД И ЭНЕРГИЯ',
  profileSettingsTitle: 'ПРОФИЛЬ И НАСТРОЙКИ',
  noReading: 'Нет данных',
  noCgm: 'без CGM',
  justNow: 'только что',
  loading: 'Загрузка…',
  tapToOpenCharts: 'Нажмите, чтобы открыть графики',
  tapToOpen: 'Нажмите, чтобы открыть',
  genderMale: 'Мужской',
  genderFemale: 'Женский',
  genderOther: 'Другой',
  ageYears: (n) => `${n} л`,
  mentorsCount: (n) => (n === 1 ? '1 ментор' : `${n} менторов`),
  a11yExpandGlucose: 'Развернуть график глюкозы',
  a11yCollapseGlucose: 'Свернуть график глюкозы',
  a11yExpandActivity: 'Развернуть график активности',
  a11yCollapseActivity: 'Свернуть график активности',
  a11yExpandTrend: 'Развернуть тренд и энергию',
  a11yCollapseTrend: 'Свернуть тренд и энергию',
  a11yExpandProfileSettings: 'Развернуть профиль и настройки',
  a11yCollapseProfileSettings: 'Свернуть профиль и настройки',
  legendGlucose: 'Глюкоза',
  legendHeartRate: 'Пульс',
  legendSteps: 'Шаги',
  legendWorkout: 'Тренировка',
  minsAgo: (n) => `${n}м назад`,
  hoursAgo: (n) => `${n}ч назад`,
  daysAgo: (n) => `${n}д назад`,
};

export function getMetabolicStripCopy(langCode?: string | null): MetabolicStripCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  if (c === 'he') return HE;
  if (c === 'es') return ES;
  if (c === 'fr') return FR;
  if (c === 'de') return DE;
  if (c === 'ar') return AR;
  if (c === 'ru') return RU;
  return EN;
}

/** Compact relative ago for collapsed glucose subtitle. */
export function formatRelativeAgoLocalized(
  iso: string,
  langCode?: string | null,
): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const t = getMetabolicStripCopy(langCode);
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minsAgo(mins);
  const hours = Math.round(mins / 60);
  if (hours < 36) return t.hoursAgo(hours);
  const days = Math.round(hours / 24);
  return t.daysAgo(days);
}
