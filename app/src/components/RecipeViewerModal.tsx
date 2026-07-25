/**
 * Full-screen recipe viewer — kitchen units + grams (prompt40).
 */

import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ingredientAmountDisplay,
  recipeDisplayTitle,
  recipeMacroSummary,
  type RecipePlan,
} from '../logic/mealPlanTypes';
import type { UserLanguage } from '../services/TargetService';
import { cardShadow } from '../theme/wellness';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { formatEnergy, type EnergyUnit } from '../logic/unitConvert';

type Props = {
  visible: boolean;
  plan: RecipePlan | null;
  lang?: UserLanguage | null;
  energyUnit?: EnergyUnit;
  onClose: () => void;
  onLogMeal?: () => void;
};

export function RecipeViewerModal({ visible, plan, lang, energyUnit = 'kcal', onClose, onLogMeal }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  if (!plan) return null;

  const title = recipeDisplayTitle(plan, rtl);
  const closeLabel = rtl ? 'סגור' : 'Close';
  const logLabel = rtl ? 'רשום כארוחה' : 'Log as meal';
  const ingredientsLabel = rtl ? 'מרכיבים' : 'Ingredients';
  const stepsLabel = rtl ? 'הכנה' : 'Steps';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={[styles.header, rtl && styles.headerRtl]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>{closeLabel}</Text>
          </Pressable>
          <Text style={[styles.headerTitle, rtl && styles.rtl]} numberOfLines={2}>
            {title}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.summary, rtl && styles.rtl]}>{recipeMacroSummary(plan, energyUnit)}</Text>
          {plan.source_note ? (
            <Text style={[styles.source, rtl && styles.rtl]}>{plan.source_note}</Text>
          ) : null}

          <Text style={[styles.sectionTitle, rtl && styles.rtl]}>{ingredientsLabel}</Text>
          <View style={[styles.ingredientCard, cardShadow]}>
            {plan.items.map((item, i) => {
              const name = rtl && item.name_local?.trim() ? item.name_local : item.name;
              return (
                <View
                  key={`ing-${i}-${item.name}`}
                  style={[styles.ingredientRow, i > 0 && styles.ingredientBorder]}
                >
                  <Text style={[styles.ingredientName, rtl && styles.rtl]}>{name}</Text>
                  <View style={[styles.ingredientMetricsRow, rtl && styles.ingredientMetricsRowRtl]}>
                    <Text style={[styles.amount, rtl && styles.rtl]}>
                      {ingredientAmountDisplay(item, rtl)}
                    </Text>
                    <Text style={[styles.ingredientMacros, rtl && styles.rtl]}>
                      {formatEnergy(item.kcal, energyUnit)} · P{item.protein_g} C{item.carb_g} F{item.fat_g} Fi{item.fiber_g ?? 0}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {plan.steps && plan.steps.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, rtl && styles.rtl]}>{stepsLabel}</Text>
              {plan.steps.map((step, i) => (
                <Text key={`step-${i}`} style={[styles.step, rtl && styles.rtl]}>
                  {i + 1}. {step}
                </Text>
              ))}
            </>
          ) : null}
        </ScrollView>

        {onLogMeal ? (
          <View style={styles.footer}>
            <Pressable style={styles.logBtn} onPress={onLogMeal}>
              <Text style={styles.logBtnText}>{logLabel}</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? c.gridLine : '#E8ECF0',
  },
  headerRtl: { flexDirection: 'row-reverse' },
  closeBtn: { fontSize: 16, color: c.accentBlue, minWidth: 48 },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: { minWidth: 48 },
  scroll: { padding: 20, paddingBottom: 32 },
  summary: { fontSize: 16, fontWeight: '600', color: isDark ? c.accentGreen : '#2E7D32', marginBottom: 4 },
  source: { fontSize: 13, color: c.textSecondary, marginBottom: 16, fontStyle: 'italic' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  ingredientCard: {
    backgroundColor: isDark ? c.background : '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: isDark ? 1 : 0,
    borderColor: c.gridLine,
  },
  ingredientRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 12,
    gap: 4,
  },
  ingredientBorder: { borderTopWidth: 1, borderTopColor: isDark ? c.gridLine : '#EEF1F4' },
  ingredientName: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textPrimary,
    lineHeight: 18,
  },
  ingredientMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 2,
  },
  ingredientMetricsRowRtl: { flexDirection: 'row-reverse' },
  amount: { fontSize: 14, fontWeight: '700', color: isDark ? c.accentGreen : '#2E7D32' },
  ingredientMacros: { fontSize: 11, color: c.textSecondary, flexShrink: 1 },
  step: { fontSize: 14, color: c.textPrimary, marginBottom: 8, lineHeight: 20 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: isDark ? c.gridLine : '#E8ECF0',
  },
  logBtn: {
    backgroundColor: isDark ? c.background : '#43A047',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: isDark ? 1.5 : 0,
    borderColor: c.accentGreen,
  },
  logBtnText: { fontSize: 16, fontWeight: '600', color: isDark ? c.accentGreen : '#fff' },
});
