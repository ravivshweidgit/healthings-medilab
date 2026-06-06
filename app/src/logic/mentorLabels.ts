/**
 * User-facing mentor titles — possessive ("My doctor") with gendered Hebrew/Arabic.
 */

import type { Gender, MentorType, UserLanguage } from '../services/TargetService';

export const MENTOR_EMOJI: Record<MentorType, string> = {
  doctor: '🩺',
  nutritionist: '🥗',
  coach: '💪',
};

export function resolveMentorGender(
  mentorGender?: Gender | null,
  userGender?: Gender | null,
): 'male' | 'female' {
  if (mentorGender === 'female') return 'female';
  if (mentorGender === 'male') return 'male';
  if (userGender === 'female') return 'female';
  return 'male';
}

const POSSESSIVE: Record<
  MentorType,
  Record<string, { male: string; female: string }>
> = {
  doctor: {
    en: { male: 'My doctor', female: 'My doctor' },
    he: { male: 'הרופא שלי', female: 'הרופאה שלי' },
    ar: { male: 'طبيبي', female: 'طبيبتي' },
    es: { male: 'Mi médico', female: 'Mi médica' },
    fr: { male: 'Mon médecin', female: 'Ma médecin' },
    de: { male: 'Mein Arzt', female: 'Meine Ärztin' },
    ru: { male: 'Мой врач', female: 'Моя врач' },
  },
  nutritionist: {
    en: { male: 'My nutritionist', female: 'My nutritionist' },
    he: { male: 'התזונאי שלי', female: 'התזונאית שלי' },
    ar: { male: 'أخصائي التغذية', female: 'أخصائية التغذية' },
    es: { male: 'Mi nutricionista', female: 'Mi nutricionista' },
    fr: { male: 'Mon nutritionniste', female: 'Ma nutritionniste' },
    de: { male: 'Mein Ernährungsberater', female: 'Meine Ernährungsberaterin' },
    ru: { male: 'Мой диетолог', female: 'Моя диетолог' },
  },
  coach: {
    en: { male: 'My coach', female: 'My coach' },
    he: { male: 'המאמן שלי', female: 'המאמנת שלי' },
    ar: { male: 'مدربي', female: 'مدربتي' },
    es: { male: 'Mi entrenador', female: 'Mi entrenadora' },
    fr: { male: 'Mon coach', female: 'Ma coach' },
    de: { male: 'Mein Coach', female: 'Meine Coach' },
    ru: { male: 'Мой тренер', female: 'Моя тренер' },
  },
};

const COLLECTIVE: Record<string, { male: string; female: string }> = {
  en: { male: 'My mentors', female: 'My mentors' },
  he: { male: 'המנטורים שלי', female: 'המנטוריות שלי' },
  ar: { male: 'مرشدوني', female: 'مرشداتي' },
  es: { male: 'Mis mentores', female: 'Mis mentoras' },
  fr: { male: 'Mes mentors', female: 'Mes mentors' },
  de: { male: 'Meine Mentoren', female: 'Meine Mentorinnen' },
  ru: { male: 'Мои наставники', female: 'Мои наставницы' },
};

const CARD_SUB: Record<MentorType, Record<string, string>> = {
  doctor: {
    en: 'health & safety',
    he: 'בריאות ובטיחות',
    ar: 'الصحة والسلامة',
  },
  nutritionist: {
    en: 'food quality',
    he: 'איכות תזונה',
    ar: 'جودة الغذاء',
  },
  coach: {
    en: 'body composition',
    he: 'הרכב גוף',
    ar: 'تركيب الجسم',
  },
};

function langCode(lang?: UserLanguage | null): string {
  return lang?.code ?? 'en';
}

export function mentorPossessiveLabel(
  type: MentorType,
  lang?: UserLanguage | null,
  mentorGender?: Gender | null,
  userGender?: Gender | null,
): string {
  const code = langCode(lang);
  const g = resolveMentorGender(mentorGender, userGender);
  const row = POSSESSIVE[type][code] ?? POSSESSIVE[type].en!;
  return row[g];
}

export function mentorsCollectiveLabel(
  lang?: UserLanguage | null,
  mentorGender?: Gender | null,
  userGender?: Gender | null,
): string {
  const code = langCode(lang);
  const g = resolveMentorGender(mentorGender, userGender);
  const row = COLLECTIVE[code] ?? COLLECTIVE.en!;
  return row[g];
}

/** Chat bubble / export sender when one or more mentors reply together. */
export function chatMentorSenderLabel(
  mentors: MentorType[],
  lang?: UserLanguage | null,
  mentorGender?: Gender | null,
  userGender?: Gender | null,
): string {
  if (mentors.length === 1) {
    return mentorPossessiveLabel(mentors[0]!, lang, mentorGender, userGender);
  }
  return mentorsCollectiveLabel(lang, mentorGender, userGender);
}

export function formatActiveMentorsHeader(
  mentors: MentorType[],
  lang?: UserLanguage | null,
  mentorGender?: Gender | null,
  userGender?: Gender | null,
): string {
  return mentors
    .map((m) => {
      const emoji = MENTOR_EMOJI[m];
      const label = mentorPossessiveLabel(m, lang, mentorGender, userGender);
      return `${emoji} ${label}`;
    })
    .join(' · ');
}

export function mentorCardSubtitle(type: MentorType, lang?: UserLanguage | null): string {
  const code = langCode(lang);
  return CARD_SUB[type][code] ?? CARD_SUB[type].en!;
}

export function mentorsStripTitle(lang?: UserLanguage | null): string {
  const code = langCode(lang);
  if (code === 'he') return 'המנטורים שלי';
  if (code === 'ar') return 'مرشدوني';
  if (code === 'es') return 'Mis mentores';
  if (code === 'fr') return 'Mes mentors';
  if (code === 'de') return 'Meine Mentoren';
  if (code === 'ru') return 'Мои наставники';
  return 'My Mentors';
}
