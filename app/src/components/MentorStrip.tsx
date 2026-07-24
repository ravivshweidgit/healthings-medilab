/**
 * My Mentors â€” multi-select toggle for AI mentor personas.
 * At least one must always be selected.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
  formatActiveMentorsHeader,
  mentorCardSubtitle,
  mentorPossessiveLabel,
} from '../logic/mentorLabels';
import { usesMentorGenderUi } from '../i18n/quickStartCopy';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { MentorIcon } from '../theme/icons';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';

const MENTOR_TYPES: MentorType[] = ['doctor', 'nutritionist', 'coach'];

function minGapLabel(hours: number, lang?: UserLanguage | null): string {
  if (lang?.code === 'he') {
    if (hours === 0) return '×œ×œ× ×ž×¨×•×•×— ×ž×™× ×™×ž×œ×™ â€” ×¨×¢× ×•×Ÿ ×‘×›×œ ×¢×ª';
    if (hours === 1) return '×©×¢×” ×ž×™× ×™×ž×•× ×‘×™×Ÿ ×¡×§×™×¨×•×ª';
    return `${hours} ×©×¢×•×ª ×ž×™× ×™×ž×•× ×‘×™×Ÿ ×¡×§×™×¨×•×ª`;
  }
  if (hours === 0) return 'No minimum gap â€” refresh anytime';
  if (hours === 1) return '1 hour minimum between reviews';
  return `${hours} hours minimum between reviews`;
}

function voiceUi(lang?: UserLanguage | null) {
  if (lang?.code === 'he') {
    return {
      title: '×”×ž××ž×Ÿ ×‘××¤×œ×™×§×¦×™×”',
      hint: '×’×‘×¨ ××• ××™×©×” â€” ×›×š ×™×“×‘×¨ ××œ×™×›× ×”×ž××ž×Ÿ. ×œ× ×”×ž×’×“×¨ ×©×œ×›× ×‘×¤×¨×•×¤×™×œ.',
      male: '×’×‘×¨',
      female: '××™×©×”',
    };
  }
  if (lang?.code === 'ar') {
    return {
      title: 'Ø§Ù„Ù…Ø±Ø´Ø¯ ÙÙŠ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚',
      hint: 'Ø±Ø¬Ù„ Ø£Ùˆ Ø§Ù…Ø±Ø£Ø© â€” Ù‡ÙƒØ°Ø§ ÙŠØ®Ø§Ø·Ø¨ÙƒÙ… Ø§Ù„Ù…Ø±Ø´Ø¯. Ù„ÙŠØ³ Ø¬Ù†Ø³ Ù…Ù„ÙÙƒÙ… Ø§Ù„Ø´Ø®ØµÙŠ.',
      male: 'Ø±Ø¬Ù„',
      female: 'Ø§Ù…Ø±Ø£Ø©',
    };
  }
  return {
    title: 'App mentor',
    hint: 'Man or woman â€” how your AI mentor speaks to you. Not your profile gender.',
    male: 'Man',
    female: 'Woman',
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const selectHint =
    lang?.code === 'he' ? '×‘×—×¨/×™ ×™×•×¢×¦×™× (×œ×¤×—×•×ª ××—×“)' : 'Select your AI advisors (at least one)';
  const reviewAfterMeal =
    lang?.code === 'he' ? '×¡×§×™×¨×” ××—×¨×™ ×›×œ ××¨×•×—×”' : 'Review after each meal';
  const gapSliderLabel =
    lang?.code === 'he' ? '×ž×¨×•×•×— ×ž×™× ×™×ž×•× ×‘×™×Ÿ ×¡×§×™×¨×•×ª (0â€“6 ×©×¢×•×ª)' : 'Minimum gap between reviews (0â€“6h)';
  const hintRequired =
    lang?.code === 'he' ? '× ×“×¨×© ×œ×¤×—×•×ª ×ž× ×˜×•×¨ ××—×“' : 'At least one mentor is required';
  const voice = voiceUi(lang);

  const pickVoice = async (g: Gender) => {
    onMentorGenderChange(g);
    await setMentorGender(g);
  };

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={profileTitles.myMentors}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={lang?.code === 'he' || lang?.code === 'ar'}
        collapseLabel="Collapse mentors"
        expandLabel="Expand mentors"
        subtitleNumberOfLines={2}
      />

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.bodyHint}>{selectHint}</Text>
          <View style={styles.cardsRow}>
            {MENTOR_TYPES.map((type) => {
              const selected = mentors.includes(type);
              const label = mentorPossessiveLabel(type, lang, mentorGender, userGender);
              const sub = mentorCardSubtitle(type, lang);
              return (
                <Pressable
                  key={type}
                  style={[styles.card, selected && styles.cardSelected]}
                  onPress={() => toggle(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                >
                  <MentorIcon
                    mentor={type}
                    size={22}
                    color={selected ? colors.accentBlue : colors.textSecondary}
                  />
                  <Text style={[styles.cardLabel, selected && styles.cardLabelSelected]}>{label}</Text>
                  <Text style={[styles.cardSub, selected && styles.cardSubSelected]}>{sub}</Text>
                </Pressable>
              );
            })}
          </View>
          {hint && <Text style={styles.hintText}>{hintRequired}</Text>}

          {usesMentorGenderUi(lang?.code) ? (
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
          ) : null}

          <View style={styles.freqSection}>
            <View style={styles.freqToggleRow}>
              <View style={styles.freqToggleInfo}>
                <Text style={styles.freqToggleLabel}>{reviewAfterMeal}</Text>
              </View>
              <Switch
                value={freq.afterEachMeal}
                onValueChange={(v) => updateFreq({ afterEachMeal: v })}
                trackColor={{ false: colors.gridLine, true: colors.accentBlue }}
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
              minimumTrackTintColor={colors.accentBlue}
              maximumTrackTintColor={colors.gridLine}
              thumbTintColor={colors.accentBlue}
            />
            <Text style={styles.freqSliderValue}>{minGapLabel(freq.minGapHours, lang)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  wrap: {},
  body: { paddingHorizontal: 4, paddingBottom: 12, paddingTop: 4 },
  bodyHint: { fontSize: 12, color: c.textSecondary, marginBottom: 12 },
  cardsRow: { flexDirection: 'row', gap: 8 },
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    gap: 4,
  },
  cardSelected: {
    borderColor: c.accentBlue,
    backgroundColor: '#EAF4FB',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textSecondary,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  cardLabelSelected: { color: c.accentBlue },
  cardSub: {
    fontSize: 10,
    color: c.textSecondary,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  cardSubSelected: { color: '#1565A0' },
  hintText: { fontSize: 11, color: '#E53935', textAlign: 'center', marginTop: 8 },

  voiceSection: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.gridLine,
    paddingTop: 14,
    gap: 6,
  },
  voiceHint: { fontSize: 11, color: c.textSecondary, marginBottom: 4 },
  voiceRow: { flexDirection: 'row', gap: 8 },
  voiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    alignItems: 'center',
  },
  voiceBtnSelected: {
    borderColor: c.accentBlue,
    backgroundColor: '#EAF4FB',
  },
  voiceBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
  voiceBtnTextSelected: { color: c.accentBlue },

  freqSection: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.gridLine,
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
  freqToggleLabel: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  freqSliderLabel: { fontSize: 12, color: c.textSecondary, marginBottom: 2 },
  slider: { width: '100%', height: 36 },
  freqSliderValue: { fontSize: 12, color: c.accentBlue, textAlign: 'center', fontWeight: '600' },
});
