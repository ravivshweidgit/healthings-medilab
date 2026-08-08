/**
 * Post-setup “what’s next” card + calm empty recovery (prompt106 Phase A).
 * appLocale — brand / CGM / Withings stay English (glossary).
 * CTA labels aligned with foodLogUiCopy / activityLogUiCopy / yourSetupCopy where possible.
 */

export type WhatsNextCopy = {
  title: string;
  lead: string;
  logMeal: string;
  addActivity: string;
  later: string;
  /** Body scan strip when no scale / manual weight yet. */
  emptyBodyScan: string;
  openYourSetup: string;
  /** Glucose chart when no prepared series. */
  emptyTrends: string;
  refreshHint: string;
  /** Trend card expanded but no chart days yet. */
  emptyTrendAnalysis: string;
  /** Withings / device sync failure — calm next step. */
  syncFailedHint: string;
  /** Soft day-2+ retention when What’s next already dismissed. */
  mealNudgeLead: string;
  mealNudgeCta: string;
  mealNudgeLater: string;
  /** One-shot after Quick Start Finish (not Log first meal). */
  setupCompleteTitle: string;
  setupCompleteLead: string;
  setupCompleteCta: string;
};

const EN: WhatsNextCopy = {
  title: 'What’s next',
  lead: 'Log one meal or one activity. That single habit unlocks the rest of the app.',
  logMeal: 'Log meal',
  addActivity: 'Add activity',
  later: 'Not now',
  emptyBodyScan:
    'No body scan yet. Link a scale in Your setup, or enter your weight in Profile.',
  openYourSetup: 'Your setup',
  emptyTrends:
    'Charts fill in after sync. Pull to refresh, or check your glucose sensor under Your setup.',
  refreshHint: 'Pull down to refresh',
  emptyTrendAnalysis:
    'Trend charts need a few weigh-ins or a scale sync. Log weight in Profile, or pull down to refresh.',
  syncFailedHint:
    'Couldn’t reach your devices. Pull down to refresh, or open Your setup to re-link.',
  mealNudgeLead: 'No meal logged today yet — a quick log keeps targets honest.',
  mealNudgeCta: 'Log meal',
  mealNudgeLater: 'Not now',
  setupCompleteTitle: 'You’re set',
  setupCompleteLead: 'Setup’s done. Log one meal or one activity whenever you’re ready.',
  setupCompleteCta: 'Got it',
};

/**
 * Hebrew — avoid Latin brand/acronyms mid-sentence (RTL/LTR flicker).
 * Prefer plain Hebrew; glossary English stays on dedicated labels elsewhere.
 */
const HE: WhatsNextCopy = {
  title: 'הצעד הבא',
  lead: 'תעדו ארוחה אחת או פעילות אחת — ומשם הכול מתחבר.',
  logMeal: 'רישום ארוחה',
  addActivity: 'הוסף פעילות',
  later: 'לא עכשיו',
  emptyBodyScan: 'אין עדיין מדידת גוף — חבר משקל בהגדרה, או הזן משקל בפרופיל.',
  openYourSetup: 'ההגדרה שלך',
  emptyTrends: 'הגרפים מתמלאים אחרי סנכרון — רענן, או בדוק את חיישן הסוכר בהגדרה.',
  refreshHint: 'משוך למטה לרענון',
  emptyTrendAnalysis: 'למגמות צריך כמה שקילות או סנכרון משקל — הזינו בפרופיל, או רעננו.',
  syncFailedHint: 'לא הצלחנו להגיע למכשירים — רענן, או פתחו את ההגדרה לחיבור מחדש.',
  mealNudgeLead: 'עדיין אין ארוחה היום — רישום קצר שומר על היעדים אמיתיים.',
  mealNudgeCta: 'רישום ארוחה',
  mealNudgeLater: 'לא עכשיו',
  setupCompleteTitle: 'הכול מוכן',
  setupCompleteLead: 'ההגדרה מאחוריכם. ארוחה אחת או פעילות אחת — כשנוח לכם.',
  setupCompleteCta: 'הבנתי',
};

