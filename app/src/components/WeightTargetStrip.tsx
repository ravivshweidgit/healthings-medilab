/**
 * Section — Body composition targets.
 * States: idle → loading → suggestion → editing → active
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatShortDate } from '../i18n/dateLocale';
import { getBodyMetricsCopy } from '../i18n/bodyMetricsCopy';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { suggestBodyTargets, type BodyTargetInput } from '../services/GeminiService';
import { PERF_WARN_AI_MS, timeAsync } from '../services/AppDailyLogService';
import {
  getBodyTarget,
  saveBodyTarget,
  type BodyTarget,
  type UserLanguage,
} from '../services/TargetService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import {
  displayToKg,
  formatMass,
  kgToDisplay,
  massUnitLabel,
} from '../logic/unitConvert';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BodyTargetProps = {
  /** Current body metrics from Withings */
  weightKg: number | null;
  fatPct: number | null;
  muscleMass_kg: number | null;
  bmr_kcal: number | null;
  /** User profile */
  heightCm: number | null;
  age: number | null;
  gender: string | null;
  /** Computed trends */
  weeklyWeightChange_kg?: number | null;
  avgDailyDeficit_kcal?: number | null;
  lang?: UserLanguage | null;
  /** Hide Withings scale prompt when user logs body manually (no Withings scale). */
  hideWithingsScalePrompt?: boolean;
  massUnit?: 'kg' | 'lb';
};

type Screen = 'idle' | 'loading' | 'suggestion' | 'editing' | 'active';

// ─── Range scale ─────────────────────────────────────────────────────────────

function RangeScale({
  label,
  startVal,
  currentVal,
  targetVal,
  unit,
  color,
  higherIsBetter,
}: {
  label: string;
  startVal: number;
  currentVal: number;
  targetVal: number;
  unit: string;
  color: string;
  higherIsBetter?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const scaleStyles = useMemo(() => makeScaleStyles(colors, isDark), [colors, isDark]);
  const [trackWidth, setTrackWidth] = useState(0);

  // If current has slipped past the original start, use current as the left anchor
  const movingRight = targetVal > startVal;
  const effectiveStart = movingRight
    ? Math.min(startVal, currentVal)
    : Math.max(startVal, currentVal);

  const range = Math.abs(targetVal - effectiveStart);
  const progress = range > 0
    ? Math.min(1, Math.max(0, Math.abs(currentVal - effectiveStart) / range))
    : 0;
  const dotX = trackWidth > 0 ? progress * trackWidth : 0;

  const diff = targetVal - currentVal;
  const diffText = higherIsBetter
    ? (diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1))
    : (diff <= 0 ? diff.toFixed(1) : `+${diff.toFixed(1)}`);
  const atTarget = Math.abs(diff) < 0.15;

  return (
    <View style={scaleStyles.wrap}>
      <View style={scaleStyles.headerRow}>
        <Text style={scaleStyles.label}>{label}</Text>
        <Text style={[scaleStyles.diffText, atTarget && scaleStyles.diffDone]}>
          {atTarget ? '✓ Goal reached' : `${diffText} ${unit} to go`}
        </Text>
      </View>

      <View style={scaleStyles.trackRow}>
        <Text style={scaleStyles.endpoint}>{effectiveStart.toFixed(1)}</Text>
        <View
          style={scaleStyles.track}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <View style={[scaleStyles.fill, { width: dotX, backgroundColor: color }]} />
          {trackWidth > 0 && (
            <View style={[scaleStyles.dot, { left: dotX - 8, backgroundColor: color }]} />
          )}
        </View>
        <Text style={scaleStyles.endpoint}>{targetVal.toFixed(1)}</Text>
      </View>

      <Text style={[scaleStyles.currentLabel, { left: Math.max(40, Math.min(trackWidth - 10, dotX + 42)) }]}>
        {currentVal.toFixed(1)} {unit} now
      </Text>
    </View>
  );
}

const makeScaleStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  wrap: { marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: c.textSecondary },
  diffText: { fontSize: 11, color: c.textSecondary },
  diffDone: { color: c.accentGreen, fontWeight: '700' },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  endpoint: { fontSize: 11, fontWeight: '600', color: c.textSecondary, width: 36, textAlign: 'center' },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    // Dark: remaining distance reads as canvas, like the macro meters.
    backgroundColor: isDark ? c.background : c.gridLine,
    overflow: 'visible',
    position: 'relative',
  },
  fill: { height: '100%', borderRadius: 4 },
  dot: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  currentLabel: {
    position: 'absolute',
    bottom: -16,
    fontSize: 10,
    color: c.textSecondary,
  },
});

// ─── Edit field ───────────────────────────────────────────────────────────────

function EditField({
  label,
  value,
  onChange,
  unit,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  hint?: string;
}) {
  const { colors, isDark } = useTheme();
  const editStyles = useMemo(() => makeEditStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={editStyles.row}>
      <Text style={editStyles.label}>{label}</Text>
      <View style={editStyles.inputWrap}>
        <TextInput
          style={editStyles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          maxLength={8}
          selectTextOnFocus
        />
        <Text style={editStyles.unit}>{unit}</Text>
      </View>
      {hint ? (
        <Text style={editStyles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const makeEditStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 6 },
  label: { width: 56, fontSize: 12, fontWeight: '700', color: c.textSecondary },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 72,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    borderRadius: 12,
    backgroundColor: isDark ? c.background : c.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 16,
    fontWeight: '700',
    color: c.textPrimary,
    textAlign: 'center',
  },
  unit: { fontSize: 13, fontWeight: '600', color: c.textSecondary, flexShrink: 0 },
  hint: {
    fontSize: 11,
    color: c.textSecondary,
    maxWidth: 88,
    flexShrink: 1,
    textAlign: 'right',
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function WeightTargetStrip({
  weightKg,
  fatPct,
  muscleMass_kg,
  bmr_kcal,
  heightCm,
  age,
  gender,
  weeklyWeightChange_kg,
  avgDailyDeficit_kcal,
  lang,
  hideWithingsScalePrompt,
  massUnit = 'kg',
}: BodyTargetProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const bodyLabels = getBodyMetricsCopy(lang?.code);
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const [screen, setScreen] = useState<Screen>('idle');
  const [target, setTarget] = useState<BodyTarget | null>(null);
  const [suggestion, setSuggestion] = useState<BodyTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Edit fields
  const [editWeight, setEditWeight] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editMuscle, setEditMuscle] = useState('');
  const [editWeeks, setEditWeeks] = useState('');

  // Load stored target on mount
  useEffect(() => {
    getBodyTarget().then((t) => {
      if (t) { setTarget(t); setScreen('active'); }
      else { setExpanded(true); }  // open by default if no targets yet
    });
  }, []);

  const canAnalyze = !!(weightKg && fatPct != null && muscleMass_kg && bmr_kcal && heightCm && age && gender);

  const handleAiSuggest = useCallback(async () => {
    if (!canAnalyze) {
      setError('Need body scan data + profile (height, age, gender) to analyse.');
      return;
    }
    setError(null);
    setExpanded(true);
    setScreen('loading');
    try {
      const bmi = weightKg! / ((heightCm! / 100) ** 2);
      const input: BodyTargetInput = {
        weight_kg: weightKg!,
        fatPct: fatPct!,
        muscleMass_kg: muscleMass_kg!,
        bmr_kcal: bmr_kcal!,
        heightCm: heightCm!,
        age: age!,
        gender: gender!,
        bmi,
        weeklyWeightChange_kg,
        avgDailyDeficit_kcal,
      };
      const result = await timeAsync(
        'suggestBodyTargets',
        () => suggestBodyTargets(input, lang),
        {},
        PERF_WARN_AI_MS,
      );
      const now = new Date().toISOString();
      const proposed: BodyTarget = {
        targetWeight_kg: result.targetWeight_kg,
        targetFatPct: result.targetFatPct,
        targetMuscleMass_kg: result.targetMuscleMass_kg,
        aiWeight_kg: result.targetWeight_kg,
        aiFatPct: result.targetFatPct,
        aiMuscle_kg: result.targetMuscleMass_kg,
        startWeight_kg: weightKg!,
        startFatPct: fatPct!,
        startMuscle_kg: muscleMass_kg!,
        reasoning: result.reasoning,
        analyzedAt: now,
        estimatedWeeks: result.estimatedWeeks,
        targetWeeks: result.estimatedWeeks,
      };
      setSuggestion(proposed);
      setScreen('suggestion');
    } catch (e: any) {
      setError(e?.message ?? 'AI analysis failed');
      setScreen('idle');
    }
  }, [canAnalyze, weightKg, fatPct, muscleMass_kg, bmr_kcal, heightCm, age, gender, weeklyWeightChange_kg, avgDailyDeficit_kcal]);

  const handleAccept = useCallback(async () => {
    if (!suggestion) return;
    await saveBodyTarget(suggestion);
    setTarget(suggestion);
    setScreen('active');
  }, [suggestion]);

  const handleOpenEdit = useCallback(
    (src?: BodyTarget | null) => {
      const s = src ?? target;
      if (s) {
        setEditWeight(kgToDisplay(s.targetWeight_kg, massUnit).toFixed(1));
        setEditFat(s.targetFatPct.toFixed(1));
        setEditMuscle(kgToDisplay(s.targetMuscleMass_kg, massUnit).toFixed(1));
        const w = s.targetWeeks ?? s.estimatedWeeks;
        setEditWeeks(w != null && w > 0 ? String(Math.round(w)) : '');
      } else {
        setEditWeight(weightKg != null ? kgToDisplay(weightKg, massUnit).toFixed(1) : '');
        setEditFat(fatPct != null ? fatPct.toFixed(1) : '');
        setEditMuscle(muscleMass_kg != null ? kgToDisplay(muscleMass_kg, massUnit).toFixed(1) : '');
        setEditWeeks('');
      }
      setError(null);
      setScreen('editing');
    },
    [target, weightKg, fatPct, muscleMass_kg, massUnit],
  );

  const handleSaveEdit = useCallback(async () => {
    const base = suggestion ?? target;
    const w = displayToKg(parseFloat(editWeight), massUnit);
    const f = parseFloat(editFat);
    const m = displayToKg(parseFloat(editMuscle), massUnit);
    const weeks = parseInt(editWeeks, 10);
    if (isNaN(w) || isNaN(f) || isNaN(m) || w <= 0 || f <= 0 || m <= 0) {
      setError('Enter valid weight, fat %, and muscle mass.');
      return;
    }
    const now = new Date().toISOString();
    const updated: BodyTarget = {
      targetWeight_kg: w,
      targetFatPct: f,
      targetMuscleMass_kg: m,
      aiWeight_kg: base?.aiWeight_kg ?? w,
      aiFatPct: base?.aiFatPct ?? f,
      aiMuscle_kg: base?.aiMuscle_kg ?? m,
      startWeight_kg: base?.startWeight_kg ?? weightKg ?? w,
      startFatPct: base?.startFatPct ?? fatPct ?? f,
      startMuscle_kg: base?.startMuscle_kg ?? muscleMass_kg ?? m,
      reasoning: base?.reasoning?.trim() ? base.reasoning : 'Manual target',
      analyzedAt: base?.analyzedAt ?? now,
      estimatedWeeks: base?.estimatedWeeks,
      targetWeeks: !isNaN(weeks) && weeks > 0 ? weeks : base?.targetWeeks,
    };
    await saveBodyTarget(updated);
    setTarget(updated);
    setSuggestion(null);
    setError(null);
    setScreen('active');
  }, [editWeight, editFat, editMuscle, editWeeks, suggestion, target, weightKg, fatPct, muscleMass_kg, massUnit]);

  // ── Summary line shown in collapsed header ────────────────────────────────
  const massLab = massUnitLabel(massUnit);
  const headerSub = target
    ? `${formatMass(target.targetWeight_kg, massUnit)} · ${target.targetFatPct.toFixed(1)}% ${bodyLabels.fat} · ${formatMass(target.targetMuscleMass_kg, massUnit)} ${bodyLabels.muscle}${
        (target.targetWeeks ?? target.estimatedWeeks)
          ? ` · ${target.targetWeeks ?? target.estimatedWeeks}w`
          : ''
      }`
    : 'Tap to set your body goals';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.card}>
      <DashboardCollapseHeader
        title={profileTitles.myTargets}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        titleRtl={lang?.code === 'he' || lang?.code === 'ar'}
        collapseLabel="Collapse my targets"
        expandLabel="Expand my targets"
        subtitleNumberOfLines={2}
        perfTag="WeightTargetStrip"
      />

      {!expanded ? null : <View style={styles.body}>

      {/* ── idle ── */}
      {screen === 'idle' && (
        <View style={styles.idleWrap}>
          <Text style={styles.idleText}>
            Set weight, body comp, and weeks to goal — edit anytime without AI.
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable style={styles.manualBtn} onPress={() => handleOpenEdit()}>
            <Text style={styles.manualBtnText}>✎ Set / edit targets</Text>
          </Pressable>
          <Pressable
            style={[styles.aiBtnOutline, !canAnalyze && styles.aiBtnDisabled]}
            onPress={handleAiSuggest}
            disabled={!canAnalyze}
          >
            <Text style={[styles.aiBtnOutlineText, !canAnalyze && styles.aiBtnOutlineTextDisabled]}>
              ✨ Suggest with AI {canAnalyze ? '' : '(needs Withings + profile)'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── loading ── */}
      {screen === 'loading' && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accentGreen} />
          <Text style={styles.loadingText}>Analysing your body composition…</Text>
        </View>
      )}

      {/* ── suggestion ── */}
      {screen === 'suggestion' && suggestion && (
        <View>
          <View style={styles.reasoningBox}>
            <Text style={styles.reasoningIcon}>💡</Text>
            <Text style={styles.reasoningText}>{suggestion.reasoning}</Text>
          </View>
          <View style={styles.suggestionRow}>
            <View style={styles.suggestionItem}>
              <Text style={styles.suggestionVal}>
                {kgToDisplay(suggestion.aiWeight_kg, massUnit).toFixed(1)} {massLab}
              </Text>
              <Text style={styles.suggestionLabel}>{bodyLabels.weight}</Text>
            </View>
            <View style={styles.suggestionItem}>
              <Text style={styles.suggestionVal}>{suggestion.aiFatPct.toFixed(1)}%</Text>
              <Text style={styles.suggestionLabel}>{bodyLabels.fat}</Text>
            </View>
            <View style={styles.suggestionItem}>
              <Text style={styles.suggestionVal}>
                {kgToDisplay(suggestion.aiMuscle_kg, massUnit).toFixed(1)} {massLab}
              </Text>
              <Text style={styles.suggestionLabel}>{bodyLabels.muscle}</Text>
            </View>
            {suggestion.estimatedWeeks ? (
              <View style={styles.suggestionItem}>
                <Text style={styles.suggestionVal}>{suggestion.estimatedWeeks}w</Text>
                <Text style={styles.suggestionLabel}>Est.</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.suggestionBtns}>
            <Pressable style={[styles.suggestionBtn, styles.suggestionBtnAccept]} onPress={handleAccept}>
              <Text style={styles.suggestionBtnTextAccept}>✓ Accept</Text>
            </Pressable>
            <Pressable style={[styles.suggestionBtn, styles.suggestionBtnEdit]} onPress={() => handleOpenEdit(suggestion)}>
              <Text style={styles.suggestionBtnTextEdit}>✎ Edit</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── editing ── */}
      {screen === 'editing' && (
        <View>
          <Text style={styles.editHint}>
            {target || suggestion ? 'Update your targets' : 'Enter your targets (saved locally)'}
          </Text>
          <EditField
            label={bodyLabels.weight}
            value={editWeight}
            onChange={setEditWeight}
            unit={massLab}
            hint={weightKg != null ? `now ${kgToDisplay(weightKg, massUnit).toFixed(1)}` : undefined}
          />
          <EditField
            label={bodyLabels.fatPct}
            value={editFat}
            onChange={setEditFat}
            unit="%"
            hint={fatPct != null ? `now ${fatPct.toFixed(1)}` : undefined}
          />
          <EditField
            label={bodyLabels.muscle}
            value={editMuscle}
            onChange={setEditMuscle}
            unit={massLab}
            hint={
              muscleMass_kg != null
                ? `now ${kgToDisplay(muscleMass_kg, massUnit).toFixed(1)}`
                : undefined
            }
          />
          <EditField
            label="Weeks"
            value={editWeeks}
            onChange={setEditWeeks}
            unit="wks"
            hint="macro energy"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <View style={styles.editBtns}>
            <Pressable style={[styles.suggestionBtn, styles.suggestionBtnAccept]} onPress={handleSaveEdit}>
              <Text style={styles.suggestionBtnTextAccept}>Save</Text>
            </Pressable>
            <Pressable
              style={[styles.suggestionBtn, styles.suggestionBtnEdit]}
              onPress={() => setScreen(target ? 'active' : suggestion ? 'suggestion' : 'idle')}
            >
              <Text style={styles.suggestionBtnTextEdit}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── active ── */}
      {screen === 'active' && target && (
        <View style={styles.activeWrap}>
          {weightKg != null && fatPct != null && muscleMass_kg != null ? (
            <>
              <RangeScale
                label={bodyLabels.weight}
                startVal={kgToDisplay(target.startWeight_kg, massUnit)}
                currentVal={kgToDisplay(weightKg, massUnit)}
                targetVal={kgToDisplay(target.targetWeight_kg, massUnit)}
                unit={massLab}
                color={colors.accentBlue}
              />
              <RangeScale
                label={bodyLabels.fatPct}
                startVal={target.startFatPct}
                currentVal={fatPct}
                targetVal={target.targetFatPct}
                unit="%"
                color="#EF5350"
              />
              <RangeScale
                label={bodyLabels.muscle}
                startVal={kgToDisplay(target.startMuscle_kg, massUnit)}
                currentVal={kgToDisplay(muscleMass_kg, massUnit)}
                targetVal={kgToDisplay(target.targetMuscleMass_kg, massUnit)}
                unit={massLab}
                color={colors.accentGreen}
                higherIsBetter
              />
            </>
          ) : (
            <View style={styles.manualSummary}>
              <Text style={styles.manualSummaryLine}>
                Target: {formatMass(target.targetWeight_kg, massUnit)} · {target.targetFatPct.toFixed(1)}%{' '}
                {bodyLabels.fat} · {formatMass(target.targetMuscleMass_kg, massUnit)} {bodyLabels.muscle}
              </Text>
              {!hideWithingsScalePrompt ? (
                <Text style={styles.manualSummarySub}>Link Withings for progress scales</Text>
              ) : (
                <Text style={styles.manualSummarySub}>Log weigh-ins in Profile to track progress</Text>
              )}
            </View>
          )}

          {(target.targetWeeks ?? target.estimatedWeeks) ? (
            <Text style={styles.paceText}>
              {target.targetWeeks
                ? `Target: ${target.targetWeeks} weeks to reach goal (drives macro kcal)`
                : `~${target.estimatedWeeks} weeks estimated — tap ✎ to set your timeline`}
            </Text>
          ) : (
            <Text style={styles.paceText}>Tap ✎ to set weeks to goal (drives macro kcal)</Text>
          )}

          {target.reasoning && target.reasoning !== 'Manual target' ? (
            <View style={styles.reasoningBox}>
              <Text style={styles.reasoningIcon}>💡</Text>
              <View style={styles.reasoningContent}>
                <Text style={styles.reasoningText}>{target.reasoning}</Text>
                <Text style={styles.analyzedAt}>
                  AI · {formatShortDate(target.analyzedAt, lang?.code)}
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable style={styles.editTargetsBtn} onPress={() => handleOpenEdit()}>
            <Text style={styles.editTargetsBtnText}>✎ Edit targets</Text>
          </Pressable>

          {canAnalyze ? (
            <Pressable style={styles.reanalyzeBtn} onPress={handleAiSuggest}>
              <Text style={styles.reanalyzeBtnText}>Suggest with AI</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      </View>}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  card: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  // ── Expanded body ──
  body: { marginTop: 8, paddingHorizontal: 4 },

  // idle
  idleWrap: { alignItems: 'stretch', paddingVertical: 8, gap: 10 },
  idleText: { fontSize: 13, color: c.textSecondary, textAlign: 'center', lineHeight: 18 },
  errorText: { fontSize: 12, color: isDark ? c.accentRed : '#E53935', textAlign: 'center' },
  manualBtn: {
    backgroundColor: isDark ? c.background : c.accentBlue,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  manualBtnText: { color: isDark ? c.accentBlue : '#fff', fontWeight: '700', fontSize: 14 },
  aiBtn: {
    backgroundColor: isDark ? c.background : c.accentBlue,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  aiBtnOutline: {
    borderWidth: 1.5,
    borderColor: c.gridLine,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignItems: 'center',
  },
  aiBtnOutlineText: { color: c.textPrimary, fontWeight: '600', fontSize: 13 },
  aiBtnOutlineTextDisabled: { color: c.textSecondary },
  aiBtnDisabled: { borderColor: c.gridLine, opacity: 0.7 },
  aiBtnText: { color: isDark ? c.accentBlue : '#fff', fontWeight: '700', fontSize: 14 },
  editHint: {
    fontSize: 12,
    color: c.textSecondary,
    marginBottom: 12,
    textAlign: 'center',
  },

  // loading
  loadingWrap: { alignItems: 'center', paddingVertical: 20, gap: 12 },
  loadingText: { fontSize: 14, color: c.textSecondary },

  // suggestion
  suggestionRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 14, marginTop: 4 },
  suggestionItem: { alignItems: 'center', gap: 2, minWidth: 68 },
  suggestionVal: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
  suggestionLabel: { fontSize: 11, color: c.textSecondary },
  suggestionBtns: { flexDirection: 'row', gap: 10 },
  suggestionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  suggestionBtnAccept: {
    backgroundColor: isDark ? c.background : c.accentBlue,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
  },
  suggestionBtnEdit: {
    borderWidth: 1.5,
    borderColor: c.gridLine,
    backgroundColor: isDark ? c.background : 'transparent',
  },
  suggestionBtnTextAccept: { color: isDark ? c.accentBlue : '#fff', fontWeight: '700', fontSize: 14 },
  suggestionBtnTextEdit: { color: c.textSecondary, fontWeight: '600', fontSize: 14 },

  // editing
  editBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },

  // reasoning
  reasoningBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: isDark ? c.background : '#FFF8E1',
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? c.noticeSoftBorder : 'transparent',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    marginTop: 4,
  },
  reasoningIcon: { fontSize: 16 },
  reasoningContent: { flex: 1 },
  reasoningText: { fontSize: 13, color: isDark ? c.textPrimary : '#5D4037', lineHeight: 18, flex: 1 },
  analyzedAt: { fontSize: 10, color: c.textSecondary, marginTop: 4 },

  // active
  activeWrap: {},
  manualSummary: {
    backgroundColor: isDark ? c.background : c.gridLine,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? c.gridLine : 'transparent',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  manualSummaryLine: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  manualSummarySub: { fontSize: 11, color: c.textSecondary, marginTop: 4 },
  editTargetsBtn: {
    backgroundColor: isDark ? c.background : c.accentBlue,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  editTargetsBtnText: { fontSize: 14, color: isDark ? c.accentBlue : '#fff', fontWeight: '700' },
  paceText: {
    fontSize: 12,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: -8,
  },
  reanalyzeBtn: {
    borderWidth: 1.5,
    borderColor: c.gridLine,
    backgroundColor: isDark ? c.background : 'transparent',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  reanalyzeBtnText: { fontSize: 12, color: c.textSecondary, fontWeight: '600' },
});
