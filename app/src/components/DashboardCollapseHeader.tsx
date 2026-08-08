/**
 * Shared collapsible strip header — Food Log, glucose, trend, profile, labs, reports.
 */

import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  ViewStyle,
} from 'react-native';
import { logStripToggle } from '../services/AppDailyLogService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { DashIcon, type LucideIcon } from '../theme/icons';

type Props = {
  title: string;
  /** Collapsed subtitle — string or nested Text nodes (e.g. colored kcal). */
  subtitle?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  titleRtl?: boolean;
  style?: StyleProp<ViewStyle>;
  collapseLabel: string;
  expandLabel: string;
  /** Default 1 — profile/labs may pass 2. */
  subtitleNumberOfLines?: number;
  /** Optional controls before the chevron (e.g. edit / reset). */
  trailing?: React.ReactNode;
  /** Optional leading chrome icon (Lucide) — audit F7 / prompt94. */
  icon?: LucideIcon;
  /** Stable English method/component id for perf logs — never UI title. Required to log. */
  perfTag?: string;
};

export function DashboardCollapseHeader({
  title,
  subtitle,
  expanded,
  onToggle,
  titleRtl,
  style,
  collapseLabel,
  expandLabel,
  subtitleNumberOfLines = 1,
  trailing,
  icon,
  perfTag,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const showSub = !expanded && subtitle != null && subtitle !== '';

  return (
    <Pressable
      style={[styles.header, style]}
      onPress={() => {
        const expanding = !expanded;
        if (perfTag) logStripToggle(perfTag, expanding);
        onToggle();
      }}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expanded ? collapseLabel : expandLabel}
    >
      {icon ? <DashIcon icon={icon} color={colors.chromeIcon} /> : null}
      <View style={styles.headerText}>
        <Text style={[styles.title, titleRtl && styles.titleRtl]} numberOfLines={1}>
          {title}
        </Text>
        {showSub ? (
          <Text
            style={[styles.subtitle, titleRtl && styles.subtitleRtl]}
            numberOfLines={subtitleNumberOfLines}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      <Text style={[styles.chevron, expanded && styles.chevronExpanded]}>▾</Text>
    </Pressable>
  );
}

/** Canonical strip-header tokens — themed factory (prompt96 Phase 2). */
const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: c.stripTitle,
    },
    titleRtl: {
      letterSpacing: 0,
      writingDirection: 'rtl',
    },
    subtitle: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textPrimary,
      marginTop: 2,
    },
    subtitleRtl: {
      writingDirection: 'rtl',
    },
    chevron: {
      fontSize: 18,
      color: c.textSecondary,
      paddingHorizontal: 4,
    },
    // Single chevron affordance: rotate the collapsed ▾ to point up when expanded,
    // so expand/collapse reads as one control everywhere (no mixed › / ⌃ glyphs).
    chevronExpanded: {
      transform: [{ rotate: '180deg' }],
    },
  });
