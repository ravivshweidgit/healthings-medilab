/**
 * Review + save nutritionist session PDF as verbatim plain text.
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
import { parseNutritionDirectivePdf, type ParsedNutritionDirectivePdf } from '../services/GeminiService';
import { readPdfBase64FromUri } from '../services/LabLogService';
import {
  saveNutritionDirective,
  type NutritionDirective,
  type ParsedNutritionDirectiveDraft,
} from '../services/NutritionDirectiveService';
import type { UserLanguage } from '../services/TargetService';
import { getNutritionSessionsStripCopy } from '../i18n/nutritionSessionsStripCopy';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (entry: NutritionDirective) => void;
  lang?: UserLanguage | null;
  autoPickPdf?: boolean;
};

function bottomInset(insetsBottom: number): number {
  if (insetsBottom > 0) return insetsBottom;
  return Platform.OS === 'android' ? 48 : 16;
}

function draftFromParsed(p: ParsedNutritionDirectivePdf): ParsedNutritionDirectiveDraft {
  return {
    title: p.title,
    sessionDate: p.sessionDate,
    fullText: p.fullText,
    lang: p.lang,
  };
}

export function NutritionDirectiveReviewModal({
  visible,
  onClose,
  onSaved,
  lang,
  autoPickPdf,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const footerPad = bottomInset(insets.bottom);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ParsedNutritionDirectiveDraft | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoPickStartedRef = useRef(false);
  const copy = getNutritionSessionsStripCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const reset = useCallback(() => {
    setDraft(null);
    setSourceFileName(null);
    setError(null);
    setLoading(false);
    setSaving(false);
    autoPickStartedRef.current = false;
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

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
    const fileName = result.assets[0]?.name ?? null;
    setLoading(true);
    try {
      const base64 = await readPdfBase64FromUri(result.assets[0].uri);
      const parsed = await parseNutritionDirectivePdf(base64, lang);
      setDraft(draftFromParsed(parsed));
      setSourceFileName(fileName);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not read PDF';
      setError(msg);
      if (autoPickPdf) {
        Alert.alert(rtl ? '×©×’×™××”' : 'Error', msg);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }, [autoPickPdf, lang, onClose, rtl]);

  useEffect(() => {
    if (!visible) {
      autoPickStartedRef.current = false;
      return;
    }
    if (autoPickPdf && !autoPickStartedRef.current && !draft && !loading) {
      autoPickStartedRef.current = true;
      void pickAndParse();
    }
  }, [visible, autoPickPdf, draft, loading, pickAndParse]);

  const handleSave = useCallback(async () => {
    if (!draft?.fullText?.trim()) return;
    setSaving(true);
    try {
      const saved = await saveNutritionDirective(draft, sourceFileName);
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      Alert.alert(
        rtl ? '×©×’×™××”' : 'Error',
        e instanceof Error ? e.message : 'Save failed',
      );
    } finally {
      setSaving(false);
    }
  }, [draft, sourceFileName, onSaved, onClose, rtl]);

  const busy = loading || saving;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {copy.importTitle}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>âœ•</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accentGreen} size="large" />
            <Text style={styles.hint}>{rtl ? '×ž×—×œ×¥ ×˜×§×¡×˜ ×ž×”-PDFâ€¦' : 'Extracting text from PDFâ€¦'}</Text>
          </View>
        )}

        {!loading && !draft && (
          <View style={styles.center}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.pickBtn} onPress={() => void pickAndParse()}>
              <Text style={styles.pickBtnText}>{rtl ? '×‘×—×¨ PDF' : 'Choose PDF'}</Text>
            </Pressable>
          </View>
        )}

        {draft && !loading && (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <Text style={styles.note}>
                {rtl
                  ? '×”×˜×§×¡×˜ × ×©×ž×¨ ×›×¤×™ ×©×”×•×¤×™×¢ ×‘×“×•×— â€” × ×™×ª×Ÿ ×œ×¢×¨×•×š ×œ×¤× ×™ ×©×ž×™×¨×”.'
                  : 'Text is saved as written in the report â€” edit before saving if needed.'}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaField}>
                  <Text style={styles.fieldLabel}>{rtl ? '×›×•×ª×¨×ª' : 'Title'}</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={draft.title}
                    onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, title: v } : prev))}
                  />
                </View>
                <View style={styles.metaField}>
                  <Text style={styles.fieldLabel}>{rtl ? '×ª××¨×™×š ×ž×¤×’×©' : 'Session date'}</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={draft.sessionDate ?? ''}
                    placeholder="YYYY-MM-DD"
                    onChangeText={(v) =>
                      setDraft((prev) => (prev ? { ...prev, sessionDate: v.trim() || null } : prev))
                    }
                  />
                </View>
              </View>
              <Text style={styles.fieldLabel}>{rtl ? '×˜×§×¡×˜ ×”×“×•×—' : 'Report text'}</Text>
              <TextInput
                style={[styles.bodyInput, rtl && styles.bodyRtl]}
                value={draft.fullText}
                onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, fullText: v } : prev))}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: footerPad }]}>
              <Pressable
                style={[styles.saveBtn, busy && styles.saveBtnDisabled]}
                onPress={() => void handleSave()}
                disabled={busy}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{rtl ? '×©×ž×•×¨ ×“×•×—' : 'Save report'}</Text>
                )}
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
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.gridLine,
  },
  title: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
  close: { fontSize: 22, color: c.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  hint: { fontSize: 14, color: c.textSecondary },
  error: { fontSize: 13, color: '#E53935', textAlign: 'center' },
  pickBtn: {
    backgroundColor: c.accentGreen,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  pickBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  note: {
    fontSize: 13,
    color: c.textSecondary,
    marginBottom: 14,
    lineHeight: 19,
  },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metaField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  metaInput: {
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: c.textPrimary,
    backgroundColor: '#fff',
  },
  bodyInput: {
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 320,
    color: c.textPrimary,
    backgroundColor: '#fff',
    marginTop: 6,
  },
  bodyRtl: { writingDirection: 'rtl', textAlign: 'right' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.gridLine,
  },
  saveBtn: {
    backgroundColor: c.accentGreen,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
