/**
 * Inline chat card â€” confirm nutritionist macro proposal before save.
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busy, setBusy] = useState(false);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const title = rtl ? '×¢×“×›×•×Ÿ ×™×¢×“×™ ×ž××§×¨×• ×ž×•×¦×¢×™×' : 'Proposed macro targets';
  const cancelLabel = rtl ? '×‘×™×˜×•×œ' : 'Cancel';
  const applyLabel = rtl ? '×¢×“×›×Ÿ ×™×¢×“×™×' : 'Update targets';
  const summary = `${formatEnergy(proposal.kcal, energyUnit)} Â· P${proposal.protein_g} Â· C${proposal.carb_g} Â· F${proposal.fat_g} Â· Fi${proposal.fiber_g}`;

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
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.applyText}>{applyLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  card: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F1F8E9',
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  title: { fontSize: 14, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
  summary: { fontSize: 15, fontWeight: '600', color: '#2E7D32', marginBottom: 4 },
  reason: { fontSize: 12, color: c.textSecondary, marginBottom: 10 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 14 },
  cancelText: { fontSize: 14, color: c.textSecondary },
  applyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#43A047',
    minWidth: 100,
    alignItems: 'center',
  },
  applyText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
