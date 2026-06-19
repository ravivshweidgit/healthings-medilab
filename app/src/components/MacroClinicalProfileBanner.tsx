/**
 * Clinical profile feedback — professional medical English. Always LTR.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expandPcfPriority } from '../logic/macroClinicalProfile';
import { WellnessColors } from '../theme/wellness';

type Props = {
  clinicalProfile: string;
  pcfPriority?: string | null;
  macroOrder?: string | null;
  compact?: boolean;
};

export function MacroClinicalProfileBanner({
  clinicalProfile,
  pcfPriority,
  macroOrder,
  compact,
}: Props) {
  if (!clinicalProfile.trim()) return null;

  const pcfShort = pcfPriority?.trim() || null;
  const pcfExpanded = pcfShort ? expandPcfPriority(pcfShort) : null;

  return (
    <View style={[styles.box, compact && styles.boxCompact]}>
      <Text style={styles.title}>Clinical profile</Text>
      <Text style={styles.profile}>{clinicalProfile}</Text>
      {pcfShort ? (
        <View style={styles.pcfRow}>
          <Text style={styles.pcfLabel}>Macro priority (P → C → F)</Text>
          <Text style={styles.pcfShort}>{pcfShort}</Text>
          {pcfExpanded ? (
            <Text style={styles.pcfDetail} numberOfLines={compact ? 2 : undefined}>
              {pcfExpanded}
            </Text>
          ) : null}
        </View>
      ) : null}
      {macroOrder ? (
        <Text style={styles.order} numberOfLines={compact ? 2 : undefined}>
          {`Full sequence: ${macroOrder}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  boxCompact: { marginBottom: 8, padding: 8 },
  title: { fontSize: 11, fontWeight: '700', color: '#2E7D32', marginBottom: 4, textTransform: 'uppercase' },
  profile: { fontSize: 14, fontWeight: '600', color: WellnessColors.textPrimary, marginBottom: 6 },
  pcfRow: {
    marginBottom: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#A5D6A7',
  },
  pcfLabel: { fontSize: 11, fontWeight: '700', color: '#388E3C', marginBottom: 2 },
  pcfShort: { fontSize: 13, fontWeight: '700', color: WellnessColors.textPrimary, marginBottom: 2 },
  pcfDetail: { fontSize: 12, color: WellnessColors.textSecondary, lineHeight: 16, fontStyle: 'italic' },
  order: { fontSize: 11, color: WellnessColors.textSecondary, lineHeight: 15, marginTop: 2 },
});
