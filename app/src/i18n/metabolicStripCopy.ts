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
  /** Primary dashboard sync button */
  refreshMyData: string;
  /** Pull-refresh / header sync — in flight */
  refreshUpdating: string;
  /** Pull-refresh finished OK (brief flash) */
  refreshDone: string;
  /** Pull-refresh failed (brief flash) */
  refreshFailed: string;
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
  /** Glucose chart history depth (orthogonal to zoom chips). */
  historyDepthLabel: string;
  historyDepth7Days: string;
  historyDepthFull: string;
  a11yHistory7Days: string;
  a11yHistoryFull: string;
  /** Zoom chip labels (natural language; ids stay 1H…16D in code). */
  viewport1H: string;
  viewport3H: string;
  viewport6H: string;
  viewport12H: string;
  viewport24H: string;
  viewport2D: string;
  viewport4D: string;
  viewport8D: string;
  viewport16D: string;
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
  refreshMyData: 'Refresh my data',
  refreshUpdating: 'Updating…',
  refreshDone: 'Updated',
  refreshFailed: 'Couldn’t update — try again',
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
  historyDepthLabel: 'History',
  historyDepth7Days: '7 days',
  historyDepthFull: 'Full',
  a11yHistory7Days: 'History, last 7 days',
  a11yHistoryFull: 'History, full stored readings',
  viewport1H: '1 hour',
  viewport3H: '3 hours',
  viewport6H: '6 hours',
  viewport12H: '12 hours',
  viewport24H: '1 day',
  viewport2D: '2 days',
  viewport4D: '4 days',
  viewport8D: '8 days',
  viewport16D: '16 days',
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
  refreshMyData: 'רענון הנתונים שלי',
  refreshUpdating: 'מעדכן…',
  refreshDone: 'עודכן',
  refreshFailed: 'לא התעדכן — נסו שוב',
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
  historyDepthLabel: 'היסטוריה',
  historyDepth7Days: '7 ימים',
  historyDepthFull: 'מלא',
  a11yHistory7Days: 'היסטוריה, 7 הימים האחרונים',
  a11yHistoryFull: 'היסטוריה מלאה, כל הקריאות השמורות',
  viewport1H: 'שעה',
  viewport3H: '3 שעות',
  viewport6H: '6 שעות',
  viewport12H: '12 שעות',
  viewport24H: 'יום',
  viewport2D: 'יומיים',
  viewport4D: '4 ימים',
  viewport8D: '8 ימים',
  viewport16D: '16 ימים',
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
  refreshMyData: 'Actualizar mis datos',
  refreshUpdating: 'Actualizando…',
  refreshDone: 'Actualizado',
  refreshFailed: 'No se pudo actualizar — inténtalo de nuevo',
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
  historyDepthLabel: 'Historial',
  historyDepth7Days: '7 días',
  historyDepthFull: 'Completo',
  a11yHistory7Days: 'Historial, últimos 7 días',
  a11yHistoryFull: 'Historial completo, todas las lecturas guardadas',
  viewport1H: '1 hora',
  viewport3H: '3 horas',
  viewport6H: '6 horas',
  viewport12H: '12 horas',
  viewport24H: '1 día',
  viewport2D: '2 días',
  viewport4D: '4 días',
  viewport8D: '8 días',
  viewport16D: '16 días',
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
  refreshMyData: 'Actualiser mes données',
  refreshUpdating: 'Mise à jour…',
  refreshDone: 'À jour',
  refreshFailed: 'Échec de la mise à jour — réessayez',
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
  historyDepthLabel: 'Historique',
  historyDepth7Days: '7 jours',
  historyDepthFull: 'Complet',
  a11yHistory7Days: 'Historique, 7 derniers jours',
  a11yHistoryFull: 'Historique complète, toutes les lectures enregistrées',
  viewport1H: '1 heure',
  viewport3H: '3 heures',
  viewport6H: '6 heures',
  viewport12H: '12 heures',
  viewport24H: '1 jour',
  viewport2D: '2 jours',
  viewport4D: '4 jours',
  viewport8D: '8 jours',
  viewport16D: '16 jours',
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
  refreshMyData: 'Meine Daten aktualisieren',
  refreshUpdating: 'Aktualisiere…',
  refreshDone: 'Aktualisiert',
  refreshFailed: 'Aktualisierung fehlgeschlagen — erneut versuchen',
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
  historyDepthLabel: 'Verlauf',
  historyDepth7Days: '7 Tage',
  historyDepthFull: 'Voll',
  a11yHistory7Days: 'Verlauf, letzte 7 Tage',
  a11yHistoryFull: 'Vollständiger Verlauf, alle gespeicherten Messungen',
  viewport1H: '1 Stunde',
  viewport3H: '3 Stunden',
  viewport6H: '6 Stunden',
  viewport12H: '12 Stunden',
  viewport24H: '1 Tag',
  viewport2D: '2 Tage',
  viewport4D: '4 Tage',
  viewport8D: '8 Tage',
  viewport16D: '16 Tage',
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
  refreshMyData: 'تحديث بياناتي',
  refreshUpdating: 'جاري التحديث…',
  refreshDone: 'تم التحديث',
  refreshFailed: 'تعذّر التحديث — حاولوا مرة أخرى',
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
  historyDepthLabel: 'السجل',
  historyDepth7Days: '7 أيام',
  historyDepthFull: 'كامل',
  a11yHistory7Days: 'السجل، آخر 7 أيام',
  a11yHistoryFull: 'السجل الكامل، كل القراءات المحفوظة',
  viewport1H: 'ساعة',
  viewport3H: '3 ساعات',
  viewport6H: '6 ساعات',
  viewport12H: '12 ساعة',
  viewport24H: 'يوم',
  viewport2D: 'يومان',
  viewport4D: '4 أيام',
  viewport8D: '8 أيام',
  viewport16D: '16 يوماً',
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
  refreshMyData: 'Обновить мои данные',
  refreshUpdating: 'Обновление…',
  refreshDone: 'Обновлено',
  refreshFailed: 'Не удалось обновить — попробуйте снова',
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
  historyDepthLabel: 'История',
  historyDepth7Days: '7 дней',
  historyDepthFull: 'Полная',
  a11yHistory7Days: 'История, последние 7 дней',
  a11yHistoryFull: 'Полная история, все сохранённые показания',
  viewport1H: '1 час',
  viewport3H: '3 часа',
  viewport6H: '6 часов',
  viewport12H: '12 часов',
  viewport24H: '1 день',
  viewport2D: '2 дня',
  viewport4D: '4 дня',
  viewport8D: '8 дней',
  viewport16D: '16 дней',
  minsAgo: (n) => `${n}м назад`,
  hoursAgo: (n) => `${n}ч назад`,
  daysAgo: (n) => `${n}д назад`,
};

