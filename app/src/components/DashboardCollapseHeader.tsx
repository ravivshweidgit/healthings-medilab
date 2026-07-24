/**
 * Shared collapsible strip header — Food Log, glucose, trend, profile, labs, reports.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  ViewStyle,
} from 'react-native';
import { WellnessColors } from '../theme/wellness';

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
}: Props) {
  const showSub = !expanded && subtitle != null && subtitle !== '';

  return (
    <Pressable
      style={[styles.header, style]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expanded ? collapseLabel : expandLabel}
    >
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

/** Canonical strip-header tokens — keep in sync if duplicating elsewhere. */
export const dashStripHeaderStyles = StyleSheet.create({
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
    color: WellnessColors.textSecondary,
  },
  titleRtl: {
    letterSpacing: 0,
    writingDirection: 'rtl',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    marginTop: 2,
  },
  subtitleRtl: {
    writingDirection: 'rtl',
  },
  chevron: {
    fontSize: 18,
    color: WellnessColors.textSecondary,
    paddingHorizontal: 4,
  },
  // Single chevron affordance: rotate the collapsed ▾ to point up when expanded,
  // so expand/collapse reads as one control everywhere (no mixed › / ⌃ glyphs).
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
});

const styles = dashStripHeaderStyles;
