/**
 * My Macros — AI-suggested daily macro targets with progress bars.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { suggestMacroTargets, macroSuggestionToDailyTarget } from '../logic/macroAutoAdjust';
import {
  clearMacroTarget,
  getMacroTarget,
  getMentors,
  getUserRules,
  resolveFiberTarget_g,
  saveMacroTarget,
  withFiberTarget,
  type BodyTarget,
  type DailyMacroTarget,
  type MentorType,
  type UserRules,
  type UserLanguage,
} from '../services/TargetService';
import { WellnessColors } from '../theme/wellness';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MacroTargetProps = {
  actualProtein_g: number | null;
  actualFat_g: number | null;
  actualCarb_g: number | null;
  actualFiber_g: number | null;
  actualKcal: number | null;
  weightKg: number | null;
  fatMassKg: number | null;
  muscleMass_kg: number | null;
  bmr_kcal: number | null;
  estimatedBurn_kcal: number | null;
  heightCm: number | null;
  age: number | null;
  gender: string | null;
  bodyTarget: BodyTarget | null;
  userRules: UserRules | null;
  mentors: MentorType[];
  /** Parent-held target — refreshes strip after weigh-in/lab auto-revision. */
  savedTarget?: DailyMacroTarget | null;
  onSaved?: (t: DailyMacroTarget) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
};

type Screen = 'idle' | 'loading' | 'suggestion' | 'editing' | 'active';

function formatMacroUpdatedAt(iso: string | undefined, lang?: UserLanguage | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const he = lang?.code === 'he';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(he ? 'he-IL' : undefined, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) {
    return he ? `עודכן היום ${time}` : `Updated today ${time}`;
  }
  const date = d.toLocaleDateString(he ? 'he-IL' : undefined, { day: 'numeric', month: 'short' });
  return he ? `עודכן ${date} ${time}` : `Updated ${date} ${time}`;
}

// ─── Macro bar ────────────────────────────────────────────────────────────────