const ES: WhatsNextCopy = {
  title: 'Qué sigue',
  lead: 'Registra una comida o una actividad. Ese hábito es el que pone la app en marcha.',
  logMeal: 'Registrar comida',
  addActivity: 'Añadir actividad',
  later: 'Ahora no',
  emptyBodyScan:
    'Aún no hay medición corporal. Vincula una báscula en Tu configuración, o introduce el peso en Perfil.',
  openYourSetup: 'Tu configuración',
  emptyTrends:
    'Los gráficos se completan tras sincronizar. Desliza para actualizar, o revisa el sensor de glucosa en Tu configuración.',
  refreshHint: 'Desliza hacia abajo para actualizar',
  emptyTrendAnalysis:
    'Las tendencias necesitan algunas pesadas o sincronizar la báscula. Registre el peso en Perfil, o deslice para actualizar.',
  syncFailedHint:
    'No se pudo conectar con sus dispositivos. Deslice para actualizar, o abra Tu configuración para volver a vincular.',
  mealNudgeLead: 'Aún no hay comida hoy — un registro rápido mantiene los objetivos honestos.',
  mealNudgeCta: 'Registrar comida',
  mealNudgeLater: 'Ahora no',
  setupCompleteTitle: 'Listo',
  setupCompleteLead: 'La configuración terminó. Registre una comida o una actividad cuando quiera.',
  setupCompleteCta: 'Entendido',
};

const FR: WhatsNextCopy = {
  title: 'Et ensuite',
  lead: 'Enregistrez un repas ou une activité. C’est l’habitude qui met l’application en mouvement.',
  logMeal: 'Enregistrer un repas',
  addActivity: 'Ajouter une activité',
  later: 'Pas maintenant',
  emptyBodyScan:
    'Pas encore de mesure corporelle. Reliez une balance dans Votre configuration, ou saisissez le poids dans Profil.',
  openYourSetup: 'Votre configuration',
  emptyTrends:
    'Les graphiques se remplissent après synchronisation. Tirez pour actualiser, ou vérifiez le capteur de glucose dans Votre configuration.',
  refreshHint: 'Tirez vers le bas pour actualiser',
  emptyTrendAnalysis:
    'Les tendances demandent quelques pesées ou une sync balance. Notez le poids dans Profil, ou tirez pour actualiser.',
  syncFailedHint:
    'Impossible de joindre vos appareils. Tirez pour actualiser, ou ouvrez Votre configuration pour relier.',
  mealNudgeLead: 'Pas encore de repas aujourd’hui — un enregistrement rapide garde les cibles honnêtes.',
  mealNudgeCta: 'Enregistrer un repas',
  mealNudgeLater: 'Pas maintenant',
  setupCompleteTitle: 'C’est prêt',
  setupCompleteLead: 'Configuration terminée. Enregistrez un repas ou une activité quand vous voulez.',
  setupCompleteCta: 'Compris',
};

const DE: WhatsNextCopy = {
  title: 'Als Nächstes',
  lead: 'Erfassen Sie eine Mahlzeit oder eine Aktivität. Diese eine Gewohnheit bringt die App in Gang.',
  logMeal: 'Mahlzeit erfassen',
  addActivity: 'Aktivität hinzufügen',
  later: 'Nicht jetzt',
  emptyBodyScan:
    'Noch keine Körpermessung. Verknüpfen Sie eine Waage unter Dein Setup, oder tragen Sie das Gewicht im Profil ein.',
  openYourSetup: 'Dein Setup',
  emptyTrends:
    'Diagramme füllen sich nach der Synchronisierung. Zum Aktualisieren ziehen, oder den Glukosesensor unter Dein Setup prüfen.',
  refreshHint: 'Zum Aktualisieren nach unten ziehen',
  emptyTrendAnalysis:
    'Trends brauchen ein paar Wiegevorgänge oder Waagen-Sync. Gewicht im Profil eintragen oder zum Aktualisieren ziehen.',
  syncFailedHint:
    'Geräte nicht erreichbar. Zum Aktualisieren ziehen oder Dein Setup öffnen, um neu zu verknüpfen.',
  mealNudgeLead: 'Heute noch keine Mahlzeit — ein kurzer Eintrag hält die Ziele ehrlich.',
  mealNudgeCta: 'Mahlzeit erfassen',
  mealNudgeLater: 'Nicht jetzt',
  setupCompleteTitle: 'Fertig eingerichtet',
  setupCompleteLead: 'Setup ist durch. Erfassen Sie eine Mahlzeit oder Aktivität, wenn es passt.',
  setupCompleteCta: 'Verstanden',
};

