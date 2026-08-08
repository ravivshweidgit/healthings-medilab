/**
 * Inline chat card — confirm nutritionist macro proposal before save.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MacroSuggestion } from '../services/GeminiService';
import type { DailyMacroTarget, UserLanguage } from '../services/TargetService';
import { confirmMacroTargetFromProposal } from '../logic/macroAutoAdjust';
import { RulesAdviceBanner } from './RulesAdviceBanner';
import { MacroClinicalProfileBanner } from './MacroClinicalProfileBanner';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { formatEnergy, type EnergyUnit } from '../logic/unitConvert';

type Props = {
  proposal: MacroSuggestion;
  lang?: UserLanguage | null;
  energyUnit?: EnergyUnit;
  onApplied?: (target: DailyMacroTarget) => void;
  onDismiss?: () => void;
};

export function MacroProposalCard({ proposal, lang, energyUnit = 'kcal', onApplied, onDismiss }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [busy, setBusy] = useState(false);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const title = rtl ? 'עדכון יעדי מאקרו מוצעים' : 'Proposed macro targets';
  const cancelLabel = rtl ? 'ביטול' : 'Cancel';
  const applyLabel = rtl ? 'עדכן יעדים' : 'Update targets';
  const summary = `${formatEnergy(proposal.kcal, energyUnit)} · P${proposal.protein_g} · C${proposal.carb_g} · F${proposal.fat_g} · Fi${proposal.fiber_g}`;

  const handleApply = useCallback(async () => {
    setBusy(true);
    try {
      const target = await confirmMacroTargetFromProposal(proposal);
      onApplied?.(target);
    } finally {
      setBusy(false);
    }
  }, [proposal, onApplied]);

  return (
    <View style={styles.card}>
      <Text style={[styles.title, rtl && styles.rtl]}>{title}</Text>
      <Text style={[styles.summary, rtl && styles.rtl]}>{summary}</Text>
      {proposal.clinical_profile ? (
        <MacroClinicalProfileBanner
          clinicalProfile={proposal.clinical_profile}
          pcfPriority={proposal.pcf_priority}
          macroOrder={proposal.macro_order}
          compact
        />
      ) : null}
      {proposal.rules_advice ? (
        <RulesAdviceBanner advice={proposal.rules_advice} rtl={rtl} />
      ) : null}
      {proposal.reasoning ? (
        <Text style={[styles.reason, rtl && styles.rtl]} numberOfLines={5}>
          {proposal.reasoning}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable style={styles.cancelBtn} onPress={onDismiss} disabled={busy}>
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </Pressable>
        <Pressable style={styles.applyBtn} onPress={() => void handleApply()} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={isDark ? colors.accentBlue : '#fff'} size="small" />
          ) : (
            <Text style={styles.applyText}>{applyLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  card: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: isDark ? c.surface : '#F1F8E9',
    borderWidth: 1,
    borderColor: isDark ? c.gridLine : '#A5D6A7',
  },
  title: { fontSize: 14, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
  summary: { fontSize: 15, fontWeight: '600', color: isDark ? c.accentGreen : '#2E7D32', marginBottom: 4 },
  reason: { fontSize: 12, color: c.textSecondary, marginBottom: 10 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 16 },
  cancelText: { fontSize: 14, color: c.textSecondary, fontWeight: '600' },
  applyBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    backgroundColor: isDark ? c.background : c.accentBlue,
    minWidth: 100,
    alignItems: 'center',
  },
  applyText: { fontSize: 14, fontWeight: '700', color: isDark ? c.accentBlue : '#fff' },
});
