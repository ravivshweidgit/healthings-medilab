/**
 * Lab report import modal — PDF pick, AI parse, review, save; view saved reports.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { identifyLabPdfProvider, parseLabReportPdf } from '../services/GeminiService';
import {
  fetchLabCountries,
  fetchLabCountryCatalog,
  providerDisplayName,
  type LabCountryCatalog,
  type LabCountryInfo,
} from '../services/LabCatalogService';
import { getLabCountry, setLabCountry, clearLabCountry } from '../services/LabCountryService';
import {
  deleteLabReport,
  readPdfBase64FromUri,
  saveParsedLabPanel,
  updateLabReport,
  type LabPanel,
  type LabProvider,
  type LabReport,
  type LabResult,
  type ParsedLabPdf,
} from '../services/LabLogService';
import { applyAutoMacroRevision } from '../logic/macroAutoAdjust';
import { getLabResultsStripCopy } from '../i18n/labResultsStripCopy';
import type { UserLanguage } from '../services/TargetService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (report: LabReport) => void;
  /** Fired after a saved report is removed from the phone. */
  onDeleted?: () => void;
  /** Fired when lab country is chosen or changed (prompt113). */
  onLabCountryChanged?: () => void;
  lang?: UserLanguage | null;
  autoPickPdf?: boolean;
  viewReport?: LabReport | null;
};

function flagColor(flag: LabResult['flag'], fallback: string): string {
  if (flag === 'high') return '#E65100';
  if (flag === 'low') return '#1565C0';
  if (flag === 'normal') return '#2E7D32';
  return fallback;
}

type LoadingPhase = 'identify' | 'parse' | 'save' | 'catalog' | null;

function bottomInset(insetsBottom: number): number {
  if (insetsBottom > 0) return insetsBottom;
  return Platform.OS === 'android' ? 48 : 16;
}

