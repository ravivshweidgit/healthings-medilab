/**
 * My Profile — collapsible Reports strip (Visit report today; room for more later).
 * Strip chrome title follows DashboardCollapseHeader (same as Food Log / glucose).
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
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import type { UserLanguage } from '../services/TargetService';

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
  lang?: UserLanguage | null;
};

export function ReportsStrip({
  expanded,
  onToggleExpand,
  busy,
  visitReportUi,
  onShareVisitReport,
  lang,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const headerSub = useMemo(
    () => VISIT_REPORT_DAY_OPTIONS.join(' / '),
    [],
  );

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={profileTitles.reports}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={lang?.code === 'he' || lang?.code === 'ar'}
        collapseLabel="Collapse Reports"
        expandLabel="Expand Reports"
      />

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
              <ActivityIndicator color={colors.accentBlue} />
              <Text style={styles.busyText}>{visitReportUi.busy}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    body: {
      marginTop: 8,
      gap: 8,
      paddingHorizontal: 4,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: c.textPrimary,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: c.textSecondary,
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
      borderColor: c.textSecondary,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    dayButtonDisabled: {
      opacity: 0.6,
    },
    dayButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textPrimary,
    },
    note: {
      fontSize: 11,
      color: c.textSecondary,
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
      color: c.textSecondary,
    },
  });