/** Arabic — same RTL rule: no Latin brand/acronyms mid-sentence. */
const AR: WhatsNextCopy = {
  title: 'الخطوة التالية',
  lead: 'سجّل وجبة أو نشاطًا — ومن هناك يتضح الباقي.',
  logMeal: 'تسجيل وجبة',
  addActivity: 'إضافة نشاط',
  later: 'ليس الآن',
  emptyBodyScan: 'لا قياس للجسم بعد — اربط الميزان من الإعداد، أو أدخل الوزن في الملف.',
  openYourSetup: 'إعدادك',
  emptyTrends: 'الرسوم تُملأ بعد المزامنة — حدّث، أو راجع مستشعر السكر في الإعداد.',
  refreshHint: 'اسحب للأسفل للتحديث',
  emptyTrendAnalysis: 'الاتجاهات تحتاج عدة وزنات أو مزامنة ميزان — سجّل الوزن في الملف أو حدّث.',
  syncFailedHint: 'تعذّر الوصول للأجهزة — حدّث، أو افتح الإعداد للربط من جديد.',
  mealNudgeLead: 'لا وجبة اليوم بعد — تسجيل سريع يبقي الأهداف صادقة.',
  mealNudgeCta: 'تسجيل وجبة',
  mealNudgeLater: 'ليس الآن',
  setupCompleteTitle: 'أصبحت جاهزًا',
  setupCompleteLead: 'انتهى الإعداد. سجّل وجبة أو نشاطًا متى شئت.',
  setupCompleteCta: 'حسنًا',
};

const RU: WhatsNextCopy = {
  title: 'Что дальше',
  lead: 'Запишите один приём пищи или одну активность. Эта привычка запускает остальное приложение.',
  logMeal: 'Записать приём',
  addActivity: 'Добавить активность',
  later: 'Не сейчас',
  emptyBodyScan:
    'Пока нет замера тела. Подключите весы в «Ваша настройка» или введите вес в профиле.',
  openYourSetup: 'Ваша настройка',
  emptyTrends:
    'Графики заполняются после синхронизации. Потяните для обновления или проверьте датчик глюкозы в настройке.',
  refreshHint: 'Потяните вниз для обновления',
  emptyTrendAnalysis:
    'Для трендов нужно несколько взвешиваний или синхронизация весов. Внесите вес в профиле или обновите.',
  syncFailedHint:
    'Не удалось связаться с устройствами. Потяните для обновления или откройте настройку для повторной привязки.',
  mealNudgeLead: 'Сегодня ещё нет приёма пищи — быстрая запись держит цели честными.',
  mealNudgeCta: 'Записать приём',
  mealNudgeLater: 'Не сейчас',
  setupCompleteTitle: 'Готово',
  setupCompleteLead: 'Настройка завершена. Запишите приём или активность, когда удобно.',
  setupCompleteCta: 'Понятно',
};

const PT: WhatsNextCopy = {
  title: 'O que segue',
  lead: 'Registe uma refeição ou uma atividade. Esse hábito é o que põe a app a funcionar.',
  logMeal: 'Registrar refeição',
  addActivity: 'Adicionar atividade',
  later: 'Agora não',
  emptyBodyScan:
    'Ainda sem medição corporal. Ligue uma balança em Sua configuração, ou introduza o peso no Perfil.',
  openYourSetup: 'Sua configuração',
  emptyTrends:
    'Os gráficos preenchem-se após a sincronização. Puxe para atualizar, ou verifique o sensor de glucose na configuração.',
  refreshHint: 'Puxe para baixo para atualizar',
  emptyTrendAnalysis:
    'As tendências precisam de algumas pesagens ou sync da balança. Registe o peso no Perfil, ou puxe para atualizar.',
  syncFailedHint:
    'Não foi possível contactar os dispositivos. Puxe para atualizar, ou abra a configuração para voltar a ligar.',
  mealNudgeLead: 'Ainda sem refeição hoje — um registo rápido mantém as metas honestas.',
  mealNudgeCta: 'Registrar refeição',
  mealNudgeLater: 'Agora não',
  setupCompleteTitle: 'Pronto',
  setupCompleteLead: 'Configuração concluída. Registe uma refeição ou atividade quando quiser.',
  setupCompleteCta: 'Entendi',
};

