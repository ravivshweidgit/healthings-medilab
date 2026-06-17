/**
 * Lab report import modal — PDF pick, AI parse, review, save; view saved reports.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { parseLabReportPdf } from '../services/GeminiService';
import {
  readPdfBase64FromUri,
  saveParsedLabPanel,
  updateLabReport,
  type LabPanel,
  type LabReport,
  type LabResult,
  type ParsedLabPdf,
} from '../services/LabLogService';
import type { UserLanguage } from '../services/TargetService';
import { WellnessColors } from '../theme/wellness';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (report: LabReport) => void;
  lang?: UserLanguage | null;
  autoPickPdf?: boolean;
  viewReport?: LabReport | null;
};

function flagColor(flag: LabResult['flag']): string {
  if (flag === 'high') return '#E65100';
  if (flag === 'low') return '#1565C0';
  if (flag === 'normal') return '#2E7D32';
  return WellnessColors.textSecondary;
}

export function LabReportModal({ visible, onClose, onSaved, lang, autoPickPdf, viewReport }: Props) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<ParsedLabPdf | null>(null);
  const [editingReport, setEditingReport] = useState<LabReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const reset = useCallback(() => {
    setDraft(null);
    setEditingReport(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  useEffect(() => {
    if (visible && viewReport) {
      setEditingReport(JSON.parse(JSON.stringify(viewReport)) as LabReport);
      setDraft(null);
    }
  }, [visible, viewReport]);

  const pickAndParse = useCallback(async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) {
      if (autoPickPdf) onClose();
      return;
    }
    setLoading(true);
    try {
      const base64 = await readPdfBase64FromUri(result.assets[0].uri);
      const { parsed } = await parseLabReportPdf(base64, lang);
      setDraft(parsed);
      setEditingReport(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not read PDF';
      setError(msg);
      if (autoPickPdf) {
        Alert.alert(rtl ? 'שגיאה' : 'Error', msg);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }, [autoPickPdf, lang, onClose, rtl]);

  useEffect(() => {
    if (visible && autoPickPdf && !draft && !loading && !viewReport) {
      void pickAndParse();
    }
  }, [visible, autoPickPdf, draft, loading, pickAndParse, viewReport]);

  const updateDraftResult = useCallback((index: number, patch: Partial<LabResult>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const results = prev.results.map((r, i) => (i === index ? { ...r, ...patch } : r));
      return { ...prev, results };
    });
  }, []);

  const removeDraftResult = useCallback((index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, results: prev.results.filter((_, i) => i !== index) };
    });
  }, []);

  const updateViewResult = useCallback(
    (panelIndex: number, resultIndex: number, patch: Partial<LabResult>) => {
      setEditingReport((prev) => {
        if (!prev) return prev;
        const panels = prev.panels.map((p, pi) => {
          if (pi !== panelIndex) return p;
          const results = p.results.map((r, ri) => (ri === resultIndex ? { ...r, ...patch } : r));
          return { ...p, results };
        });
        return { ...prev, panels };
      });
    },
    [],
  );

  const handleSaveImport = useCallback(async () => {
    if (!draft || draft.results.length === 0) return;
    setLoading(true);
    try {
      const saved = await saveParsedLabPanel(draft);
      onSaved(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }, [draft, onSaved]);

  const handleSaveView = useCallback(async () => {
    if (!editingReport) return;
    setLoading(true);
    try {
      await updateLabReport(editingReport);
      onSaved(editingReport);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }, [editingReport, onSaved]);

  const title = rtl ? 'תוצאות מעבדה' : 'Lab results';
  const saveLabel = rtl ? 'שמור' : 'Save';
  const pickLabel = rtl ? 'בחר PDF' : 'Choose PDF';
  const loadingLabel = rtl ? 'קורא את הדוח…' : 'Reading lab report…';

  const renderResultRow = (
    r: LabResult,
    key: string,
    onValue: (v: number) => void,
    onUnit: (u: string) => void,
    onDelete?: () => void,
  ) => (
    <View key={key} style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.code}>{r.nameOriginal ?? r.code}</Text>
        <View style={styles.valueRow}>
          <TextInput
            style={styles.valueInput}
            value={String(r.value)}
            keyboardType="decimal-pad"
            onChangeText={(t) => {
              const v = parseFloat(t);
              if (!Number.isFinite(v)) return;
              onValue(v);
            }}
          />
          <TextInput style={styles.unitInput} value={r.unit} onChangeText={onUnit} />
        </View>
        {r.referenceText ? <Text style={styles.refText}>{r.referenceText}</Text> : null}
        <Text style={[styles.flag, { color: flagColor(r.flag) }]}>{r.flag}</Text>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteBtn}>🗑</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={WellnessColors.accentBlue} />
            <Text style={styles.loadingText}>{loadingLabel}</Text>
          </View>
        )}

        {!loading && !draft && !editingReport && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>
              {rtl ? 'ייבאו תדפיס PDF מכללית און־ליין' : 'Import a Clalit online lab PDF'}
            </Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable style={styles.primaryBtn} onPress={() => void pickAndParse()}>
              <Text style={styles.primaryBtnText}>📄 {pickLabel}</Text>
            </Pressable>
          </View>
        )}

        {!loading && draft && (
          <>
            <Text style={styles.meta}>
              {draft.panelType.toUpperCase()} · {draft.collectedAt.slice(0, 10)}
              {draft.patientName ? ` · ${draft.patientName}` : ''}
            </Text>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {draft.results.map((r, i) =>
                renderResultRow(
                  r,
                  `${r.code}-${i}`,
                  (v) => updateDraftResult(i, { value: v }),
                  (unit) => updateDraftResult(i, { unit }),
                  () => removeDraftResult(i),
                ),
              )}
            </ScrollView>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.footer}>
              <Pressable style={styles.primaryBtn} onPress={() => void handleSaveImport()}>
                <Text style={styles.primaryBtnText}>✓ {saveLabel}</Text>
              </Pressable>
            </View>
          </>
        )}

        {!loading && editingReport && (
          <>
            <Text style={styles.meta}>
              {editingReport.collectedAt.slice(0, 10)}
              {editingReport.patientName ? ` · ${editingReport.patientName}` : ''}
              {' · '}
              {editingReport.panels.map((p: LabPanel) => p.panelType).join(' + ')}
            </Text>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              {editingReport.panels.map((panel, pi) => (
                <View key={panel.id}>
                  <Text style={styles.panelTitle}>{panel.panelType.toUpperCase()}</Text>
                  {panel.results.map((r, ri) =>
                    renderResultRow(
                      r,
                      `${panel.id}-${r.code}-${ri}`,
                      (v) => updateViewResult(pi, ri, { value: v }),
                      (unit) => updateViewResult(pi, ri, { unit }),
                    ),
                  )}
                </View>
              ))}
            </ScrollView>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.footer}>
              <Pressable style={styles.primaryBtn} onPress={() => void handleSaveView()}>
                <Text style={styles.primaryBtnText}>✓ {saveLabel}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WellnessColors.background, paddingTop: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: WellnessColors.textPrimary },
  closeBtn: { fontSize: 22, color: WellnessColors.textSecondary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: WellnessColors.textSecondary },
  emptyWrap: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 15, color: WellnessColors.textSecondary, textAlign: 'center' },
  meta: { fontSize: 12, color: WellnessColors.textSecondary, paddingHorizontal: 20, marginBottom: 8 },
  panelTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: WellnessColors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: WellnessColors.gridLine,
    paddingVertical: 10,
    gap: 8,
  },
  rowMain: { flex: 1 },
  code: { fontSize: 13, fontWeight: '700', color: WellnessColors.textPrimary },
  valueRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  valueInput: {
    minWidth: 72,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    color: WellnessColors.textPrimary,
  },
  unitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: WellnessColors.textSecondary,
  },
  refText: { fontSize: 11, color: WellnessColors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  flag: { fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
  deleteBtn: { fontSize: 18, paddingTop: 4 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: WellnessColors.gridLine },
  primaryBtn: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorText: { fontSize: 12, color: '#E53935', paddingHorizontal: 20, marginTop: 8 },
});
