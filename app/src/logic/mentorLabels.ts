/**
 * User-facing mentor titles — possessive ("My doctor") with gendered Hebrew/Arabic.
 */

import type { Gender, MentorType, UserLanguage } from '../services/TargetService';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';

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
    pt: { male: 'Meu médico', female: 'Minha médica' },
    it: { male: 'Il mio medico', female: 'La mia medica' },
    tr: { male: 'Doktorum', female: 'Doktorum' },
  },
  nutritionist: {
    en: { male: 'My nutritionist', female: 'My nutritionist' },
    he: { male: 'התזונאי שלי', female: 'התזונאית שלי' },
    ar: { male: 'أخصائي التغذية', female: 'أخصائية التغذية' },
    es: { male: 'Mi nutricionista', female: 'Mi nutricionista' },
    fr: { male: 'Mon nutritionniste', female: 'Ma nutritionniste' },
    de: { male: 'Mein Ernährungsberater', female: 'Meine Ernährungsberaterin' },
    ru: { male: 'Мой диетолог', female: 'Моя диетолог' },
    pt: { male: 'Meu nutricionista', female: 'Minha nutricionista' },
    it: { male: 'Il mio nutrizionista', female: 'La mia nutrizionista' },
    tr: { male: 'Diyetisyenim', female: 'Diyetisyenim' },
  },
  coach: {
    en: { male: 'My coach', female: 'My coach' },
    he: { male: 'המאמן שלי', female: 'המאמנת שלי' },
    ar: { male: 'مدربي', female: 'مدربتي' },
    es: { male: 'Mi entrenador', female: 'Mi entrenadora' },
    fr: { male: 'Mon coach', female: 'Ma coach' },
    de: { male: 'Mein Coach', female: 'Meine Coach' },
    ru: { male: 'Мой тренер', female: 'Моя тренер' },
    pt: { male: 'Meu coach', female: 'Minha coach' },
    it: { male: 'Il mio coach', female: 'La mia coach' },
    tr: { male: 'Antrenörüm', female: 'Antrenörüm' },
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
  pt: { male: 'Meus mentores', female: 'Minhas mentoras' },
  it: { male: 'I miei mentori', female: 'Le mie mentori' },
  tr: { male: 'Mentorlarım', female: 'Mentorlarım' },
};

const CARD_SUB: Record<MentorType, Record<string, string>> = {
  doctor: {
    en: 'health & safety',
    he: 'בריאות ובטיחות',
    ar: 'الصحة والسلامة',
    es: 'salud y seguridad',
    fr: 'santé et sécurité',
    de: 'Gesundheit & Sicherheit',
    ru: 'здоровье и безопасность',
    pt: 'saúde e segurança',
    it: 'salute e sicurezza',
    tr: 'sağlık ve güvenlik',
  },
  nutritionist: {
    en: 'food quality',
    he: 'איכות תזונה',
    ar: 'جودة الغذاء',
    es: 'calidad de la comida',
    fr: 'qualité alimentaire',
    de: 'Nahrungsqualität',
    ru: 'качество питания',
    pt: 'qualidade da comida',
    it: 'qualità del cibo',
    tr: 'yiyecek kalitesi',
  },
  coach: {
    en: 'body composition',
    he: 'הרכב גוף',
    ar: 'تركيب الجسم',
    es: 'composición corporal',
    fr: 'composition corporelle',
    de: 'Körperzusammensetzung',
    ru: 'состав тела',
    pt: 'composição corporal',
    it: 'composizione corporea',
    tr: 'vücut kompozisyonu',
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

export function activeMentorEmojis(mentors: MentorType[]): string {
  const order: MentorType[] = ['doctor', 'nutritionist', 'coach'];
  return order
    .filter((m) => mentors.includes(m))
    .map((m) => MENTOR_EMOJI[m])
    .join('');
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
  return getProfileSettingsStripCopy(lang?.code).myMentors;
}
