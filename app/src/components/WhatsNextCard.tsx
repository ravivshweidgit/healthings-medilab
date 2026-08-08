/**
 * Post-setup dashboard CTA — Log meal / Add activity (prompt106 Phase A).
 * Action pills match FoodMacroStrip add-actions (black punch-out on dark).
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UtensilsCrossed, Dumbbell, X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { getWhatsNextCopy } from '../i18n/whatsNextCopy';

type Props = {
  langCode?: string | null;
  onLogMeal: () => void;
  onAddActivity: () => void;
  onDismiss: () => void;
  /** Hide Add activity when Activity Log strip is off in Appearance. */
  showActivity?: boolean;
};

export function WhatsNextCard({
  langCode,
  onLogMeal,
  onAddActivity,
  onDismiss,
  showActivity = true,
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const copy = getWhatsNextCopy(langCode);
  const rtl = langCode === 'he' || langCode === 'ar';
  const mealInk = isDark ? colors.accentBlue : '#1F3D5C';
  const activityInk = isDark ? colors.accentBlue : '#1F3D5C';

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={[styles.headerRow, rtl && styles.rowRtl]}>
        <Text style={[styles.title, rtl && styles.rtl]}>{copy.title}</Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={12}
          accessibilityLabel={copy.later}
          style={({ pressed }) => [styles.laterBtn, pressed && styles.pressed]}
        >
          <X size={18} color={colors.textSecondary} strokeWidth={2.25} />
        </Pressable>
      </View>
      <Text style={[styles.lead, rtl && styles.rtl]}>{copy.lead}</Text>
      <View style={[styles.actions, rtl && styles.rowRtl]}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.actionMeal, pressed && styles.pressed]}
          onPress={onLogMeal}
          accessibilityRole="button"
          accessibilityLabel={copy.logMeal}
        >
          <UtensilsCrossed size={20} color={mealInk} strokeWidth={2.25} />
          <Text style={[styles.actionLabel, { color: mealInk }]} numberOfLines={1}>
            {copy.logMeal}
          </Text>
        </Pressable>
        {showActivity ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.actionActivity,
              pressed && styles.pressed,
            ]}
            onPress={onAddActivity}
            accessibilityRole="button"
            accessibilityLabel={copy.addActivity}
          >
            <Dumbbell size={20} color={activityInk} strokeWidth={2.25} />
            <Text style={[styles.actionLabel, { color: activityInk }]} numberOfLines={1}>
              {copy.addActivity}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        style={({ pressed }) => [styles.laterLink, pressed && styles.pressed]}
      >
        <Text style={[styles.laterText, rtl && styles.rtl]}>{copy.later}</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 16,
      marginBottom: 12,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 12,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.metabolicPairBorder,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowRtl: { flexDirection: 'row-reverse' },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    rtl: { textAlign: 'right', writingDirection: 'rtl' },
    laterBtn: { padding: 4 },
    lead: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 14,
    },
    // Mirror FoodMacroStrip addActionBtn — centered icon + label, tight pill.
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: 'solid',
    },
    actionMeal: {
      borderColor: isDark ? 'rgba(142, 155, 255, 0.9)' : 'rgba(31, 61, 92, 0.85)',
      backgroundColor: isDark ? colors.background : 'rgba(31, 61, 92, 0.08)',
    },
    actionActivity: {
      borderColor: isDark ? 'rgba(142, 155, 255, 0.9)' : 'rgba(31, 61, 92, 0.85)',
      backgroundColor: isDark ? colors.background : 'rgba(31, 61, 92, 0.08)',
    },
    actionLabel: {
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    laterLink: {
      alignSelf: 'center',
      marginTop: 10,
      paddingVertical: 4,
    },
    laterText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    pressed: { opacity: 0.75 },
  });
}
