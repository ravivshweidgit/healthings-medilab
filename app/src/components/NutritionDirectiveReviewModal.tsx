/**
 * Review + save nutritionist session PDF as verbatim plain text.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { WellnessColors } from '../theme/wellness';

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
  const insets = useSafeAreaInsets();
  const footerPad = bottomInset(insets.bottom);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ParsedNutritionDirectiveDraft | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoPickStartedRef = useRef(false);
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
        Alert.alert(rtl ? 'שגיאה' : 'Error', msg);
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
        rtl ? 'שגיאה' : 'Error',
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
            {rtl ? 'ייבוא דוח תזונה' : 'Import nutritionist report'}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={WellnessColors.accentGreen} size="large" />
            <Text style={styles.hint}>{rtl ? 'מחלץ טקסט מה-PDF…' : 'Extracting text from PDF…'}</Text>
          </View>
        )}

        {!loading && !draft && (
          <View style={styles.center}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.pickBtn} onPress={() => void pickAndParse()}>
              <Text style={styles.pickBtnText}>{rtl ? 'בחר PDF' : 'Choose PDF'}</Text>
            </Pressable>
          </View>
        )}

        {draft && !loading && (
          <>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <Text style={styles.note}>
                {rtl
                  ? 'הטקסט נשמר כפי שהופיע בדוח — ניתן לערוך לפני שמירה.'
                  : 'Text is saved as written in the report — edit before saving if needed.'}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaField}>
                  <Text style={styles.fieldLabel}>{rtl ? 'כותרת' : 'Title'}</Text>
                  <TextInput
                    style={styles.metaInput}
                    value={draft.title}
                    onChangeText={(v) => setDraft((prev) => (prev ? { ...prev, title: v } : prev))}
                  />
                </View>
                <View style={styles.metaField}>
                  <Text style={styles.fieldLabel}>{rtl ? 'תאריך מפגש' : 'Session date'}</Text>
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
              <Text style={styles.fieldLabel}>{rtl ? 'טקסט הדוח' : 'Report text'}</Text>
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
                  <Text style={styles.saveBtnText}>{rtl ? 'שמור דוח' : 'Save report'}</Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WellnessColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WellnessColors.gridLine,
  },
  title: { fontSize: 17, fontWeight: '700', color: WellnessColors.textPrimary },
  close: { fontSize: 22, color: WellnessColors.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  hint: { fontSize: 14, color: WellnessColors.textSecondary },
  error: { fontSize: 13, color: '#E53935', textAlign: 'center' },
  pickBtn: {
    backgroundColor: WellnessColors.accentGreen,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  pickBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  note: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
    marginBottom: 14,
    lineHeight: 19,
  },
  metaRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metaField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: WellnessColors.textSecondary },
  metaInput: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: WellnessColors.textPrimary,
    backgroundColor: '#fff',
  },
  bodyInput: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 320,
    color: WellnessColors.textPrimary,
    backgroundColor: '#fff',
    marginTop: 6,
  },
  bodyRtl: { writingDirection: 'rtl', textAlign: 'right' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: WellnessColors.gridLine,
  },
  saveBtn: {
    backgroundColor: WellnessColors.accentGreen,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
