/**
 * My Profile — collapsible Reports strip (Visit report today; room for more later).
 * Strip chrome is English only (see .cursor/rules/language-policy.mdc).
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  VISIT_REPORT_DAY_OPTIONS,
  type VisitReportDayCount,
} from '../services/visitReportService';
import { WellnessColors } from '../theme/wellness';

export type VisitReportUiCopy = {
  title: string;
  subtitle: string;
  dayLabel: (n: number) => string;
  busy: string;
  doneTitle: string;
  doneMessage: string;
  errorTitle: string;
  cgmNote: string;
};

type Props = {
  expanded: boolean;
  onToggleExpand: () => void;
  busy: boolean;
  visitReportUi: VisitReportUiCopy;
  onShareVisitReport: (days: VisitReportDayCount) => void;
};

export function ReportsStrip({
  expanded,
  onToggleExpand,
  busy,
  visitReportUi,
  onShareVisitReport,
}: Props) {
  const headerSub = useMemo(
    () =>
      `Visit report · ${VISIT_REPORT_DAY_OPTIONS.join(' / ')} days`,
    [],
  );

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.headerRow}
        onPress={onToggleExpand}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Collapse Reports' : 'Expand Reports'}
      >
        <Text style={styles.headerIcon}>📄</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Reports</Text>
          {!expanded ? (
            <Text style={styles.headerSub} numberOfLines={2}>
              {headerSub}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>{visitReportUi.title}</Text>
          <Text style={styles.sectionSubtitle}>{visitReportUi.subtitle}</Text>
          <View style={styles.buttonGrid}>
            {VISIT_REPORT_DAY_OPTIONS.map((days) => (
              <Pressable
                key={days}
                style={[styles.dayButton, busy && styles.dayButtonDisabled]}
                onPress={() => onShareVisitReport(days)}
                disabled={busy}
              >
                <Text style={styles.dayButtonText}>{visitReportUi.dayLabel(days)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>{visitReportUi.cgmNote}</Text>
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={WellnessColors.accentBlue} />
              <Text style={styles.busyText}>{visitReportUi.busy}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  headerSub: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: WellnessColors.textSecondary,
  },
  body: {
    marginTop: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 17,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  dayButton: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: WellnessColors.textSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WellnessColors.surface,
  },
  dayButtonDisabled: {
    opacity: 0.6,
  },
  dayButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  note: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    lineHeight: 15,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  busyText: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
  },
});
