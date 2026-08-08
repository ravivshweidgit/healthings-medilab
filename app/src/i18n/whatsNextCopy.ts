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
