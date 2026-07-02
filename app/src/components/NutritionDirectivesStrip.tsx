/**
 * Nutritionist session reports — dashboard card (same pattern as LabResultsStrip).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  deleteNutritionDirective,
  directivePreviewLine,
  formatDirectiveDate,
  setActiveNutritionDirective,
  type NutritionDirective,
} from '../services/NutritionDirectiveService';
import type { UserLanguage } from '../services/TargetService';
import { WellnessColors, cardShadow } from '../theme/wellness';
import { NutritionDirectiveReviewModal } from './NutritionDirectiveReviewModal';

type Props = {
  directives: NutritionDirective[];
  activeId: string | null;
  onChanged: () => void;
  lang?: UserLanguage | null;
};

function chipPreview(entry: NutritionDirective): string | null {
  return directivePreviewLine(entry);
}

export function NutritionDirectivesStrip({ directives, activeId, onChanged, lang }: Props) {
  const [importVisible, setImportVisible] = useState(false);
  const [autoPick, setAutoPick] = useState(false);
  const [detailEntry, setDetailEntry] = useState<NutritionDirective | null>(null);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const effectiveActiveId = activeId ?? directives[0]?.id ?? null;
  const active = useMemo(
    () => directives.find((d) => d.id === effectiveActiveId) ?? directives[0] ?? null,
    [directives, effectiveActiveId],
  );

  const openImport = useCallback(() => {
    setAutoPick(true);
    setImportVisible(true);
  }, []);

  const closeImport = useCallback(() => {
    setImportVisible(false);
    setAutoPick(false);
  }, []);

  const handleSaved = useCallback(() => {
    onChanged();
    closeImport();
    Alert.alert(
      rtl ? 'נשמר' : 'Saved',
      rtl ? 'הדוח הפעיל עודכן — המנטורים יראו את התוכנית' : 'Report saved and set as active — mentors will use this plan',
    );
  }, [closeImport, onChanged, rtl]);

  const handleSetActive = useCallback(async (id: string) => {
    await setActiveNutritionDirective(id);
    onChanged();
    setDetailEntry(null);
  }, [onChanged]);

  const handleDelete = useCallback((entry: NutritionDirective) => {
    Alert.alert(
      rtl ? 'מחיקת דוח?' : 'Delete report?',
      entry.title,
      [
        { text: rtl ? 'ביטול' : 'Cancel', style: 'cancel' },
        {
          text: rtl ? 'מחק' : 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteNutritionDirective(entry.id);
              onChanged();
              setDetailEntry(null);
            })();
          },
        },
      ],
    );
  }, [onChanged, rtl]);

  const sectionTitle = rtl ? 'דוחות תזונה' : 'NUTRITION REPORTS';
  const addLabel = rtl ? 'הוסף דוח' : 'Add report';
  const summaryLine = active
    ? rtl
      ? `פעיל: ${active.title} · ${formatDirectiveDate(active)}`
      : `Active: ${active.title} · ${formatDirectiveDate(active)}`
    : rtl
      ? 'ייבאו סיכום מפגש PDF מהדיאטנ/ית'
      : 'Import a nutritionist session summary PDF';

  return (
    <View style={[styles.card, cardShadow]}>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>
      <Text style={styles.summaryLine}>{summaryLine}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Pressable
          style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.chipPressed]}
          onPress={openImport}
          accessibilityLabel={addLabel}
        >
          <Text style={styles.addChipIcon}>＋</Text>
          <Text style={styles.addChipLabel}>{addLabel}</Text>
        </Pressable>
        {directives.map((entry) => {
          const isActive = entry.id === effectiveActiveId;
          const preview = chipPreview(entry);
          return (
            <Pressable
              key={entry.id}
              style={({ pressed }) => [
                styles.chip,
                isActive && styles.chipActive,
                pressed && styles.chipPressed,
              ]}
              onPress={() => setDetailEntry(entry)}
            >
              <Text style={styles.chipDate}>{formatDirectiveDate(entry)}</Text>
              <Text style={styles.chipLabel} numberOfLines={2}>{entry.title}</Text>
              {isActive ? (
                <Text style={styles.chipActiveBadge}>{rtl ? 'פעיל' : 'Active'}</Text>
              ) : null}
              {preview ? <Text style={styles.chipHi} numberOfLines={2}>{preview}</Text> : null}
              <Text style={styles.chipEdit}>✎ {rtl ? 'צפייה' : 'view'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <NutritionDirectiveReviewModal
        visible={importVisible}
        onClose={closeImport}
        onSaved={handleSaved}
        lang={lang}
        autoPickPdf={autoPick}
      />

      <Modal visible={detailEntry != null} animationType="slide" transparent onRequestClose={() => setDetailEntry(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {detailEntry && (
              <>
                <Text style={styles.modalTitle}>{detailEntry.title}</Text>
                <Text style={styles.modalMeta}>{formatDirectiveDate(detailEntry)}</Text>
                <ScrollView style={styles.modalScroll}>
                  <Text style={[styles.reportBody, rtl && styles.reportBodyRtl]}>
                    {detailEntry.fullText}
                  </Text>
                </ScrollView>
                <View style={styles.modalActions}>
                  {detailEntry.id !== effectiveActiveId && (
                    <Pressable
                      style={styles.modalPrimaryBtn}
                      onPress={() => void handleSetActive(detailEntry.id)}
                    >
                      <Text style={styles.modalPrimaryText}>{rtl ? 'הגדר כפעיל' : 'Set active'}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.modalDangerBtn}
                    onPress={() => handleDelete(detailEntry)}
                  >
                    <Text style={styles.modalDangerText}>{rtl ? 'מחק' : 'Delete'}</Text>
                  </Pressable>
                  <Pressable style={styles.modalCloseBtn} onPress={() => setDetailEntry(null)}>
                    <Text style={styles.modalCloseText}>{rtl ? 'סגור' : 'Close'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  summaryLine: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  chipsRow: { gap: 8, paddingBottom: 2 },
  chip: {
    backgroundColor: WellnessColors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    minWidth: 100,
    maxWidth: 160,
  },
  chipActive: {
    borderColor: '#2E7D32',
    backgroundColor: '#F1F8E9',
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
  },
  chipActiveBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 2,
  },
  chipHi: {
    fontSize: 10,
    color: WellnessColors.textSecondary,
    marginTop: 2,
  },
  chipEdit: {
    fontSize: 10,
    color: WellnessColors.accentBlue,
    marginTop: 2,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: WellnessColors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: WellnessColors.textPrimary },
  modalMeta: { fontSize: 13, color: WellnessColors.textSecondary, marginTop: 4, marginBottom: 12 },
  modalScroll: { maxHeight: 400 },
  reportBody: {
    fontSize: 14,
    color: WellnessColors.textPrimary,
    lineHeight: 22,
  },
  reportBodyRtl: { writingDirection: 'rtl', textAlign: 'right' },
  modalActions: { marginTop: 16, gap: 10 },
  modalPrimaryBtn: {
    backgroundColor: WellnessColors.accentGreen,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalDangerBtn: {
    borderWidth: 1.5,
    borderColor: '#E53935',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalDangerText: { color: '#E53935', fontWeight: '600', fontSize: 15 },
  modalCloseBtn: { alignSelf: 'center', paddingVertical: 8 },
  modalCloseText: { fontSize: 15, color: WellnessColors.accentBlue, fontWeight: '600' },
});