const PT: MetabolicStripCopy = {
  glucoseTitle: 'GLICOSE',
  activityTitle: 'ATIVIDADE',
  trendTitle: 'TENDÊNCIA E ENERGIA',
  profileSettingsTitle: 'PERFIL E CONFIGURAÇÕES',
  noReading: 'Sem leitura',
  noCgm: 'sem CGM',
  justNow: 'agora',
  loading: 'Carregando…',
  tapToOpenCharts: 'Toque para abrir gráficos',
  tapToOpen: 'Toque para abrir',
  refreshMyData: 'Atualizar meus dados',
  refreshUpdating: 'Atualizando…',
  refreshDone: 'Atualizado',
  refreshFailed: 'Não foi possível atualizar — tente de novo',
  genderMale: 'Masculino',
  genderFemale: 'Feminino',
  genderOther: 'Outro',
  ageYears: (n) => `${n} a`,
  mentorsCount: (n) => `${n} mentor${n === 1 ? '' : 'es'}`,
  a11yExpandGlucose: 'Expandir gráfico de glicose',
  a11yCollapseGlucose: 'Recolher gráfico de glicose',
  a11yExpandActivity: 'Expandir gráfico de atividade',
  a11yCollapseActivity: 'Recolher gráfico de atividade',
  a11yExpandTrend: 'Expandir tendência e energia',
  a11yCollapseTrend: 'Recolher tendência e energia',
  a11yExpandProfileSettings: 'Expandir perfil e configurações',
  a11yCollapseProfileSettings: 'Recolher perfil e configurações',
  legendGlucose: 'Glicose',
  legendHeartRate: 'Frequência cardíaca',
  legendSteps: 'Passos',
  legendWorkout: 'Treino',
  historyDepthLabel: 'Histórico',
  historyDepth7Days: '7 dias',
  historyDepthFull: 'Completo',
  a11yHistory7Days: 'Histórico, últimos 7 dias',
  a11yHistoryFull: 'Histórico completo, todas as leituras salvas',
  viewport1H: '1 hora',
  viewport3H: '3 horas',
  viewport6H: '6 horas',
  viewport12H: '12 horas',
  viewport24H: '1 dia',
  viewport2D: '2 dias',
  viewport4D: '4 dias',
  viewport8D: '8 dias',
  viewport16D: '16 dias',
  minsAgo: (n) => `há ${n}m`,
  hoursAgo: (n) => `há ${n}h`,
  daysAgo: (n) => `há ${n}d`,
};

