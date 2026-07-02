/**
 * My Rules — free-text dietary/lifestyle rules, summarised by AI.
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
import { summariseUserRules } from '../services/GeminiService';
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
import { WellnessColors } from '../theme/wellness';

type Props = {
  userRules: UserRules | null;
  mentors: MentorType[];
  onSaved: (rules: UserRules) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
};

export function RulesStrip({ userRules, mentors, onSaved, expanded, onToggleExpand, lang }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(userRules?.rawText ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<UserRulesHistoryEntry[]>([]);
  const [historyEntry, setHistoryEntry] = useState<UserRulesHistoryEntry | null>(null);
  const [restoring, setRestoring] = useState(false);

  const headerSub = userRules?.summary ?? 'Tap to add your dietary rules';
  const canRestoreEntry = historyEntry != null && !historyEntryMatchesActive(historyEntry, userRules);

  const refreshHistory = useCallback(async () => {
    setHistory(await getUserRulesHistory());
  }, []);

  useEffect(() => {
    if (expanded) void refreshHistory();
  }, [expanded, refreshHistory]);

  const handleSave = useCallback(async () => {
    if (!text.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await summariseUserRules(text.trim(), mentors, lang);
      const rules: UserRules = {
        rawText: text.trim(),
        summary: result.summary,
        constraints: result.constraints,
        aiContext: (result.context ?? '').trim(),
        analyzedAt: new Date().toISOString(),
      };
      await saveUserRulesWithHistory(rules, { source: 'patient' });
      onSaved(rules);
      await refreshHistory();
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to summarise rules');
    } finally {
      setLoading(false);
    }
  }, [text, mentors, lang, onSaved, refreshHistory]);

  const handleRestore = useCallback(() => {
    if (!historyEntry || !canRestoreEntry) return;
    Alert.alert(
      'Restore this version?',
      'Your current rules will be saved to history and this version will become active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setRestoring(true);
              try {
                const restored = await restoreUserRulesFromHistory(historyEntry.id);
                if (!restored) return;
                onSaved(restored);
                setText(restored.rawText);
                setEditing(false);
                await refreshHistory();
                setHistoryEntry(null);
              } finally {
                setRestoring(false);
              }
            })();
          },
        },
      ],
    );
  }, [historyEntry, canRestoreEntry, onSaved, refreshHistory]);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.headerRow} onPress={onToggleExpand}>
        <Text style={styles.headerIcon}>📋</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>My Rules</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{headerSub}</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
            {userRules && !editing && !loading && (
              <View>
                <Text style={styles.sectionLabel}>AI understood:</Text>
                {userRules.constraints.map((c, i) => (
                  <Text key={i} style={styles.constraintLine}>✓ {c}</Text>
                ))}
                <Text style={styles.originalText}>{userRules.rawText}</Text>
                <Pressable style={styles.editBtn} onPress={() => { setText(userRules.rawText); setEditing(true); }}>
                  <Text style={styles.editBtnText}>✎ Edit rules</Text>
                </Pressable>
              </View>
            )}

            {(!userRules || editing) && !loading && (
              <View>
                <TextInput
                  style={styles.textInput}
                  value={text}
                  onChangeText={setText}
                  placeholder="e.g. high cholesterol, IF 16:8, avoid red meat, kidney protein limit"
                  placeholderTextColor={WellnessColors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                {error && <Text style={styles.errorText}>{error}</Text>}
                <View style={styles.btnsRow}>
                  <Pressable
                    style={[styles.saveBtn, !text.trim() && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!text.trim()}
                  >
                    <Text style={styles.saveBtnText}>✨ Save & Summarise</Text>
                  </Pressable>
                  {editing && (
                    <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {loading && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={WellnessColors.accentGreen} />
                <Text style={styles.loadingText}>Understanding your rules…</Text>
              </View>
            )}

            {!loading && history.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.sectionLabel}>Past versions ({history.length})</Text>
                {history.map((entry) => (
                  <Pressable
                    key={entry.id}
                    style={styles.historyRow}
                    onPress={() => setHistoryEntry(entry)}
                  >
                    <Text style={styles.historyRowTitle} numberOfLines={1}>
                      {formatHistoryDate(entry.savedAt)} · {formatHistorySource(entry)}
                    </Text>
                    <Text style={styles.historyRowSub} numberOfLines={2}>
                      {historyRowPreview(entry)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
        </View>
      )}

      <Modal visible={historyEntry != null} animationType="slide" transparent onRequestClose={() => setHistoryEntry(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {historyEntry && (
              <>
                <Text style={styles.modalTitle}>
                  {formatHistoryDate(historyEntry.savedAt)} · {formatHistorySource(historyEntry)}
                </Text>
                <ScrollView style={styles.modalScroll}>
                  {historyEntry.rules.constraints.length > 0 && (
                    <View style={styles.modalConstraints}>
                      {historyEntry.rules.constraints.map((c, i) => (
                        <Text key={i} style={styles.constraintLine}>✓ {c}</Text>
                      ))}
                    </View>
                  )}
                  <Text style={styles.modalRaw}>{historyEntry.rules.rawText}</Text>
                </ScrollView>
                <View style={styles.modalActions}>
                  {canRestoreEntry && (
                    <Pressable
                      style={[styles.modalRestoreBtn, restoring && styles.modalRestoreBtnDisabled]}
                      onPress={handleRestore}
                      disabled={restoring}
                    >
                      {restoring ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.modalRestoreText}>↩ Restore as active rules</Text>
                      )}
                    </Pressable>
                  )}
                  <Pressable style={styles.modalCloseBtn} onPress={() => setHistoryEntry(null)}>
                    <Text style={styles.modalCloseText}>Close</Text>
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
  wrap: {},
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerIcon: { fontSize: 24 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: WellnessColors.textPrimary },
  headerSub: { fontSize: 12, color: WellnessColors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: WellnessColors.textSecondary, fontWeight: '300' },

  body: { paddingHorizontal: 16, paddingBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: WellnessColors.textSecondary, marginBottom: 6 },
  constraintLine: { fontSize: 13, color: '#2E7D32', marginBottom: 4 },
  originalText: { fontSize: 11, color: WellnessColors.textSecondary, marginTop: 10, fontStyle: 'italic' },
  editBtn: { marginTop: 12, alignSelf: 'flex-start' },
  editBtnText: { fontSize: 13, color: WellnessColors.accentBlue, fontWeight: '600' },

  textInput: {
    borderWidth: 1.5,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: WellnessColors.textPrimary,
    minHeight: 90,
    backgroundColor: WellnessColors.background,
  },
  errorText: { fontSize: 12, color: '#E53935', marginTop: 6 },
  btnsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: {
    flex: 1,
    backgroundColor: WellnessColors.accentGreen,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: WellnessColors.gridLine },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, color: WellnessColors.textSecondary },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, color: WellnessColors.textSecondary },

  historySection: { marginTop: 20, borderTopWidth: 1, borderTopColor: WellnessColors.gridLine, paddingTop: 14 },
  historyRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WellnessColors.gridLine,
  },
  historyRowTitle: { fontSize: 13, fontWeight: '600', color: WellnessColors.textPrimary },
  historyRowSub: { fontSize: 12, color: WellnessColors.textSecondary, marginTop: 3 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: WellnessColors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '78%',
    padding: 20,
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: WellnessColors.textPrimary, marginBottom: 12 },
  modalScroll: { maxHeight: 360 },
  modalConstraints: { marginBottom: 10 },
  modalRaw: { fontSize: 14, color: WellnessColors.textPrimary, lineHeight: 21 },
  modalActions: { marginTop: 16, gap: 10 },
  modalRestoreBtn: {
    backgroundColor: WellnessColors.accentGreen,
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
  modalCloseText: { fontSize: 15, fontWeight: '600', color: WellnessColors.accentBlue },
});