function MacroBar({
  label,
  actual,
  target,
  color,
  unit = 'g',
}: {
  label: string;
  actual: number | null;
  target: number;
  color: string;
  unit?: string;
}) {
  const pct = actual != null && target > 0 ? Math.min(1, actual / target) : 0;
  const over = actual != null && actual > target * 1.1;

  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct * 100}%`, backgroundColor: over ? '#EF5350' : color }]} />
      </View>
      <Text style={[barStyles.nums, over && barStyles.numsOver]}>
        {actual != null ? `${Math.round(actual)}` : '—'} / {Math.round(target)}{unit}
      </Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  label: { width: 20, fontSize: 12, fontWeight: '700', color: WellnessColors.textSecondary },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: WellnessColors.gridLine, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  nums: { width: 90, fontSize: 12, color: WellnessColors.textSecondary, textAlign: 'right' },
  numsOver: { color: '#EF5350', fontWeight: '700' },
});

// ─── Edit field ───────────────────────────────────────────────────────────────

function EditField({
  label, value, onChange, unit, aiVal,
}: { label: string; value: string; onChange: (v: string) => void; unit: string; aiVal: number }) {
  return (
    <View style={editStyles.row}>
      <Text style={editStyles.label}>{label}</Text>
      <TextInput
        style={editStyles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        maxLength={5}
        selectTextOnFocus
      />
      <Text style={editStyles.unit}>{unit}</Text>
      <Text style={editStyles.ai}>AI: {Math.round(aiVal)}</Text>
    </View>
  );
}

const editStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  label: { width: 70, fontSize: 12, fontWeight: '700', color: WellnessColors.textSecondary },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: WellnessColors.gridLine,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    fontSize: 15, fontWeight: '700', color: WellnessColors.textPrimary, textAlign: 'center',
  },
  unit: { width: 24, fontSize: 12, color: WellnessColors.textSecondary },
  ai: { width: 60, fontSize: 11, color: WellnessColors.textSecondary, textAlign: 'right' },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function MacroTargetStrip({
  actualProtein_g, actualFat_g, actualCarb_g, actualFiber_g, actualKcal,
  weightKg, fatMassKg, muscleMass_kg, bmr_kcal, estimatedBurn_kcal,
  heightCm, age, gender, bodyTarget, userRules, mentors, savedTarget,
  onSaved, expanded, onToggleExpand, lang,
}: MacroTargetProps) {
  const [screen, setScreen] = useState<Screen>('idle');
  const [target, setTarget] = useState<DailyMacroTarget | null>(null);
  const [suggestion, setSuggestion] = useState<DailyMacroTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editP, setEditP] = useState('');
  const [editF, setEditF] = useState('');
  const [editC, setEditC] = useState('');
  const [editFi, setEditFi] = useState('');
  const [editK, setEditK] = useState('');

  useEffect(() => {
    getMacroTarget().then((t) => { if (t) { setTarget(withFiberTarget(t)); setScreen('active'); } });
  }, []);

  useEffect(() => {
    if (savedTarget) {
      setTarget(withFiberTarget(savedTarget));
      setScreen((s) => (s === 'loading' || s === 'suggestion' || s === 'editing' ? s : 'active'));
    }
  }, [savedTarget]);

  const canAnalyze = !!(weightKg && fatMassKg != null && muscleMass_kg && bmr_kcal && heightCm && age && gender);

  const headerSub = target
    ? `${target.protein_g}P / ${target.fat_g}F / ${target.carb_g}C / ${resolveFiberTarget_g(target)}Fi`
    : 'Tap to set AI macro targets';

  const updatedLabel = target ? formatMacroUpdatedAt(target.analyzedAt, lang) : null;

  const handleAsk = useCallback(async () => {
    if (!canAnalyze) { setError('Need body scan data and profile to analyse.'); return; }
    setError(null);
    setScreen('loading');
    try {
      const [result, rules, mentorList] = await Promise.all([
        suggestMacroTargets({ trigger: 'dashboard-suggest', lang }),
        getUserRules(),
        getMentors(),
      ]);
      const proposed = macroSuggestionToDailyTarget(result, rules, mentorList);
      setSuggestion(proposed);
      setScreen('suggestion');
    } catch (e: any) {
      setError(e?.message ?? 'AI analysis failed');
      setScreen('idle');
    }
  }, [canAnalyze, lang]);

  const handleAccept = useCallback(async () => {
    if (!suggestion) return;
    await saveMacroTarget(suggestion);
    setTarget(suggestion);
    onSaved?.(suggestion);
    setScreen('active');
  }, [suggestion, onSaved]);

  const openEdit = useCallback((src: DailyMacroTarget) => {
    setEditP(String(src.protein_g));
    setEditF(String(src.fat_g));
    setEditC(String(src.carb_g));
    setEditFi(String(resolveFiberTarget_g(src)));
    setEditK(String(src.kcal));
    setScreen('editing');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const base = suggestion ?? target;
    if (!base) return;
    const p = parseFloat(editP), f = parseFloat(editF), c = parseFloat(editC), fi = parseFloat(editFi), k = parseFloat(editK);
    if ([p, f, c, k].some(isNaN)) return;
    const updated: DailyMacroTarget = {
      ...base,
      protein_g: p,
      fat_g: f,
      carb_g: c,
      fiber_g: isNaN(fi) ? base.fiber_g : fi,
      kcal: k,
      analyzedAt: new Date().toISOString(),
    };
    await saveMacroTarget(updated, { userEdited: true });
    setTarget(updated);
    onSaved?.(updated);
    setSuggestion(null);
    setScreen('active');
  }, [editP, editF, editC, editFi, editK, suggestion, target, onSaved]);

  const handleReset = useCallback(async () => {
    await clearMacroTarget();
    setTarget(null);
    setSuggestion(null);
    onSaved?.(null as any);
    setScreen('idle');
  }, [onSaved]);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.headerRow} onPress={onToggleExpand}>
        <Text style={styles.headerIcon}>🥗</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>My Macros</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{headerSub}</Text>
          {updatedLabel ? (
            <Text style={styles.headerUpdated} numberOfLines={1}>{updatedLabel}</Text>
          ) : null}
        </View>
        {screen === 'active' && expanded && (
          <View style={styles.headerActions}>
            <Pressable onPress={() => openEdit(target!)} hitSlop={8}>
              <Text style={styles.editLink}>✎</Text>
            </Pressable>
            <Pressable onPress={handleReset} hitSlop={8}>
              <Text style={styles.resetLink}>reset</Text>
            </Pressable>
          </View>
        )}
        <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {/* idle */}
          {screen === 'idle' && (
            <View style={styles.idleWrap}>
              {!userRules && (
                <Text style={styles.hintText}>Add your dietary rules above for better results</Text>
              )}
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable
                style={[styles.aiBtn, !canAnalyze && styles.aiBtnDisabled]}
                onPress={handleAsk}
                disabled={!canAnalyze}
              >
                <Text style={styles.aiBtnText}>✨ Ask AI to set my macros</Text>
              </Pressable>
            </View>
          )}

          {/* loading */}
          {screen === 'loading' && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={WellnessColors.accentGreen} />
              <Text style={styles.loadingText}>Calculating your macros…</Text>
            </View>
          )}

          {/* suggestion */}
          {screen === 'suggestion' && suggestion && (
            <View>
              <View style={styles.reasoningBox}>
                <Text style={styles.reasoningText}>{suggestion.reasoning}</Text>
              </View>
              <View style={styles.suggestionRow}>
                {[
                  { label: 'Protein', val: suggestion.protein_g, unit: 'g' },
                  { label: 'Fat',     val: suggestion.fat_g,     unit: 'g' },
                  { label: 'Carbs',   val: suggestion.carb_g,    unit: 'g' },
                  { label: 'Fiber',   val: suggestion.fiber_g ?? 30, unit: 'g' },
                  { label: 'Calories',val: suggestion.kcal,      unit: 'kcal' },
                ].map(({ label, val, unit }) => (
                  <View key={label} style={styles.suggItem}>
                    <Text style={styles.suggVal}>{Math.round(val)}</Text>
                    <Text style={styles.suggUnit}>{unit}</Text>
                    <Text style={styles.suggLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.suggBtns}>
                <Pressable style={[styles.btn, styles.btnAccept]} onPress={handleAccept}>
                  <Text style={styles.btnTextAccept}>✓ Accept</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnEdit]} onPress={() => openEdit(suggestion)}>
                  <Text style={styles.btnTextEdit}>✎ Edit</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* editing */}
          {screen === 'editing' && (
            <View>
              <EditField label="Protein" value={editP} onChange={setEditP} unit="g"    aiVal={(suggestion ?? target)?.aiSuggested.protein_g ?? 0} />
              <EditField label="Fat"     value={editF} onChange={setEditF} unit="g"    aiVal={(suggestion ?? target)?.aiSuggested.fat_g ?? 0}     />
              <EditField label="Carbs"   value={editC} onChange={setEditC} unit="g"    aiVal={(suggestion ?? target)?.aiSuggested.carb_g ?? 0}    />
              <EditField label="Fiber"   value={editFi} onChange={setEditFi} unit="g" aiVal={(suggestion ?? target)?.aiSuggested.fiber_g ?? (suggestion ?? target)?.fiber_g ?? 0} />
              <EditField label="Calories"value={editK} onChange={setEditK} unit="kcal" aiVal={(suggestion ?? target)?.aiSuggested.kcal ?? 0}      />
              <View style={styles.suggBtns}>
                <Pressable style={[styles.btn, styles.btnAccept]} onPress={handleSaveEdit}>
                  <Text style={styles.btnTextAccept}>Save</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnEdit]} onPress={() => setScreen(target ? 'active' : suggestion ? 'suggestion' : 'idle')}>
                  <Text style={styles.btnTextEdit}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* active */}
          {screen === 'active' && target && (
            <View>
              {updatedLabel ? (
                <Text style={styles.updatedDetail}>{updatedLabel}</Text>
              ) : null}
              <MacroBar label="P" actual={actualProtein_g} target={target.protein_g} color="#4CAF50" />
              <MacroBar label="C" actual={actualCarb_g}    target={target.carb_g}    color="#FF9800" />
              <MacroBar label="F" actual={actualFat_g}     target={target.fat_g}     color="#2196F3" />
              <MacroBar label="Fi" actual={actualFiber_g} target={resolveFiberTarget_g(target)} color="#66BB6A" />
              <View style={styles.kcalRow}>
                <Text style={styles.kcalText}>
                  {actualKcal != null ? Math.round(actualKcal) : '—'} / {Math.round(target.kcal)} kcal
                </Text>
              </View>
              <Pressable style={styles.reanalyzeBtn} onPress={() => { setTarget(null); setScreen('idle'); }}>
                <Text style={styles.reanalyzeBtnText}>Re-analyze with AI</Text>
              </Pressable>
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
  headerUpdated: { fontSize: 11, color: WellnessColors.accentGreen, marginTop: 2, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  editLink: { fontSize: 13, color: WellnessColors.accentBlue, fontWeight: '600' },
  resetLink: { fontSize: 11, color: WellnessColors.textSecondary },
  chevron: { fontSize: 20, color: WellnessColors.textSecondary, fontWeight: '300' },

  body: { paddingHorizontal: 16, paddingBottom: 16 },

  idleWrap: { gap: 10 },
  hintText: { fontSize: 12, color: WellnessColors.textSecondary, fontStyle: 'italic' },
  errorText: { fontSize: 12, color: '#E53935' },
  aiBtn: { backgroundColor: WellnessColors.accentGreen, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  aiBtnDisabled: { backgroundColor: WellnessColors.gridLine },
  aiBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, color: WellnessColors.textSecondary },

  reasoningBox: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 12 },
  dietBadge: { fontSize: 12, fontWeight: '700', color: '#F57F17', marginBottom: 4 },
  reasoningText: { fontSize: 13, color: '#5D4037', lineHeight: 18 },

  suggestionRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 14 },
  suggItem: { alignItems: 'center', minWidth: 60 },
  suggVal: { fontSize: 18, fontWeight: '700', color: WellnessColors.textPrimary },
  suggUnit: { fontSize: 10, color: WellnessColors.textSecondary },
  suggLabel: { fontSize: 11, color: WellnessColors.textSecondary },

  suggBtns: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  btnAccept: { backgroundColor: WellnessColors.accentGreen },
  btnEdit: { borderWidth: 1.5, borderColor: WellnessColors.gridLine },
  btnTextAccept: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnTextEdit: { color: WellnessColors.textPrimary, fontWeight: '600', fontSize: 14 },

  activeLabelRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 },
  dietBadgeSmall: { fontSize: 11, fontWeight: '700', color: '#F57F17', backgroundColor: '#FFF8E1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  updatedDetail: { fontSize: 11, color: WellnessColors.accentGreen, fontWeight: '600', marginBottom: 8 },
  kcalRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: WellnessColors.gridLine, paddingTop: 8, marginTop: 4, marginBottom: 10 },
  kcalText: { fontSize: 13, fontWeight: '600', color: WellnessColors.textSecondary, textAlign: 'center' },
  reanalyzeBtn: { borderWidth: 1, borderColor: WellnessColors.gridLine, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  reanalyzeBtnText: { fontSize: 12, color: WellnessColors.textSecondary, fontWeight: '600' },
});
