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
import { getLabResultsStripCopy } from '../i18n/labResultsStripCopy';
import {
  buildLipidTrendPoints,
  exportLabLog,
  importLabLog,
  type LabReport,
} from '../services/LabLogService';
import type { Gender, UserLanguage } from '../services/TargetService';
import { cardShadow, dashCardGap } from '../theme/wellness';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { StripIcons } from '../theme/icons';
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [modalVisible, setModalVisible] = useState(false);
  const [autoPick, setAutoPick] = useState(false);
  const [viewReport, setViewReport] = useState<LabReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const copy = getLabResultsStripCopy(lang?.code);
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
    Alert.alert(copy.savedTitle, copy.savedBody);
  }, [closeModal, onReportsChanged, copy.savedTitle, copy.savedBody]);

  const handleExport = useCallback(async () => {
    try {
      await exportLabLog();
    } catch (e: unknown) {
      Alert.alert(copy.exportFailed, e instanceof Error ? e.message : String(e));
    }
  }, [copy.exportFailed]);

  const handleImport = useCallback(async () => {
    setBusy(true);
    try {
      const count = await importLabLog();
      if (count === 0) {
        Alert.alert(copy.importTitle, copy.importNone);
      } else {
        Alert.alert(copy.importComplete, copy.importCount(count));
        onReportsChanged();
      }
    } catch (e: unknown) {
      Alert.alert(copy.importFailed, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [onReportsChanged, copy]);

  const latestLine = latest
    ? `${formatDrawDate(latest.collectedAt, lang?.code)} · ${copy.testsCount(resultCount(latest))}`
    : copy.emptyHint;

  return (
    <View style={[styles.card, cardShadow, !expanded && styles.cardCollapsed]}>
      <DashboardCollapseHeader
        title={copy.title}
        subtitle={latestLine}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        titleRtl={rtl}
        collapseLabel={copy.collapseA11y}
        expandLabel={copy.expandA11y}
        subtitleNumberOfLines={1}
        icon={StripIcons.labs}
      />

      {expanded ? (
      <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Pressable
          style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.chipPressed]}
          onPress={openImport}
          accessibilityLabel={copy.addReport}
        >
          <Text style={styles.addChipIcon}>＋</Text>
          <Text style={styles.addChipLabel}>{copy.addReport}</Text>
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
                {copy.testsCount(resultCount(r))}
              </Text>
              {hi ? <Text style={styles.chipHi}>{hi}</Text> : null}
              <Text style={styles.chipEdit}>✎ {copy.view}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {lipidTrendPoints.length >= 2 ? (
        <LipidTrendChart points={lipidTrendPoints} rtl={rtl} gender={gender} langCode={lang?.code} />
      ) : lipidTrendPoints.length === 1 ? (
        <Text style={styles.trendHint}>{copy.trendHint}</Text>
      ) : null}

      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={() => void handleExport()} accessibilityLabel={copy.exportLabel}>
          <Text style={styles.footerBtnText}>⬆ {copy.exportLabel}</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={() => void handleImport()} disabled={busy} accessibilityLabel={copy.importLabel}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={styles.footerBtnText}>⬇ {copy.importLabel}</Text>
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

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  card: {
    backgroundColor: c.surface,
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
    backgroundColor: c.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: c.gridLine,
    minWidth: 100,
  },
  chipPressed: {
    opacity: 0.7,
    borderColor: c.accentBlue,
  },
  addChip: {
    borderStyle: 'dashed',
    borderColor: c.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    paddingVertical: 10,
  },
  addChipIcon: {
    fontSize: 22,
    color: c.accentBlue,
    fontWeight: '300',
    lineHeight: 26,
  },
  addChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: c.accentBlue,
    marginTop: 2,
  },
  chipDate: {
    fontSize: 10,
    color: c.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textPrimary,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  chipMeta: {
    fontSize: 11,
    color: c.accentBlue,
    fontWeight: '600',
    marginTop: 2,
  },
  chipHi: {
    fontSize: 10,
    color: c.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chipEdit: {
    fontSize: 10,
    color: c.accentBlue,
    marginTop: 2,
  },
  trendHint: {
    fontSize: 11,
    color: c.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.gridLine,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.gridLine,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: c.progressTrack,
    borderWidth: 1,
    borderColor: c.gridLine,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textSecondary,
  },
});
