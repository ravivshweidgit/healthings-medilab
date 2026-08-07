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
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatShortDate } from '../i18n/dateLocale';
import { getLabResultsStripCopy } from '../i18n/labResultsStripCopy';
import {
  LAB_CUSTOM_TREND_CODE_KEY,
  buildLabMarkerTrendSeries,
  buildLipidTrendPoints,
  exportLabLog,
  importLabLog,
  listLabTrendMarkerOptions,
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
import { LabMarkerTrendChart } from './LabMarkerTrendChart';

const EXPANDED_KEY = 'dash_lab_results_expanded';
const LIPID_EXPANDED_KEY = 'dash_lab_lipid_chart_expanded';
const CUSTOM_EXPANDED_KEY = 'dash_lab_custom_chart_expanded';

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
  const [lipidExpanded, setLipidExpanded] = useState(true);
  const [customExpanded, setCustomExpanded] = useState(true);
  const [customCode, setCustomCode] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const copy = getLabResultsStripCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const latest = reports[0] ?? null;
  const lipidTrendPoints = useMemo(() => buildLipidTrendPoints(reports), [reports]);
  const markerOptions = useMemo(() => listLabTrendMarkerOptions(reports), [reports]);
  const customSeries = useMemo(
    () => (customCode ? buildLabMarkerTrendSeries(reports, customCode) : null),
    [customCode, reports],
  );

  const filteredMarkers = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return markerOptions;
    return markerOptions.filter(
      (m) =>
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.unit && m.unit.toLowerCase().includes(q)),
    );
  }, [markerOptions, pickerQuery]);

  useEffect(() => {
    void (async () => {
      try {
        const [v, lip, cus, code] = await Promise.all([
          AsyncStorage.getItem(EXPANDED_KEY),
          AsyncStorage.getItem(LIPID_EXPANDED_KEY),
          AsyncStorage.getItem(CUSTOM_EXPANDED_KEY),
          AsyncStorage.getItem(LAB_CUSTOM_TREND_CODE_KEY),
        ]);
        if (v === 'true') setExpanded(true);
        if (lip === 'false') setLipidExpanded(false);
        if (cus === 'false') setCustomExpanded(false);
        if (code && code.trim()) setCustomCode(code.trim());
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    void AsyncStorage.setItem(EXPANDED_KEY, expanded ? 'true' : 'false');
  }, [expanded, prefsLoaded]);

  useEffect(() => {
    if (!prefsLoaded) return;
    void AsyncStorage.setItem(LIPID_EXPANDED_KEY, lipidExpanded ? 'true' : 'false');
  }, [lipidExpanded, prefsLoaded]);

  useEffect(() => {
    if (!prefsLoaded) return;
    void AsyncStorage.setItem(CUSTOM_EXPANDED_KEY, customExpanded ? 'true' : 'false');
  }, [customExpanded, prefsLoaded]);

  useEffect(() => {
    if (!prefsLoaded) return;
    if (customCode) void AsyncStorage.setItem(LAB_CUSTOM_TREND_CODE_KEY, customCode);
    else void AsyncStorage.removeItem(LAB_CUSTOM_TREND_CODE_KEY);
  }, [customCode, prefsLoaded]);

  /** Drop stale pick if that marker vanished after deletes. */
  useEffect(() => {
    if (!customCode) return;
    if (!markerOptions.some((m) => m.code === customCode)) setCustomCode(null);
  }, [customCode, markerOptions]);

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

  const handleDeleted = useCallback(() => {
    onReportsChanged();
    closeModal();
    Alert.alert(copy.deletedTitle, copy.deletedBody);
  }, [closeModal, onReportsChanged, copy.deletedTitle, copy.deletedBody]);

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

  const pickMarker = useCallback((code: string) => {
    setCustomCode(code);
    setPickerOpen(false);
    setPickerQuery('');
    setCustomExpanded(true);
  }, []);

  const clearMarker = useCallback(() => {
    setCustomCode(null);
    setPickerOpen(false);
    setPickerQuery('');
  }, []);

  const latestLine = latest
    ? `${formatDrawDate(latest.collectedAt, lang?.code)} · ${copy.testsCount(resultCount(latest))}`
    : copy.emptyHint;

  const selectedOption = customCode ? markerOptions.find((m) => m.code === customCode) : null;
  const customSubtitle = selectedOption
    ? `${selectedOption.name}${selectedOption.unit ? ` · ${selectedOption.unit}` : ''}`
    : copy.customPickPlaceholder;

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
        perfTag="LabResultsStrip"
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

      {lipidTrendPoints.length >= 1 ? (
        <View style={styles.nestedCard}>
          <DashboardCollapseHeader
            title={copy.lipidTrendsTitle}
            subtitle={
              lipidTrendPoints.length === 1
                ? copy.trendHint
                : copy.testsCount(lipidTrendPoints.length)
            }
            expanded={lipidExpanded}
            onToggle={() => setLipidExpanded((v) => !v)}
            titleRtl={rtl}
            collapseLabel={copy.lipidCollapseA11y}
            expandLabel={copy.lipidExpandA11y}
            subtitleNumberOfLines={2}
          />
          {lipidExpanded ? (
            lipidTrendPoints.length >= 2 ? (
              <LipidTrendChart
                points={lipidTrendPoints}
                rtl={rtl}
                gender={gender}
                langCode={lang?.code}
                hideTitle
              />
            ) : (
              <Text style={styles.nestedHint}>{copy.trendHint}</Text>
            )
          ) : null}
        </View>
      ) : null}

      <View style={styles.nestedCard}>
        <DashboardCollapseHeader
          title={copy.customTrendTitle}
          subtitle={customSubtitle}
          expanded={customExpanded}
          onToggle={() => setCustomExpanded((v) => !v)}
          titleRtl={rtl}
          collapseLabel={copy.customCollapseA11y}
          expandLabel={copy.customExpandA11y}
          subtitleNumberOfLines={1}
        />
        {customExpanded ? (
          <View style={styles.customBody}>
            {markerOptions.length === 0 ? (
              <Text style={styles.nestedHint}>{copy.customNoMarkers}</Text>
            ) : (
              <>
                <View style={[styles.pickerRow, rtl && styles.pickerRowRtl]}>
                  <Pressable
                    style={({ pressed }) => [styles.pickerBtn, pressed && styles.chipPressed]}
                    onPress={() => setPickerOpen((v) => !v)}
                    accessibilityLabel={copy.customPickPlaceholder}
                  >
                    <Text style={styles.pickerBtnText} numberOfLines={1}>
                      {selectedOption
                        ? `${selectedOption.name} (${selectedOption.code})`
                        : copy.customPickPlaceholder}
                    </Text>
                    <Text style={styles.pickerChevron}>{pickerOpen ? '▴' : '▾'}</Text>
                  </Pressable>
                  {customCode ? (
                    <Pressable onPress={clearMarker} accessibilityLabel={copy.customClear}>
                      <Text style={styles.clearText}>{copy.customClear}</Text>
                    </Pressable>
                  ) : null}
                </View>

                {pickerOpen ? (
                  <View style={styles.pickerPanel}>
                    <TextInput
                      style={[styles.searchInput, rtl && styles.textRtl]}
                      value={pickerQuery}
                      onChangeText={setPickerQuery}
                      placeholder={copy.customSearchPlaceholder}
                      placeholderTextColor={colors.textSecondary}
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                    <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                      {filteredMarkers.map((m) => (
                        <Pressable
                          key={m.code}
                          style={({ pressed }) => [
                            styles.pickerItem,
                            m.code === customCode && styles.pickerItemSelected,
                            pressed && styles.chipPressed,
                          ]}
                          onPress={() => pickMarker(m.code)}
                        >
                          <Text style={[styles.pickerItemName, rtl && styles.textRtl]} numberOfLines={1}>
                            {m.name}
                          </Text>
                          <Text style={styles.pickerItemMeta} numberOfLines={1}>
                            {m.code}
                            {m.unit ? ` · ${m.unit}` : ''} · {m.drawCount}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {customSeries && customSeries.points.length >= 2 ? (
                  <LabMarkerTrendChart
                    series={customSeries}
                    rtl={rtl}
                    langCode={lang?.code}
                    hideTitle
                  />
                ) : customCode ? (
                  <Text style={styles.nestedHint}>{copy.customNeedTwo}</Text>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </View>

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
        onDeleted={handleDeleted}
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
  nestedCard: {
    marginTop: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: c.gridLine,
  },
  nestedHint: {
    fontSize: 11,
    color: c.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  customBody: {
    marginTop: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  pickerRowRtl: {
    flexDirection: 'row-reverse',
  },
  pickerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.gridLine,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerBtnText: {
    flex: 1,
    fontSize: 13,
    color: c.textPrimary,
    fontWeight: '500',
  },
  pickerChevron: {
    fontSize: 12,
    color: c.textSecondary,
    marginLeft: 8,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.accentBlue,
  },
  pickerPanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 12,
    backgroundColor: c.background,
    overflow: 'hidden',
  },
  searchInput: {
    fontSize: 14,
    color: c.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.gridLine,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pickerList: {
    maxHeight: 180,
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.gridLine,
  },
  pickerItemSelected: {
    backgroundColor: c.surface,
  },
  pickerItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textPrimary,
  },
  pickerItemMeta: {
    fontSize: 11,
    color: c.textSecondary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 8,
  },
  footerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textSecondary,
  },
});
