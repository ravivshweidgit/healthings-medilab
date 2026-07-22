/**
 * Lab results — dashboard card (same pattern as FoodMacroStrip).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatShortDate } from '../i18n/dateLocale';
import {
  buildLipidTrendPoints,
  exportLabLog,
  importLabLog,
  type LabReport,
} from '../services/LabLogService';
import type { Gender, UserLanguage } from '../services/TargetService';
import { WellnessColors, cardShadow, dashCardGap } from '../theme/wellness';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { LabReportModal } from './LabReportModal';
import { LipidTrendChart } from './LipidTrendChart';

const EXPANDED_KEY = 'dash_lab_results_expanded';

type Props = {
  reports: LabReport[];
  onReportsChanged: () => void;
  lang?: UserLanguage | null;
  gender?: Gender | null;
};

function formatDrawDate(iso: string, langCode?: string | null): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 10);
  return formatShortDate(t, langCode);
}

function panelLabel(report: LabReport): string {
  return report.panels.map((p) => p.panelType).join(' + ') || 'lab';
}

function resultCount(report: LabReport): number {
  return report.panels.reduce((n, p) => n + p.results.length, 0);
}

function highlightResult(report: LabReport): string | null {
  for (const panel of report.panels) {
    const ldl = panel.results.find((r) => r.code.includes('LDL') || r.code.includes('CHOLESTEROL'));
    if (ldl) return `${ldl.code} ${ldl.value}`;
    const glucose = panel.results.find((r) => r.code === 'GLUCOSE');
    if (glucose) return `GLUCOSE ${glucose.value}`;
  }
  return null;
}

export function LabResultsStrip({ reports, onReportsChanged, lang, gender }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [autoPick, setAutoPick] = useState(false);
  const [viewReport, setViewReport] = useState<LabReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const latest = reports[0] ?? null;
  const lipidTrendPoints = useMemo(() => buildLipidTrendPoints(reports), [reports]);

  useEffect(() => {
    void (async () => {
      try {
        const v = await AsyncStorage.getItem(EXPANDED_KEY);
        if (v === 'true') setExpanded(true);
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    void AsyncStorage.setItem(EXPANDED_KEY, expanded ? 'true' : 'false');
  }, [expanded, prefsLoaded]);

  const openImport = useCallback(() => {
    setViewReport(null);
    setAutoPick(true);
    setModalVisible(true);
  }, []);

  const openReport = useCallback((report: LabReport) => {
    setViewReport(report);
    setAutoPick(false);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setAutoPick(false);
    setViewReport(null);
  }, []);

  const handleSaved = useCallback(() => {
    onReportsChanged();
    closeModal();
    Alert.alert(
      rtl ? 'נשמר' : 'Saved',
      rtl ? 'המנטורים יכולים לראות את התוצאות' : 'Mentors can now see these results',
    );
  }, [closeModal, onReportsChanged, rtl]);

  const handleExport = useCallback(async () => {
    try {
      await exportLabLog();
    } catch (e: unknown) {
      Alert.alert(rtl ? 'ייצוא נכשל' : 'Export failed', e instanceof Error ? e.message : String(e));
    }
  }, [rtl]);

  const handleImport = useCallback(async () => {
    setBusy(true);
    try {
      const count = await importLabLog();
      if (count === 0) {
        Alert.alert(rtl ? 'ייבוא' : 'Import', rtl ? 'לא נמצאו דוחות חדשים' : 'No new reports in file');
      } else {
        Alert.alert(
          rtl ? 'ייבוא הושלם' : 'Import complete',
          rtl ? `${count} דוחות יובאו` : `${count} report${count === 1 ? '' : 's'} imported`,
        );
        onReportsChanged();
      }
    } catch (e: unknown) {
      Alert.alert(rtl ? 'ייבוא נכשל' : 'Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [onReportsChanged, rtl]);

  const sectionTitle = rtl ? 'תוצאות מעבדה' : 'LAB RESULTS';
  const addLabel = rtl ? 'הוסף דוח' : 'Add report';
  const latestLine = latest
    ? rtl
      ? `אחרון: ${formatDrawDate(latest.collectedAt, lang?.code)} · ${resultCount(latest)} בדיקות`
      : `Latest: ${formatDrawDate(latest.collectedAt, lang?.code)} · ${resultCount(latest)} tests`
    : rtl
      ? 'ייבאו PDF מכללית און־ליין'
      : 'Import a Clalit online lab PDF';

  return (
    <View style={[styles.card, cardShadow, !expanded && styles.cardCollapsed]}>
      <DashboardCollapseHeader
        title={sectionTitle}
        subtitle={latestLine}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        titleRtl={rtl}
        collapseLabel={rtl ? 'כווץ תוצאות מעבדה' : 'Collapse lab results'}
        expandLabel={rtl ? 'הרחב תוצאות מעבדה' : 'Expand lab results'}
        subtitleNumberOfLines={2}
      />

      {expanded ? (
      <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Pressable
          style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.chipPressed]}
          onPress={openImport}
          accessibilityLabel={addLabel}
        >
          <Text style={styles.addChipIcon}>＋</Text>
          <Text style={styles.addChipLabel}>{addLabel}</Text>
        </Pressable>
        {reports.map((r) => {
          const hi = highlightResult(r);
          return (
            <Pressable
              key={r.id}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={() => openReport(r)}
            >
              <Text style={styles.chipDate}>{formatDrawDate(r.collectedAt, lang?.code)}</Text>
              <Text style={styles.chipLabel}>{panelLabel(r)}</Text>
              <Text style={styles.chipMeta}>
                {resultCount(r)} {rtl ? 'בדיקות' : 'tests'}
              </Text>
              {hi ? <Text style={styles.chipHi}>{hi}</Text> : null}
              <Text style={styles.chipEdit}>✎ {rtl ? 'צפייה' : 'view'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {lipidTrendPoints.length >= 2 ? (
        <LipidTrendChart points={lipidTrendPoints} rtl={rtl} gender={gender} langCode={lang?.code} />
      ) : lipidTrendPoints.length === 1 ? (
        <Text style={styles.trendHint}>
          {rtl ? 'ייבאו דוח נוסף כדי לראות מגמת כולסטרול' : 'Import another draw to see cholesterol trends'}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={() => void handleExport()} accessibilityLabel="Export lab log">
          <Text style={styles.footerBtnText}>⬆ {rtl ? 'ייצוא' : 'Export'}</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => void handleImport()} disabled={busy} accessibilityLabel="Import lab log">
          {busy ? (
            <ActivityIndicator size="small" color={WellnessColors.textSecondary} />
          ) : (
            <Text style={styles.footerBtnText}>⬇ {rtl ? 'ייבוא' : 'Import'}</Text>
          )}
        </Pressable>
      </View>
      </>
      ) : null}

      <LabReportModal
        visible={modalVisible}
        autoPickPdf={autoPick}
        viewReport={viewReport}
        lang={lang}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    marginBottom: dashCardGap,
  },
  cardCollapsed: {
    paddingBottom: 8,
  },
  chipsRow: { gap: 8, paddingBottom: 2, paddingTop: 4 },
  chip: {
    backgroundColor: WellnessColors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    minWidth: 100,
  },
  chipPressed: {
    opacity: 0.7,
    borderColor: WellnessColors.accentBlue,
  },
  addChip: {
    borderStyle: 'dashed',
    borderColor: WellnessColors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    paddingVertical: 10,
  },
  addChipIcon: {
    fontSize: 22,
    color: WellnessColors.accentBlue,
    fontWeight: '300',
    lineHeight: 26,
  },
  addChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.accentBlue,
    marginTop: 2,
  },
  chipDate: {
    fontSize: 10,
    color: WellnessColors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  chipMeta: {
    fontSize: 11,
    color: WellnessColors.accentBlue,
    fontWeight: '600',
    marginTop: 2,
  },
  chipHi: {
    fontSize: 10,
    color: WellnessColors.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chipEdit: {
    fontSize: 10,
    color: WellnessColors.accentBlue,
    marginTop: 2,
  },
  trendHint: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: WellnessColors.gridLine,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: WellnessColors.gridLine,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: WellnessColors.progressTrack,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },
});