const IT: WhatsNextCopy = {
  title: 'Il passo successivo',
  lead: 'Registra un pasto o un’attività. Quell’abitudine è ciò che mette in moto l’app.',
  logMeal: 'Registra pasto',
  addActivity: 'Aggiungi attività',
  later: 'Non ora',
  emptyBodyScan:
    'Ancora nessuna misurazione corporea. Collega una bilancia in La tua configurazione, o inserisci il peso nel Profilo.',
  openYourSetup: 'La tua configurazione',
  emptyTrends:
    'I grafici si riempiono dopo la sincronizzazione. Scorri per aggiornare, o controlla il sensore di glucosio nella configurazione.',
  refreshHint: 'Scorri verso il basso per aggiornare',
  emptyTrendAnalysis:
    'Le tendenze richiedono alcune pesate o sync della bilancia. Registra il peso nel Profilo, o scorri per aggiornare.',
  syncFailedHint:
    'Impossibile raggiungere i dispositivi. Scorri per aggiornare, o apri la configurazione per ricollegare.',
  mealNudgeLead: 'Nessun pasto oggi — una registrazione rapida tiene gli obiettivi onesti.',
  mealNudgeCta: 'Registra pasto',
  mealNudgeLater: 'Non ora',
  setupCompleteTitle: 'Sei a posto',
  setupCompleteLead: 'Setup completato. Registra un pasto o un’attività quando vuoi.',
  setupCompleteCta: 'Ho capito',
};

const TR: WhatsNextCopy = {
  title: 'Sıradaki adım',
  lead: 'Bir öğün veya bir aktivite kaydedin. Uygulamayı çalıştıran alışkanlık budur.',
  logMeal: 'Öğün kaydet',
  addActivity: 'Aktivite ekle',
  later: 'Şimdi değil',
  emptyBodyScan:
    'Henüz vücut ölçümü yok. Kurulumunuzda tartı bağlayın veya Profilde kilo girin.',
  openYourSetup: 'Kurulumunuz',
  emptyTrends:
    'Grafikler senkron sonrası dolar. Yenilemek için çekin veya Kurulumda şeker sensörünü kontrol edin.',
  refreshHint: 'Yenilemek için aşağı çekin',
  emptyTrendAnalysis:
    'Eğilimler için birkaç tartım veya tartı senkronu gerekir. Profilde kilo girin veya yenilemek için çekin.',
  syncFailedHint:
    'Cihazlara ulaşılamadı. Yenilemek için çekin veya yeniden bağlamak için Kurulumu açın.',
  mealNudgeLead: 'Bugün henüz öğün yok — hızlı kayıt hedefleri dürüst tutar.',
  mealNudgeCta: 'Öğün kaydet',
  mealNudgeLater: 'Şimdi değil',
  setupCompleteTitle: 'Hazırsınız',
  setupCompleteLead: 'Kurulum bitti. İstediğiniz zaman bir öğün veya aktivite kaydedin.',
  setupCompleteCta: 'Anladım',
};

const BY_CODE: Record<string, WhatsNextCopy> = {
  en: EN,
  he: HE,
  es: ES,
  fr: FR,
  de: DE,
  ar: AR,
  ru: RU,
  pt: PT,
  it: IT,
  tr: TR,
};

export function getWhatsNextCopy(langCode?: string | null): WhatsNextCopy {
  const c = (langCode || 'en').toLowerCase().slice(0, 2);
  return BY_CODE[c] ?? EN;
}

/** Persisted dismiss — one flag, not a parallel data store. */
export const WHATS_NEXT_DISMISSED_KEY = 'healthings:whatsNextDismissed_v1';

/** Day key (YYYY-MM-DD) when user dismissed the soft meal nudge. */
export const MEAL_NUDGE_DISMISSED_DAY_KEY = 'healthings:mealNudgeDismissedDay_v1';
