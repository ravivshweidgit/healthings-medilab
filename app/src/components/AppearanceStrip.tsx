/**
 * PROFILE & SETTINGS — appearance (theme) preference (prompt96 Phase 4).
 *
 * Sits next to Language and Units. Writes `healthings:themePref` through the theme
 * context, so the change applies immediately and rides backup/restore.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAppearanceCopy } from '../i18n/appearanceCopy';
import type { UserLanguage } from '../services/TargetService';
import type { ThemePref } from '../services/ThemePreferenceService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { keepMountedCollapsedStyles, useKeepMountedExpand } from '../hooks/useKeepMountedExpand';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { SetupToggleRow } from './SetupToggleRow';

type Props = {
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
  /** Show Activity Log strip on the main dashboard. */
  activityLogVisible: boolean;
  onActivityLogVisibleChange: (visible: boolean) => void;
  /** Show cholesterol (lipid) trend charts under Lab results. */
  lipidChartsVisible: boolean;
  onLipidChartsVisibleChange: (visible: boolean) => void;
};

export function AppearanceStrip({
  expanded,
  onToggleExpand,
  lang,
  activityLogVisible,
  onActivityLogVisibleChange,
  lipidChartsVisible,
  onLipidChartsVisibleChange,
}: Props) {
  const { colors, isDark, pref, setThemePref } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const bodyMounted = useKeepMountedExpand(expanded);
  const t = getAppearanceCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const options: { id: ThemePref; label: string }[] = [
    { id: 'system', label: t.system },
    { id: 'light', label: t.light },
    { id: 'dark', label: t.dark },
  ];

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={t.title}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={rtl}
        collapseLabel={`Collapse ${t.title}`}
        expandLabel={`Expand ${t.title}`}
      />

      {bodyMounted ? (
        <View
          style={[styles.body, !expanded && keepMountedCollapsedStyles.bodyCollapsed]}
          pointerEvents={expanded ? 'auto' : 'none'}
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? 'yes' : 'no-hide-descendants'}
        >
          <View style={[styles.row, rtl && styles.rowRtl]}>
            <Text style={[styles.rowLabel, rtl && styles.rowLabelRtl]}>{t.theme}</Text>
            <View style={styles.chips}>
              {options.map((opt) => {
                const selected = opt.id === pref;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setThemePref(opt.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text style={[styles.hint, rtl && styles.textRtl]}>{t.hint}</Text>

          <View style={styles.dashPref}>
            <SetupToggleRow
              label={t.activityLog}
              value={activityLogVisible}
              yesLabel={t.yes}
              noLabel={t.no}
              onChange={onActivityLogVisibleChange}
              hint={t.activityLogHint}
            />
          </View>

          <View style={styles.dashPref}>
            <SetupToggleRow
              label={t.lipidCharts}
              value={lipidChartsVisible}
              yesLabel={t.yes}
              noLabel={t.no}
              onChange={onLipidChartsVisibleChange}
              hint={t.lipidChartsHint}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    body: {
      marginTop: 8,
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 8,
    },
    rowRtl: {
      flexDirection: 'row-reverse',
    },
    rowLabel: {
      width: 72,
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
    },
    rowLabelRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    // Matches the units pills: on dark the border alone carries selection.
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.gridLine,
      backgroundColor: isDark ? c.background : c.surface,
    },
    chipSelected: {
      borderColor: c.accentBlue,
      backgroundColor: isDark ? c.background : c.iconTintBlue,
    },
    chipText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    chipTextSelected: { color: c.accentBlue },
    hint: {
      fontSize: 11,
      color: c.textSecondary,
      lineHeight: 15,
      marginTop: 2,
    },
    textRtl: {
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    dashPref: { marginTop: 12 },
  });
