/**
 * My Rules — free-text dietary/lifestyle rules, summarised by AI.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { summariseUserRules } from '../services/GeminiService';
import { saveUserRules, type MentorType, type UserRules } from '../services/TargetService';
import { WellnessColors } from '../theme/wellness';

type Props = {
  userRules: UserRules | null;
  mentors: MentorType[];
  onSaved: (rules: UserRules) => void;
  expanded: boolean;
  onToggleExpand: () => void;
};

export function RulesStrip({ userRules, mentors, onSaved, expanded, onToggleExpand }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(userRules?.rawText ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerSub = userRules?.summary ?? 'Tap to add your dietary rules';

  const handleSave = useCallback(async () => {
    if (!text.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await summariseUserRules(text.trim(), mentors);
      const rules: UserRules = {
        rawText: text.trim(),
        summary: result.summary,
        constraints: result.constraints,
        aiContext: result.aiContext,
        analyzedAt: new Date().toISOString(),
      };
      await saveUserRules(rules);
      onSaved(rules);
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to summarise rules');
    } finally {
      setLoading(false);
    }
  }, [text, mentors, onSaved]);

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
            {/* Active view — summary shown */}
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

            {/* Input view */}
            {(!userRules || editing) && !loading && (
              <View>
                <TextInput
                  style={styles.textInput}
                  value={text}
                  onChangeText={setText}
                  placeholder="e.g. keto diet, diabetic, no meat, IF 16:8"
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

            {/* Loading */}
            {loading && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={WellnessColors.accentGreen} />
                <Text style={styles.loadingText}>Understanding your rules…</Text>
              </View>
            )}
        </View>
      )}
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
});
