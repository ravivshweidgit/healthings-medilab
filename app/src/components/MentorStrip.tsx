/**
 * My Mentors — multi-select toggle for AI mentor personas.
 * At least one must always be selected.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import {
  type Gender,
  type MentorFrequency,
  type MentorType,
  type UserLanguage,
  getMentorFrequency,
  saveMentorFrequency,
  setMentorGender,
} from '../services/TargetService';
import {
  MENTOR_EMOJI,
  formatActiveMentorsHeader,
  mentorCardSubtitle,
  mentorPossessiveLabel,
  mentorsStripTitle,
} from '../logic/mentorLabels';
import { WellnessColors } from '../theme/wellness';

const MENTOR_TYPES: MentorType[] = ['doctor', 'nutritionist', 'coach'];

function minGapLabel(hours: number, lang?: UserLanguage | null): string {
  if (lang?.code === 'he') {
    if (hours === 0) return 'ללא מרווח מינימלי — רענון בכל עת';
    if (hours === 1) return 'שעה מינימום בין סקירות';
    return `${hours} שעות מינימום בין סקירות`;
  }
  if (hours === 0) return 'No minimum gap — refresh anytime';
  if (hours === 1) return '1 hour minimum between reviews';
  return `${hours} hours minimum between reviews`;
}

function voiceUi(lang?: UserLanguage | null) {
  if (lang?.code === 'he') {
    return {
      title: 'קול המנטור',
      hint: 'הרופא/ה שלי, התזונאי/ת שלי — זכר או נקבה',
      male: 'זכר',
      female: 'נקבה',
    };
  }
  if (lang?.code === 'ar') {
    return {
      title: 'صوت المرشد',
      hint: 'طبيبي / أخصائية التغذية — ذكر أو أنثى',
      male: 'ذكر',
      female: 'أنثى',
    };
  }
  return {
    title: 'Mentor voice',
    hint: 'My doctor / My nutritionist — male or female titles',
    male: 'Male',
    female: 'Female',
  };
}

type Props = {
  mentors: MentorType[];
  onChanged: (mentors: MentorType[]) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
  mentorGender: Gender;
  onMentorGenderChange: (gender: Gender) => void;
  userGender?: Gender | null;
};

export function MentorStrip({
  mentors,
  onChanged,
  expanded,
  onToggleExpand,
  lang,
  mentorGender,
  onMentorGenderChange,
  userGender,
}: Props) {
  const [hint, setHint] = useState(false);
  const [freq, setFreq] = useState<MentorFrequency>({ afterEachMeal: true, minGapHours: 4 });

  useEffect(() => {
    getMentorFrequency().then(setFreq);
  }, []);

  const updateFreq = async (patch: Partial<MentorFrequency>) => {
    const updated = { ...freq, ...patch };
    setFreq(updated);
    await saveMentorFrequency(updated);
  };

  const toggle = (type: MentorType) => {
    if (mentors.includes(type)) {
      if (mentors.length === 1) { setHint(true); setTimeout(() => setHint(false), 2000); return; }
      onChanged(mentors.filter((m) => m !== type));
    } else {
      onChanged([...mentors, type]);
    }
  };

  const headerSub = formatActiveMentorsHeader(mentors, lang, mentorGender, userGender);
  const stripTitle = mentorsStripTitle(lang);
  const selectHint =
    lang?.code === 'he' ? 'בחר/י יועצים (לפחות אחד)' : 'Select your AI advisors (at least one)';
  const reviewAfterMeal =
    lang?.code === 'he' ? 'סקירה אחרי כל ארוחה' : 'Review after each meal';
  const gapSliderLabel =
    lang?.code === 'he' ? 'מרווח מינימום בין סקירות (0–6 שעות)' : 'Minimum gap between reviews (0–6h)';
  const hintRequired =
    lang?.code === 'he' ? 'נדרש לפחות מנטור אחד' : 'At least one mentor is required';
  const voice = voiceUi(lang);

  const pickVoice = async (g: Gender) => {
    onMentorGenderChange(g);
    await setMentorGender(g);
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.headerRow} onPress={onToggleExpand}>
        <Text style={styles.headerIcon}>🧑‍⚕️</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{stripTitle}</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.bodyHint}>{selectHint}</Text>
          <View style={styles.cardsRow}>
            {MENTOR_TYPES.map((type) => {
              const selected = mentors.includes(type);
              const emoji = MENTOR_EMOJI[type];
              const label = mentorPossessiveLabel(type, lang, mentorGender, userGender);
              const sub = mentorCardSubtitle(type, lang);
              return (
                <Pressable
                  key={type}
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => toggle(type)}
                >
                  <Text style={styles.cardEmoji}>{emoji}</Text>
                  <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{label}</Text>
                  <Text style={[styles.cardSub, selected && styles.cardSubSelected]}>{sub}</Text>
                </Pressable>
              );
            })}
          </View>
          {hint && <Text style={styles.hintText}>{hintRequired}</Text>}

          <View style={styles.voiceSection}>
            <Text style={styles.freqToggleLabel}>{voice.title}</Text>
            <Text style={styles.voiceHint}>{voice.hint}</Text>
            <View style={styles.voiceRow}>
              {(['male', 'female'] as Gender[]).map((g) => (
                <Pressable
                  key={g}
                  style={[styles.voiceBtn, mentorGender === g && styles.voiceBtnSelected]}
                  onPress={() => void pickVoice(g)}
                >
                  <Text style={[styles.voiceBtnText, mentorGender === g && styles.voiceBtnTextSelected]}>
                    {g === 'male' ? voice.male : voice.female}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.freqSection}>
            <View style={styles.freqToggleRow}>
              <View style={styles.freqToggleInfo}>
                <Text style={styles.freqToggleLabel}>{reviewAfterMeal}</Text>
              </View>
              <Switch
                value={freq.afterEachMeal}
                onValueChange={(v) => updateFreq({ afterEachMeal: v })}
                trackColor={{ false: WellnessColors.gridLine, true: WellnessColors.accentGreen }}
                thumbColor={freq.afterEachMeal ? '#fff' : '#f4f3f4'}
              />
            </View>
            <Text style={styles.freqSliderLabel}>{gapSliderLabel}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={6}
              step={1}
              value={freq.minGapHours}
              onValueChange={(v) => setFreq((prev) => ({ ...prev, minGapHours: Math.round(v) }))}
              onSlidingComplete={(v) => updateFreq({ minGapHours: Math.round(v) })}
              minimumTrackTintColor={WellnessColors.accentBlue}
              maximumTrackTintColor={WellnessColors.gridLine}
              thumbTintColor={WellnessColors.accentBlue}
            />
            <Text style={styles.freqSliderValue}>{minGapLabel(freq.minGapHours, lang)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerIcon: { fontSize: 24 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: WellnessColors.textPrimary },
  headerSub: { fontSize: 12, color: WellnessColors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: WellnessColors.textSecondary, fontWeight: '300' },

  body: { paddingHorizontal: 16, paddingBottom: 16 },
  bodyHint: { fontSize: 12, color: WellnessColors.textSecondary, marginBottom: 12 },
  cardsRow: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: WellnessColors.gridLine,
    gap: 4,
  },
  cardSelected: {
    borderColor: WellnessColors.accentGreen,
    backgroundColor: '#F0FAF0',
  },
  cardEmoji: { fontSize: 22 },
  cardLabel: { fontSize: 12, fontWeight: '700', color: WellnessColors.textSecondary },
  cardLabelSelected: { color: WellnessColors.accentGreen },
  cardSub: { fontSize: 10, color: WellnessColors.textSecondary, textAlign: 'center' },
  cardSubSelected: { color: '#388E3C' },
  hintText: { fontSize: 11, color: '#E53935', textAlign: 'center', marginTop: 8 },

  voiceSection: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WellnessColors.gridLine,
    paddingTop: 14,
    gap: 6,
  },
  voiceHint: { fontSize: 11, color: WellnessColors.textSecondary, marginBottom: 4 },
  voiceRow: { flexDirection: 'row', gap: 8 },
  voiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  voiceBtnSelected: {
    borderColor: WellnessColors.accentBlue,
    backgroundColor: '#EAF4FB',
  },
  voiceBtnText: { fontSize: 13, fontWeight: '600', color: WellnessColors.textSecondary },
  voiceBtnTextSelected: { color: WellnessColors.accentBlue },

  freqSection: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WellnessColors.gridLine,
    paddingTop: 14,
    gap: 6,
  },
  freqToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  freqToggleInfo: { flex: 1 },
  freqToggleLabel: { fontSize: 13, fontWeight: '600', color: WellnessColors.textPrimary },
  freqSliderLabel: { fontSize: 12, color: WellnessColors.textSecondary, marginBottom: 2 },
  slider: { width: '100%', height: 36 },
  freqSliderValue: { fontSize: 12, color: WellnessColors.accentBlue, textAlign: 'center', fontWeight: '600' },
});
