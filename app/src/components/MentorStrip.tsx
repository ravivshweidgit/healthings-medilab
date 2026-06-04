/**
 * My Mentors — multi-select toggle for AI mentor personas.
 * At least one must always be selected.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type MentorType } from '../services/TargetService';
import { WellnessColors } from '../theme/wellness';

const MENTORS: { type: MentorType; emoji: string; label: string; sub: string }[] = [
  { type: 'doctor',       emoji: '🩺', label: 'Doctor',       sub: 'health & safety'  },
  { type: 'nutritionist', emoji: '🥗', label: 'Nutritionist', sub: 'food quality'      },
  { type: 'coach',        emoji: '💪', label: 'Coach',        sub: 'body composition'  },
];

type Props = {
  mentors: MentorType[];
  onChanged: (mentors: MentorType[]) => void;
  expanded: boolean;
  onToggleExpand: () => void;
};

export function MentorStrip({ mentors, onChanged, expanded, onToggleExpand }: Props) {
  const [hint, setHint] = useState(false);

  const toggle = (type: MentorType) => {
    if (mentors.includes(type)) {
      if (mentors.length === 1) { setHint(true); setTimeout(() => setHint(false), 2000); return; }
      onChanged(mentors.filter((m) => m !== type));
    } else {
      onChanged([...mentors, type]);
    }
  };

  const headerSub = mentors
    .map((m) => { const f = MENTORS.find((x) => x.type === m); return f ? `${f.emoji} ${f.label}` : ''; })
    .join(' · ');

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.headerRow} onPress={onToggleExpand}>
        <Text style={styles.headerIcon}>🧑‍⚕️</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>My Mentors</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.bodyHint}>Select your AI advisors (at least one)</Text>
          <View style={styles.cardsRow}>
            {MENTORS.map(({ type, emoji, label, sub }) => {
              const selected = mentors.includes(type);
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
          {hint && <Text style={styles.hintText}>At least one mentor is required</Text>}
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
});
