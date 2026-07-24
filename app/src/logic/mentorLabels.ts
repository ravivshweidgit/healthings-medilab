/**
 * User-facing mentor titles — "AI doctor / AI nutritionist / AI coach" with
 * gendered nouns for Hebrew/Arabic/etc. "AI" (not "My") makes the non-clinical,
 * non-human nature explicit; "AI" stays literal in every language per the
 * always-English glossary (not IA/KI/ИИ). Placement follows each language's
 * natural order (prefix for en/de/ru/tr, suffix for he/ar/es/fr/pt/it).
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
    en: { male: 'AI doctor', female: 'AI doctor' },
    he: { male: 'רופא AI', female: 'רופאה AI' },
    ar: { male: 'طبيب AI', female: 'طبيبة AI' },
    es: { male: 'Médico AI', female: 'Médica AI' },
    fr: { male: 'Médecin AI', female: 'Médecin AI' },
    de: { male: 'AI-Arzt', female: 'AI-Ärztin' },
    ru: { male: 'AI-врач', female: 'AI-врач' },
    pt: { male: 'Médico AI', female: 'Médica AI' },
    it: { male: 'Medico AI', female: 'Medica AI' },
    tr: { male: 'AI doktor', female: 'AI doktor' },
  },
  nutritionist: {
    en: { male: 'AI nutritionist', female: 'AI nutritionist' },
    he: { male: 'תזונאי AI', female: 'תזונאית AI' },
    ar: { male: 'أخصائي تغذية AI', female: 'أخصائية تغذية AI' },
    es: { male: 'Nutricionista AI', female: 'Nutricionista AI' },
    fr: { male: 'Nutritionniste AI', female: 'Nutritionniste AI' },
    de: { male: 'AI-Ernährungsberater', female: 'AI-Ernährungsberaterin' },
    ru: { male: 'AI-диетолог', female: 'AI-диетолог' },
    pt: { male: 'Nutricionista AI', female: 'Nutricionista AI' },
    it: { male: 'Nutrizionista AI', female: 'Nutrizionista AI' },
    tr: { male: 'AI diyetisyen', female: 'AI diyetisyen' },
  },
  coach: {
    en: { male: 'AI coach', female: 'AI coach' },
    he: { male: 'מאמן AI', female: 'מאמנת AI' },
    ar: { male: 'مدرب AI', female: 'مدربة AI' },
    es: { male: 'Entrenador AI', female: 'Entrenadora AI' },
    fr: { male: 'Coach AI', female: 'Coach AI' },
    de: { male: 'AI-Coach', female: 'AI-Coach' },
    ru: { male: 'AI-тренер', female: 'AI-тренер' },
    pt: { male: 'Coach AI', female: 'Coach AI' },
    it: { male: 'Coach AI', female: 'Coach AI' },
    tr: { male: 'AI antrenör', female: 'AI antrenör' },
  },
};

const COLLECTIVE: Record<string, { male: string; female: string }> = {
  en: { male: 'AI mentors', female: 'AI mentors' },
  he: { male: 'מנטורים AI', female: 'מנטוריות AI' },
  ar: { male: 'مرشدون AI', female: 'مرشدات AI' },
  es: { male: 'Mentores AI', female: 'Mentoras AI' },
  fr: { male: 'Mentors AI', female: 'Mentors AI' },
  de: { male: 'AI-Mentoren', female: 'AI-Mentorinnen' },
  ru: { male: 'AI-наставники', female: 'AI-наставницы' },
  pt: { male: 'Mentores AI', female: 'Mentoras AI' },
  it: { male: 'Mentori AI', female: 'Mentori AI' },
  tr: { male: 'AI mentorlar', female: 'AI mentorlar' },
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
  // Chrome subtitle (collapsed Mentors strip) — labels only. Emoji now lives in
  // Lucide chrome marks (prompt94); MENTOR_EMOJI stays for chat/export text.
  return mentors
    .map((m) => mentorPossessiveLabel(m, lang, mentorGender, userGender))
    .join(' · ');
}

export function mentorCardSubtitle(type: MentorType, lang?: UserLanguage | null): string {
  const code = langCode(lang);
  return CARD_SUB[type][code] ?? CARD_SUB[type].en!;
}

export function mentorsStripTitle(lang?: UserLanguage | null): string {
  return getProfileSettingsStripCopy(lang?.code).myMentors;
}
