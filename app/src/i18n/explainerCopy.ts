/**
 * Explainer Watch list + CTA chrome (prompt107). Titles speak like a person.
 */

import type { ExplainerId } from './explainerUrls';
import { helpLocale, type HelpLocale } from './helpUrls';

export type ExplainerCopy = {
  sectionTitle: string;
  watchCta: string;
  titles: Record<ExplainerId, string>;
};

const EN: ExplainerCopy = {
  sectionTitle: 'Watch explainers',
  watchCta: 'Watch',
  titles: {
    'what-is-healthings': 'What is Healthings',
    'phone-health': 'Phone health — who writes, who reads',
    'cgm-pipeline': 'Live CGM pipeline',
    gear: 'Connect scale, watch, CGM',
    'scale-choice': 'Withings scale — Yes or No',
    'scale-trends': 'Scale, body composition, energy',
    'meal-entry': 'How to log a meal',
    'meal-grams': 'Adjust meal grams',
    'activity-youtube': 'Activity from YouTube',
    'closed-loop': 'The closed loop',
  },
};

const HE: ExplainerCopy = {
  sectionTitle: 'סרטוני הסבר',
  watchCta: 'צפו',
  titles: {
    'what-is-healthings': 'מה זה Healthings',
    'phone-health': 'בריאות מהטלפון — מי כותב, מי קורא',
    'cgm-pipeline': 'שרשרת CGM בזמן אמת',
    gear: 'חיבור משקל, שעון ו־CGM',
    'scale-choice': 'משקל Withings — כן או לא',
    'scale-trends': 'משקל, הרכב גוף ואנרגיה',
    'meal-entry': 'איך מתעדים ארוחה',
    'meal-grams': 'כוונון גרמים בארוחה',
    'activity-youtube': 'פעילות מ־YouTube',
    'closed-loop': 'המעגל הסגור',
  },
};

const DE: ExplainerCopy = {
  sectionTitle: 'Erklärfilme',
  watchCta: 'Ansehen',
  titles: {
    'what-is-healthings': 'Was ist Healthings',
    'phone-health': 'Telefon-Gesundheit — wer schreibt, wer liest',
    'cgm-pipeline': 'Live-CGM-Pipeline',
    gear: 'Waage, Uhr, CGM verbinden',
    'scale-choice': 'Withings-Waage — Ja oder Nein',
    'scale-trends': 'Waage, Körperzusammensetzung, Energie',
    'meal-entry': 'Mahlzeit protokollieren',
    'meal-grams': 'Gramm einstellen',
    'activity-youtube': 'Aktivität von YouTube',
    'closed-loop': 'Der geschlossene Kreislauf',
  },
};

const FR: ExplainerCopy = {
  sectionTitle: 'Vidéos explicatives',
  watchCta: 'Regarder',
  titles: {
    'what-is-healthings': 'Qu’est-ce que Healthings',
    'phone-health': 'Santé du téléphone — qui écrit, qui lit',
    'cgm-pipeline': 'Pipeline CGM en direct',
    gear: 'Connecter balance, montre, CGM',
    'scale-choice': 'Balance Withings — Oui ou Non',
    'scale-trends': 'Balance, composition corporelle, énergie',
    'meal-entry': 'Comment enregistrer un repas',
    'meal-grams': 'Ajuster les grammes',
    'activity-youtube': 'Activité depuis YouTube',
    'closed-loop': 'La boucle fermée',
  },
};

const ES: ExplainerCopy = {
  sectionTitle: 'Videos explicativos',
  watchCta: 'Ver',
  titles: {
    'what-is-healthings': 'Qué es Healthings',
    'phone-health': 'Salud del teléfono — quién escribe, quién lee',
    'cgm-pipeline': 'Pipeline CGM en vivo',
    gear: 'Conectar báscula, reloj, CGM',
    'scale-choice': 'Báscula Withings — Sí o No',
    'scale-trends': 'Báscula, composición corporal, energía',
    'meal-entry': 'Cómo registrar una comida',
    'meal-grams': 'Ajustar gramos',
    'activity-youtube': 'Actividad desde YouTube',
    'closed-loop': 'El ciclo cerrado',
  },
};