export function LabReportModal({
  visible,
  onClose,
  onSaved,
  onDeleted,
  onLabCountryChanged,
  lang,
  autoPickPdf,
  viewReport,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const footerPadBottom = bottomInset(insets.bottom);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>(null);
  const [draft, setDraft] = useState<ParsedLabPdf | null>(null);
  const [editingReport, setEditingReport] = useState<LabReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** PDF bytes waiting for HMO confirm (prompt112). */
  const [pendingPdfBase64, setPendingPdfBase64] = useState<string | null>(null);
  const [suggestedProvider, setSuggestedProvider] = useState<LabProvider>('unknown');
  const [labCountry, setLabCountryState] = useState<string | null>(null);
  const [countries, setCountries] = useState<LabCountryInfo[]>([]);
  const [catalog, setCatalog] = useState<LabCountryCatalog | null>(null);
  const [countryReady, setCountryReady] = useState(false);
  const autoPickStartedRef = useRef(false);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  const copy = getLabResultsStripCopy(lang?.code);
  const loading = loadingPhase != null;

  const reset = useCallback(() => {
    setDraft(null);
    setEditingReport(null);
    setError(null);
    setLoadingPhase(null);
    setPendingPdfBase64(null);
    setSuggestedProvider('unknown');
    autoPickStartedRef.current = false;
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  useEffect(() => {
    if (!visible || viewReport) return;
    let cancelled = false;
    void (async () => {
      setCountryReady(false);
      const code = await getLabCountry();
      const list = await fetchLabCountries();
      if (cancelled) return;
      setCountries(list);
      setLabCountryState(code);
      if (code) {
        const cat = await fetchLabCountryCatalog(code);
        if (!cancelled) setCatalog(cat);
      } else {
        setCatalog(null);
      }
      if (!cancelled) setCountryReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, viewReport]);

  useEffect(() => {
    if (visible && viewReport) {
      setEditingReport(JSON.parse(JSON.stringify(viewReport)) as LabReport);
      setDraft(null);
      setPendingPdfBase64(null);
      setCountryReady(true);
    }
  }, [visible, viewReport]);

  const providerLabel = useCallback(
    (provider: LabProvider): string => {
      if (provider === 'unknown') return copy.providerNotSure;
      const fromCat = catalog?.providers.find((p) => p.code === provider);
      if (fromCat) return providerDisplayName(fromCat);
      return provider;
    },
    [catalog, copy.providerNotSure],
  );

  const chooseCountry = useCallback(
    async (code: string) => {
      setError(null);
      setLoadingPhase('catalog');
      try {
        await setLabCountry(code);
        const cat = await fetchLabCountryCatalog(code);
        setLabCountryState(code);
        setCatalog(cat);
        onLabCountryChanged?.();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not save country');
      } finally {
        setLoadingPhase(null);
      }
    },
    [onLabCountryChanged],
  );

  const runParseWithProvider = useCallback(
    async (base64: string, provider: LabProvider) => {
      setPendingPdfBase64(null);
      setLoadingPhase('parse');
      try {
        const allowed = catalog?.providers.map((p) => p.code);
        const { parsed } = await parseLabReportPdf(base64, lang, false, {
          provider,
          packs: catalog?.packs,
          allowedProviders: allowed,
        });
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
        setLoadingPhase(null);
      }
    },
    [autoPickPdf, catalog, lang, onClose, rtl],
  );

  const pickAndParse = useCallback(async () => {
    if (!labCountry) {
      setError(copy.countryRequired);
      return;
    }
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) {
      if (autoPickPdf) onClose();
      return;
    }
    setLoadingPhase('identify');
    try {
      const base64 = await readPdfBase64FromUri(result.assets[0].uri);
      const allowed = catalog?.providers.map((p) => p.code) ?? [];
      // No country providers yet → skip identify, parse with default pack.
      if (allowed.length === 0) {
        await runParseWithProvider(base64, 'unknown');
        return;
      }
      const id = await identifyLabPdfProvider(base64, false, {
        packs: catalog?.packs,
        allowedProviders: allowed,
      });
      const skipConfirm =
        id.confidence === 'high' &&
        id.labProvider !== 'meuhedet' &&
        id.labProvider !== 'unknown' &&
        allowed.includes(id.labProvider);
      if (skipConfirm) {
        await runParseWithProvider(base64, id.labProvider);
        return;
      }
      // Always confirm Meuhedet (or low / unknown).
      setSuggestedProvider(id.labProvider);
      setPendingPdfBase64(base64);
      setLoadingPhase(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not read PDF';
      setError(msg);
      setLoadingPhase(null);
      if (autoPickPdf) {
        Alert.alert(rtl ? 'שגיאה' : 'Error', msg);
        onClose();
      }
    }
  }, [
    autoPickPdf,
    catalog,
    copy.countryRequired,
    labCountry,
    onClose,
    rtl,
    runParseWithProvider,
  ]);

  useEffect(() => {
    if (!visible) {
      autoPickStartedRef.current = false;
      return;
    }
    if (
      autoPickPdf &&
      countryReady &&
      labCountry &&
      !autoPickStartedRef.current &&
      !draft &&
      !loading &&
      !viewReport &&
      !pendingPdfBase64
    ) {
      autoPickStartedRef.current = true;
      void pickAndParse();
    }
  }, [
    visible,
    autoPickPdf,
    countryReady,
    labCountry,
    draft,
    loading,
    pickAndParse,
    viewReport,
    pendingPdfBase64,
  ]);

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
    setLoadingPhase('save');
    try {
      const saved = await saveParsedLabPanel(draft);
      onSaved(saved);
      // Macro revision uses Gemini separately — run after modal closes so we don't re-show "reading PDF".
      void applyAutoMacroRevision({
        trigger: 'lab-import',
        triggerDetail: saved.collectedAt.slice(0, 10),
        labReportId: saved.id,
      }).catch(() => {
        // Non-fatal: labs are saved; macro proposal can be run manually from targets strip.
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setLoadingPhase(null);
    }
  }, [draft, onSaved]);

  const handleSaveView = useCallback(async () => {
    if (!editingReport) return;
    setLoadingPhase('save');
    try {
      await updateLabReport(editingReport);
      onSaved(editingReport);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setLoadingPhase(null);
    }
  }, [editingReport, onSaved]);

  const handleDeleteReport = useCallback(() => {
    if (!editingReport) return;
    Alert.alert(copy.deleteConfirmTitle, copy.deleteConfirmBody, [
      { text: copy.deleteCancel, style: 'cancel' },
      {
        text: copy.deleteReport,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLoadingPhase('save');
            try {
              await deleteLabReport(editingReport.id);
              onDeleted?.();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : copy.deleteFailed);
              setLoadingPhase(null);
            }
          })();
        },
      },
    ]);
  }, [editingReport, copy, onDeleted]);

  const title = copy.modalTitle;
  const saveLabel = copy.save;
  const pickLabel = copy.choosePdf;
  const loadingLabel =
    loadingPhase === 'save'
      ? copy.saving
      : loadingPhase === 'identify'
        ? copy.identifyingPdf
        : loadingPhase === 'catalog'
          ? copy.loadingCountries
          : copy.reading;

  const suggestedLabel = providerLabel(suggestedProvider);

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
        {r.refLow != null && r.refHigh != null ? (
          <Text style={styles.refText}>{`${r.refLow}–${r.refHigh} ${r.unit}`.trim()}</Text>
        ) : r.referenceText ? (
          <Text style={styles.refText}>{r.referenceText}</Text>
        ) : null}
        <Text style={[styles.flag, { color: flagColor(r.flag, colors.textSecondary) }]}>{r.flag}</Text>
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeBtn}>✕</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentBlue} />
            <Text style={styles.loadingText}>{loadingLabel}</Text>
          </View>
        )}

        {!loading && !draft && !editingReport && !pendingPdfBase64 && countryReady && !labCountry && (
          <View style={styles.confirmWrap}>
            <Text style={[styles.confirmTitle, rtl && styles.textRtl]}>{copy.countryPickerTitle}</Text>
            <Text style={[styles.confirmBody, rtl && styles.textRtl]}>{copy.countryPickerBody}</Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.providerGrid}>
              {countries.map((c) => (
                <Pressable
                  key={c.code}
                  style={styles.providerChip}
                  onPress={() => void chooseCountry(c.code)}
                >
                  <Text style={styles.providerChipText}>{c.displayName || c.nameEn}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!loading && !draft && !editingReport && !pendingPdfBase64 && countryReady && labCountry && (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, rtl && styles.textRtl]}>
              {rtl ? 'ייבאו תדפיס PDF ממעבדה' : 'Import a lab PDF'}
            </Text>
            <Text style={[styles.confirmBody, rtl && styles.textRtl]}>
              {copy.countrySelectedLabel(
                catalog?.country.displayName
                  || countries.find((c) => c.code === labCountry)?.displayName
                  || labCountry,
              )}
            </Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable style={styles.primaryBtn} onPress={() => void pickAndParse()}>
              <Text style={styles.primaryBtnText}>📄 {pickLabel}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                void clearLabCountry().then(() => {
                  setLabCountryState(null);
                  setCatalog(null);
                  autoPickStartedRef.current = false;
                  onLabCountryChanged?.();
                });
              }}
            >
              <Text style={styles.secondaryBtnText}>{copy.changeCountry}</Text>
            </Pressable>
          </View>
        )}

        {!loading && !countryReady && !viewReport && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentBlue} />
            <Text style={styles.loadingText}>{copy.loadingCountries}</Text>
          </View>
        )}

        {!loading && pendingPdfBase64 && (
          <View style={styles.confirmWrap}>
            <Text style={[styles.confirmTitle, rtl && styles.textRtl]}>{copy.providerConfirmTitle}</Text>
            <Text style={[styles.confirmBody, rtl && styles.textRtl]}>
              {suggestedProvider === 'unknown'
                ? copy.providerConfirmUnknownBody
                : copy.providerConfirmBody(suggestedLabel)}
            </Text>
            {error && <Text style={styles.errorText}>{error}</Text>}
            {suggestedProvider !== 'unknown' ? (
              <Pressable
                style={styles.primaryBtn}
                onPress={() => void runParseWithProvider(pendingPdfBase64, suggestedProvider)}
              >
                <Text style={styles.primaryBtnText}>{copy.providerContinue(suggestedLabel)}</Text>
              </Pressable>
            ) : null}
            <View style={styles.providerGrid}>
              {(catalog?.providers ?? []).map((p) => (
                <Pressable
                  key={p.code}
                  style={[
                    styles.providerChip,
                    suggestedProvider === p.code && styles.providerChipActive,
                  ]}
                  onPress={() => void runParseWithProvider(pendingPdfBase64, p.code)}
                >
                  <Text
                    style={[
                      styles.providerChipText,
                      suggestedProvider === p.code && styles.providerChipTextActive,
                    ]}
                  >
                    {providerDisplayName(p)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => void runParseWithProvider(pendingPdfBase64, 'unknown')}
            >
              <Text style={styles.secondaryBtnText}>{copy.providerNotSure}</Text>
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
            <View style={[styles.footer, { paddingBottom: 16 + footerPadBottom }]}>
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
            <View style={[styles.footer, { paddingBottom: 16 + footerPadBottom }]}>
              <Pressable
                style={styles.dangerBtn}
                onPress={handleDeleteReport}
                accessibilityRole="button"
                accessibilityLabel={copy.deleteReport}
              >
                <Text style={styles.dangerBtnText}>{copy.deleteReport}</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => void handleSaveView()}>
                <Text style={styles.primaryBtnText}>✓ {saveLabel}</Text>
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
  closeBtn: { fontSize: 22, color: c.textSecondary },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: c.textSecondary },
  emptyWrap: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 15, color: c.textSecondary, textAlign: 'center' },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  confirmWrap: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, textAlign: 'center' },
  confirmBody: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  providerChip: {
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  providerChipActive: { borderColor: c.accentBlue, backgroundColor: c.accentBlue + '22' },
  providerChipText: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  providerChipTextActive: { color: c.accentBlue },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.gridLine,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  meta: { fontSize: 12, color: c.textSecondary, paddingHorizontal: 20, marginBottom: 8 },
  panelTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: c.textSecondary,
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
    borderBottomColor: c.gridLine,
    paddingVertical: 10,
    gap: 8,
  },
  rowMain: { flex: 1 },
  code: { fontSize: 13, fontWeight: '700', color: c.textPrimary },
  valueRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  valueInput: {
    minWidth: 72,
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 15,
    color: c.textPrimary,
  },
  unitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: c.textSecondary,
  },
  refText: { fontSize: 11, color: c.textSecondary, marginTop: 4, fontStyle: 'italic' },
  flag: { fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
  deleteBtn: { fontSize: 18, paddingTop: 4 },
  footer: {
    padding: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: c.gridLine,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: c.accentBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dangerBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E53935',
    backgroundColor: c.surface,
  },
  dangerBtnText: { color: '#E53935', fontWeight: '700', fontSize: 15 },
  errorText: { fontSize: 12, color: '#E53935', paddingHorizontal: 20, marginTop: 8 },
});
