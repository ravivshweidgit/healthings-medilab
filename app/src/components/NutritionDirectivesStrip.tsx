/**
 * Nutritionist session reports — dashboard card (same pattern as LabResultsStrip).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteNutritionDirective,
  directivePreviewLine,
  formatDirectiveDate,
  setActiveNutritionDirective,
  type NutritionDirective,
} from '../services/NutritionDirectiveService';
import type { UserLanguage } from '../services/TargetService';
import { getNutritionSessionsStripCopy } from '../i18n/nutritionSessionsStripCopy';
import { WellnessColors, cardShadow, dashCardGap } from '../theme/wellness';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { StripIcons } from '../theme/icons';
import { NutritionDirectiveReviewModal } from './NutritionDirectiveReviewModal';

const EXPANDED_KEY = 'dash_nutrition_reports_expanded';

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
  const [expanded, setExpanded] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const copy = getNutritionSessionsStripCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';

  const effectiveActiveId = activeId ?? directives[0]?.id ?? null;
  const active = useMemo(
    () => directives.find((d) => d.id === effectiveActiveId) ?? directives[0] ?? null,
    [directives, effectiveActiveId],
  );

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
    Alert.alert(copy.savedTitle, copy.savedBody);
  }, [closeImport, onChanged, copy.savedTitle, copy.savedBody]);

  const handleSetActive = useCallback(async (id: string) => {
    await setActiveNutritionDirective(id);
    onChanged();
    setDetailEntry(null);
  }, [onChanged]);

  const handleDelete = useCallback((entry: NutritionDirective) => {
    Alert.alert(copy.deleteTitle, entry.title, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteNutritionDirective(entry.id);
            onChanged();
            setDetailEntry(null);
          })();
        },
      },
    ]);
  }, [onChanged, copy.cancel, copy.delete, copy.deleteTitle]);

  const summaryLine = active
    ? `${copy.activePrefix}: ${active.title} · ${formatDirectiveDate(active, lang?.code)}`
    : copy.emptyHint;

  return (
    <View style={[styles.card, cardShadow, !expanded && styles.cardCollapsed]}>
      <DashboardCollapseHeader
        title={copy.title}
        subtitle={summaryLine}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        titleRtl={rtl}
        collapseLabel={copy.collapseA11y}
        expandLabel={copy.expandA11y}
        subtitleNumberOfLines={2}
        icon={StripIcons.sessions}
      />

      {expanded ? (
      <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Pressable
          style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.chipPressed]}
          onPress={openImport}
          accessibilityLabel={copy.addSession}
        >
          <Text style={styles.addChipIcon}>＋</Text>
          <Text style={styles.addChipLabel}>{copy.addSession}</Text>
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
              <Text style={styles.chipDate}>{formatDirectiveDate(entry, lang?.code)}</Text>
              <Text style={styles.chipLabel} numberOfLines={2}>{entry.title}</Text>
              {isActive ? (
                <Text style={styles.chipActiveBadge}>{copy.activeBadge}</Text>
              ) : null}
              {preview ? <Text style={styles.chipHi} numberOfLines={2}>{preview}</Text> : null}
              <Text style={styles.chipEdit}>✎ {copy.view}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </>
      ) : null}

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
                <Text style={styles.modalMeta}>{formatDirectiveDate(detailEntry, lang?.code)}</Text>
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
                      <Text style={styles.modalPrimaryText}>{copy.setActive}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={styles.modalDangerBtn}
                    onPress={() => handleDelete(detailEntry)}
                  >
                    <Text style={styles.modalDangerText}>{copy.delete}</Text>
                  </Pressable>
                  <Pressable style={styles.modalCloseBtn} onPress={() => setDetailEntry(null)}>
                    <Text style={styles.modalCloseText}>{copy.close}</Text>
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