const AR: ExplainerCopy = {
  sectionTitle: 'فيديوهات شرح',
  watchCta: 'شاهدوا',
  titles: {
    'what-is-healthings': 'ما هو Healthings',
    'phone-health': 'صحة الهاتف — من يكتب ومن يقرأ',
    'cgm-pipeline': 'مسار CGM المباشر',
    gear: 'ربط الميزان والساعة وCGM',
    'scale-choice': 'ميزان Withings — نعم أو لا',
    'scale-trends': 'الميزان وتركيب الجسم والطاقة',
    'meal-entry': 'كيف تسجّلون وجبة',
    'meal-grams': 'ضبط الغرامات',
    'activity-youtube': 'نشاط من YouTube',
    'closed-loop': 'الحلقة المغلقة',
  },
};

const RU: ExplainerCopy = {
  sectionTitle: 'Видео-объяснения',
  watchCta: 'Смотреть',
  titles: {
    'what-is-healthings': 'Что такое Healthings',
    'phone-health': 'Здоровье телефона — кто пишет, кто читает',
    'cgm-pipeline': 'Живой CGM-пайплайн',
    gear: 'Подключить весы, часы, CGM',
    'scale-choice': 'Весы Withings — да или нет',
    'scale-trends': 'Весы, состав тела, энергия',
    'meal-entry': 'Как записать приём пищи',
    'meal-grams': 'Настроить граммы',
    'activity-youtube': 'Активность с YouTube',
    'closed-loop': 'Замкнутый цикл',
  },
};

const PT: ExplainerCopy = {
  sectionTitle: 'Vídeos explicativos',
  watchCta: 'Assistir',
  titles: {
    'what-is-healthings': 'O que é o Healthings',
    'phone-health': 'Saúde do telefone — quem escreve, quem lê',
    'cgm-pipeline': 'Pipeline CGM ao vivo',
    gear: 'Ligar balança, relógio, CGM',
    'scale-choice': 'Balança Withings — Sim ou Não',
    'scale-trends': 'Balança, composição corporal, energia',
    'meal-entry': 'Como registar uma refeição',
    'meal-grams': 'Ajustar gramas',
    'activity-youtube': 'Atividade do YouTube',
    'closed-loop': 'O ciclo fechado',
  },
};

const IT: ExplainerCopy = {
  sectionTitle: 'Video esplicativi',
  watchCta: 'Guarda',
  titles: {
    'what-is-healthings': 'Cos’è Healthings',
    'phone-health': 'Salute del telefono — chi scrive, chi legge',
    'cgm-pipeline': 'Pipeline CGM live',
    gear: 'Collega bilancia, orologio, CGM',
    'scale-choice': 'Bilancia Withings — Sì o No',
    'scale-trends': 'Bilancia, composizione corporea, energia',
    'meal-entry': 'Come registrare un pasto',
    'meal-grams': 'Regola i grammi',
    'activity-youtube': 'Attività da YouTube',
    'closed-loop': 'Il ciclo chiuso',
  },
};

const TR: ExplainerCopy = {
  sectionTitle: 'Anlatım videoları',
  watchCta: 'İzle',
  titles: {
    'what-is-healthings': 'Healthings nedir',
    'phone-health': 'Telefon sağlığı — kim yazar, kim okur',
    'cgm-pipeline': 'Canlı CGM hattı',
    gear: 'Tartı, saat, CGM bağla',
    'scale-choice': 'Withings tartı — Evet veya Hayır',
    'scale-trends': 'Tartı, vücut kompozisyonu, enerji',
    'meal-entry': 'Öğün nasıl kaydedilir',
    'meal-grams': 'Gramları ayarla',
    'activity-youtube': 'YouTube’dan aktivite',
    'closed-loop': 'Kapalı döngü',
  },
};

const BY_LOCALE: Record<HelpLocale, ExplainerCopy> = {
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

export function getExplainerCopy(langCode?: string | null): ExplainerCopy {
  return BY_LOCALE[helpLocale(langCode || 'en')];
}
