/**
 * My Rules — free-text dietary/lifestyle rules (rawText-only save, prompt52).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type MentorType, type UserRules, type UserLanguage } from '../services/TargetService';
import {
  formatHistoryDate,
  formatHistorySource,
  getUserRulesHistory,
  historyEntryMatchesActive,
  historyRowPreview,
  restoreUserRulesFromHistory,
  saveUserRulesWithHistory,
  type UserRulesHistoryEntry,
} from '../services/UserRulesHistoryService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { getRulesStripCopy, rulesSubtitleFromRaw } from '../i18n/rulesStripCopy';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { contentAlignStyle } from '../logic/textDirection';

const RULES_PREVIEW_CHARS = 200;

type Props = {
  userRules: UserRules | null;
  mentors: MentorType[];
  onSaved: (rules: UserRules) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
};

export function RulesStrip({ userRules, mentors: _mentors, onSaved, expanded, onToggleExpand, lang }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const t = getRulesStripCopy(lang?.code);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  const modalPadTop = Math.max(insets.top, 12);
  const modalPadBottom = Math.max(insets.bottom, 16);

  const [editOpen, setEditOpen] = useState(false);
  const [text, setText] = useState(userRules?.rawText ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<UserRulesHistoryEntry[]>([]);
  const [historyEntry, setHistoryEntry] = useState<UserRulesHistoryEntry | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);

  const raw = userRules?.rawText?.trim() ?? '';
  const headerSub = rulesSubtitleFromRaw(raw, t.emptySubtitle);
  const canRestoreEntry = historyEntry != null && !historyEntryMatchesActive(historyEntry, userRules);
  const rulesNeedCollapse = raw.length > RULES_PREVIEW_CHARS || raw.split(/\r?\n/).length > 4;
  const rulesPreview = useMemo(() => {
    if (!raw) return '';
    if (!rulesNeedCollapse || rulesExpanded) return raw;
    const clipped = raw.slice(0, RULES_PREVIEW_CHARS);
    return clipped.length < raw.length ? `${clipped.trimEnd()}…` : clipped;
  }, [raw, rulesNeedCollapse, rulesExpanded]);

  const refreshHistory = useCallback(async () => {
    setHistory(await getUserRulesHistory());
  }, []);

  useEffect(() => {
    if (expanded) void refreshHistory();
  }, [expanded, refreshHistory]);

  useEffect(() => {
    if (!editOpen) setText(userRules?.rawText ?? '');
  }, [userRules?.rawText, editOpen]);

  const openEdit = useCallback(() => {
    setText(userRules?.rawText ?? '');
    setError(null);
    setEditOpen(true);
  }, [userRules?.rawText]);

  const closeEdit = useCallback(() => {
    const dirty = text.trim() !== (userRules?.rawText ?? '').trim();
    if (!dirty) {
      setEditOpen(false);
      setError(null);
      return;
    }
    Alert.alert(t.discardTitle, t.discardMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.discardConfirm,
        style: 'destructive',
        onPress: () => {
          setEditOpen(false);
          setError(null);
          setText(userRules?.rawText ?? '');
        },
      },
    ]);
  }, [text, userRules?.rawText, t]);

  const handleSave = useCallback(async () => {
    if (!text.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const rules: UserRules = {
        rawText: text.trim(),
        summary: '',
        constraints: [],
        aiContext: '',
        analyzedAt: new Date().toISOString(),
      };
      await saveUserRulesWithHistory(rules, { source: 'patient' });
      onSaved(rules);
      await refreshHistory();
      setEditOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save rules';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [text, onSaved, refreshHistory]);

  const handleRestore = useCallback(() => {
    if (!historyEntry || !canRestoreEntry) return;
    Alert.alert(t.restoreTitle, t.restoreMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.restoreConfirm,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setRestoring(true);
            try {
              const restored = await restoreUserRulesFromHistory(historyEntry.id);
              if (!restored) return;
              onSaved(restored);
              setText(restored.rawText);
              await refreshHistory();
              setHistoryEntry(null);
            } finally {
              setRestoring(false);
            }
          })();
        },
      },
    ]);
  }, [historyEntry, canRestoreEntry, onSaved, refreshHistory, t]);

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={profileTitles.myRules}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={rtl}
        collapseLabel={`Collapse ${profileTitles.myRules}`}
        expandLabel={`Expand ${profileTitles.myRules}`}
        subtitleNumberOfLines={2}
      />

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Pressable style={styles.editTopBtn} onPress={openEdit}>
              <Text style={styles.editTopBtnText}>{raw ? t.editRules : t.addRules}</Text>
            </Pressable>
          </View>

          {raw ? (
            <View style={styles.rulesBlock}>
              <Text style={[styles.sectionLabel, rtl && styles.textRtl]}>{t.yourRules}</Text>
              <Text style={[styles.rulesText, contentAlignStyle(raw)]}>{rulesPreview}</Text>
              {rulesNeedCollapse ? (
                <Pressable onPress={() => setRulesExpanded((v) => !v)} hitSlop={8}>
                  <Text style={styles.showMore}>{rulesExpanded ? t.showLess : t.showMore}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Text style={[styles.emptyBody, rtl && styles.textRtl]}>{t.emptyBody}</Text>
          )}

          {!loading && history.length > 0 ? (
            <View style={styles.historySection}>
              <Pressable
                style={styles.historyHeader}
                onPress={() => setHistoryExpanded((v) => !v)}
                accessibilityRole="button"
              >
                <Text style={[styles.sectionLabel, styles.historyHeaderLabel, rtl && styles.textRtl]}>
                  {t.pastVersions(history.length)}
                </Text>
                <Text style={styles.historyChevron}>{historyExpanded ? '▾' : '▸'}</Text>
              </Pressable>
              {historyExpanded
                ? history.map((entry) => (
                    <Pressable
                      key={entry.id}
                      style={styles.historyRow}
                      onPress={() => setHistoryEntry(entry)}
                    >
                      <Text style={styles.historyRowTitle} numberOfLines={1}>
                        {formatHistoryDate(entry.savedAt)} · {formatHistorySource(entry)}
                      </Text>
                      <Text style={[styles.historyRowSub, contentAlignStyle(historyRowPreview(entry))]} numberOfLines={2}>
                        {historyRowPreview(entry)}
                      </Text>
                    </Pressable>
                  ))
                : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal visible={editOpen} animationType="slide" transparent onRequestClose={closeEdit}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { paddingTop: modalPadTop, paddingBottom: modalPadBottom },
            ]}
          >
            <Text style={[styles.modalTitle, rtl && styles.textRtl]}>{t.editTitle}</Text>
            <TextInput
              style={[styles.textInput, styles.textInputFlex, contentAlignStyle(text)]}
              value={text}
              onChangeText={setText}
              placeholder={t.placeholder}
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              editable={!loading}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.accentBlue} />
                <Text style={styles.loadingText}>{t.saving}</Text>
              </View>
            ) : (
              <View style={styles.btnsRow}>
                <Pressable
                  style={[styles.saveBtn, !text.trim() && styles.saveBtnDisabled]}
                  onPress={() => void handleSave()}
                  disabled={!text.trim()}
                >
                  <Text style={styles.saveBtnText}>{t.save}</Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={closeEdit}>
                  <Text style={styles.cancelBtnText}>{t.cancel}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={historyEntry != null}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryEntry(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              { paddingTop: modalPadTop, paddingBottom: modalPadBottom },
            ]}
          >
            {historyEntry ? (
              <>
                <Text style={styles.modalTitle}>
                  {formatHistoryDate(historyEntry.savedAt)} · {formatHistorySource(historyEntry)}
                </Text>
                <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                  <Text style={[styles.modalRaw, contentAlignStyle(historyEntry.rules.rawText)]}>
                    {historyEntry.rules.rawText}
                  </Text>
                </ScrollView>
                <View style={styles.modalActions}>
                  {canRestoreEntry ? (
                    <Pressable
                      style={[styles.modalRestoreBtn, restoring && styles.modalRestoreBtnDisabled]}
                      onPress={handleRestore}
                      disabled={restoring}
                    >
                      {restoring ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.modalRestoreText}>{t.restoreAsActive}</Text>
                      )}
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.modalCloseBtn} onPress={() => setHistoryEntry(null)}>
                    <Text style={styles.modalCloseText}>{t.close}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  wrap: {},
  body: { paddingHorizontal: 4, paddingBottom: 12, paddingTop: 4 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  editTopBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.accentBlue,
    backgroundColor: c.accentBlue + '12',
  },
  editTopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.accentBlue,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textSecondary,
    marginBottom: 6,
  },
  rulesBlock: { marginBottom: 4 },
  rulesText: {
    fontSize: 14,
    color: c.textPrimary,
    lineHeight: 21,
  },
  showMore: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: c.accentBlue,
  },
  emptyBody: {
    fontSize: 13,
    color: c.textSecondary,
    lineHeight: 19,
    marginBottom: 4,
  },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },

  textInput: {
    borderWidth: 1.5,
    borderColor: c.gridLine,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: c.textPrimary,
    minHeight: 140,
    backgroundColor: c.surface,
  },
  textInputFlex: {
    flex: 1,
    minHeight: 0,
  },
  errorText: { fontSize: 12, color: '#E53935', marginTop: 6 },
  btnsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtn: {
    flex: 1,
    backgroundColor: c.accentBlue,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: c.gridLine },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: c.textSecondary },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, color: c.textSecondary },

  historySection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: c.gridLine,
    paddingTop: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyHeaderLabel: { marginBottom: 0, flex: 1 },
  historyChevron: {
    fontSize: 14,
    color: c.textSecondary,
    paddingHorizontal: 4,
  },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.gridLine,
  },
  historyRowTitle: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  historyRowSub: { fontSize: 12, color: c.textSecondary, marginTop: 3 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
  },
  modalCard: {
    backgroundColor: c.background,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    height: '90%',
    paddingHorizontal: 20,
    flexDirection: 'column',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 12,
  },
  modalScroll: { flex: 1, minHeight: 0 },
  modalScrollContent: { paddingBottom: 8 },
  modalRaw: { fontSize: 14, color: c.textPrimary, lineHeight: 21 },
  modalActions: { marginTop: 16, gap: 10 },
  modalRestoreBtn: {
    backgroundColor: c.accentBlue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalRestoreBtnDisabled: { opacity: 0.7 },
  modalRestoreText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCloseBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  modalCloseText: { fontSize: 15, fontWeight: '600', color: c.accentBlue },
});
