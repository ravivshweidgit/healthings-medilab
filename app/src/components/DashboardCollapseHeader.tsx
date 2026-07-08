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
  subtitle?: string | null;
  expanded: boolean;
  onToggle: () => void;
  titleRtl?: boolean;
  style?: StyleProp<ViewStyle>;
  collapseLabel: string;
  expandLabel: string;
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
}: Props) {
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
        {!expanded && subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 13,
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: WellnessColors.textSecondary,
    paddingHorizontal: 4,
  },
});
