/**
 * Inline chat card — nutritionist recipe / meal plan (prompt40).
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  recipeDisplayTitle,
  recipeMacroSummary,
  type RecipePlan,
} from '../logic/mealPlanTypes';
import type { UserLanguage } from '../services/TargetService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import type { EnergyUnit } from '../logic/unitConvert';

type Props = {
  plan: RecipePlan;
  lang?: UserLanguage | null;
  energyUnit?: EnergyUnit;
  onOpen: () => void;
  onLogMeal: () => void;
  onDismiss?: () => void;
};

export function RecipeCard({ plan, lang, energyUnit = 'kcal', onOpen, onLogMeal, onDismiss }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  const title = recipeDisplayTitle(plan, rtl);
  const summary = recipeMacroSummary(plan, energyUnit);
  const openLabel = rtl ? 'פתח מתכון' : 'Open recipe';
  const logLabel = rtl ? 'רשום ארוחה' : 'Log meal';
  const dismissLabel = rtl ? 'סגור' : 'Dismiss';
  const servingsLabel = rtl
    ? `${plan.servings} מנות`
    : `${plan.servings} serving${plan.servings === 1 ? '' : 's'}`;

  return (
    <View style={styles.card}>
      <Text style={[styles.emoji]}>🥤</Text>
      <Text style={[styles.title, rtl && styles.rtl]}>{title}</Text>
      <Text style={[styles.meta, rtl && styles.rtl]}>{servingsLabel}</Text>
      <Text style={[styles.summary, rtl && styles.rtl]}>{summary}</Text>
      {plan.source_note ? (
        <Text style={[styles.source, rtl && styles.rtl]} numberOfLines={2}>
          {plan.source_note}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {onDismiss ? (
          <Pressable style={styles.dismissBtn} onPress={onDismiss} hitSlop={6}>
            <Text style={styles.dismissText}>{dismissLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryBtn} onPress={onOpen} hitSlop={6}>
          <Text style={styles.secondaryText}>{openLabel}</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={onLogMeal} hitSlop={6}>
          <Text style={styles.primaryText}>{logLabel}</Text>
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
  emoji: { fontSize: 22, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  summary: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginTop: 6 },
  source: { fontSize: 11, color: c.textSecondary, marginTop: 4, fontStyle: 'italic' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  dismissBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  dismissText: { fontSize: 13, color: c.textSecondary },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#81C784',
  },
  secondaryText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },
  primaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#43A047',
  },
  primaryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