const IT: MetabolicStripCopy = {
  glucoseTitle: 'GLUCOSIO',
  activityTitle: 'ATTIVITÀ',
  trendTitle: 'TENDENZA ED ENERGIA',
  profileSettingsTitle: 'PROFILO E IMPOSTAZIONI',
  noReading: 'Nessuna lettura',
  noCgm: 'senza CGM',
  justNow: 'adesso',
  loading: 'Caricamento…',
  tapToOpenCharts: 'Tocca per aprire i grafici',
  tapToOpen: 'Tocca per aprire',
  refreshMyData: 'Aggiorna i miei dati',
  refreshUpdating: 'Aggiornamento…',
  refreshDone: 'Aggiornato',
  refreshFailed: 'Aggiornamento non riuscito — riprova',
  genderMale: 'Uomo',
  genderFemale: 'Donna',
  genderOther: 'Altro',
  ageYears: (n) => `${n} a`,
  mentorsCount: (n) => `${n} mentor`,
  a11yExpandGlucose: 'Espandi grafico glucosio',
  a11yCollapseGlucose: 'Comprimi grafico glucosio',
  a11yExpandActivity: 'Espandi grafico attività',
  a11yCollapseActivity: 'Comprimi grafico attività',
  a11yExpandTrend: 'Espandi tendenza ed energia',
  a11yCollapseTrend: 'Comprimi tendenza ed energia',
  a11yExpandProfileSettings: 'Espandi profilo e impostazioni',
  a11yCollapseProfileSettings: 'Comprimi profilo e impostazioni',
  legendGlucose: 'Glucosio',
  legendHeartRate: 'Frequenza cardiaca',
  legendSteps: 'Passi',
  legendWorkout: 'Allenamento',
  historyDepthLabel: 'Cronologia',
  historyDepth7Days: '7 giorni',
  historyDepthFull: 'Completa',
  a11yHistory7Days: 'Cronologia, ultimi 7 giorni',
  a11yHistoryFull: 'Cronologia completa, tutte le letture salvate',
  viewport1H: '1 ora',
  viewport3H: '3 ore',
  viewport6H: '6 ore',
  viewport12H: '12 ore',
  viewport24H: '1 giorno',
  viewport2D: '2 giorni',
  viewport4D: '4 giorni',
  viewport8D: '8 giorni',
  viewport16D: '16 giorni',
  minsAgo: (n) => `${n}m fa`,
  hoursAgo: (n) => `${n}h fa`,
  daysAgo: (n) => `${n}g fa`,
};

const TR: MetabolicStripCopy = {
  glucoseTitle: 'GLİKOZ',
  activityTitle: 'AKTİVİTE',
  trendTitle: 'EĞİLİM VE ENERJİ',
  profileSettingsTitle: 'PROFİL VE AYARLAR',
  noReading: 'Okuma yok',
  noCgm: 'CGM yok',
  justNow: 'az önce',
  loading: 'Yükleniyor…',
  tapToOpenCharts: 'Grafikleri açmak için dokunun',
  tapToOpen: 'Açmak için dokunun',
  refreshMyData: 'Verilerimi yenile',
  refreshUpdating: 'Güncelleniyor…',
  refreshDone: 'Güncellendi',
  refreshFailed: 'Güncellenemedi — tekrar deneyin',
  genderMale: 'Erkek',
  genderFemale: 'Kadın',
  genderOther: 'Diğer',
  ageYears: (n) => `${n} y`,
  mentorsCount: (n) => `${n} mentor`,
  a11yExpandGlucose: 'Glukoz grafiğini genişlet',
  a11yCollapseGlucose: 'Glukoz grafiğini daralt',
  a11yExpandActivity: 'Aktivite grafiğini genişlet',
  a11yCollapseActivity: 'Aktivite grafiğini daralt',
  a11yExpandTrend: 'Eğilim ve enerjiyi genişlet',
  a11yCollapseTrend: 'Eğilim ve enerjiyi daralt',
  a11yExpandProfileSettings: 'Profil ve ayarları genişlet',
  a11yCollapseProfileSettings: 'Profil ve ayarları daralt',
  legendGlucose: 'Glukoz',
  legendHeartRate: 'Nabız',
  legendSteps: 'Adım',
  legendWorkout: 'Antrenman',
  historyDepthLabel: 'Geçmiş',
  historyDepth7Days: '7 gün',
  historyDepthFull: 'Tam',
  a11yHistory7Days: 'Geçmiş, son 7 gün',
  a11yHistoryFull: 'Tam geçmiş, kayıtlı tüm okumalar',
  viewport1H: '1 saat',
  viewport3H: '3 saat',
  viewport6H: '6 saat',
  viewport12H: '12 saat',
  viewport24H: '1 gün',
  viewport2D: '2 gün',
  viewport4D: '4 gün',
  viewport8D: '8 gün',
  viewport16D: '16 gün',
  minsAgo: (n) => `${n}dk önce`,
  hoursAgo: (n) => `${n}s önce`,
  daysAgo: (n) => `${n}g önce`,
};

export type ViewportPresetId =
  | '1H'
  | '3H'
  | '6H'
  | '12H'
  | '24H'
  | '2D'
  | '4D'
  | '8D'
  | '16D';

export function getMetabolicStripCopy(langCode?: string | null): MetabolicStripCopy {
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

/** Localized zoom-chip label for a preset id. */
export function viewportPresetLabel(copy: MetabolicStripCopy, id: ViewportPresetId): string {
  switch (id) {
    case '1H':
      return copy.viewport1H;
    case '3H':
      return copy.viewport3H;
    case '6H':
      return copy.viewport6H;
    case '12H':
      return copy.viewport12H;
    case '24H':
      return copy.viewport24H;
    case '2D':
      return copy.viewport2D;
    case '4D':
      return copy.viewport4D;
    case '8D':
      return copy.viewport8D;
    case '16D':
      return copy.viewport16D;
    default:
      return id;
  }
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
