/**
 * My Macros â€” AI-suggested daily macro targets with progress bars.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatLocalizedDate, formatLocalizedTime } from '../i18n/dateLocale';
import { suggestMacroTargets, confirmSavedMacroTarget, macroSuggestionToDailyTarget } from '../logic/macroAutoAdjust';
import { contentAlignStyle } from '../logic/textDirection';
import { buildAndExportMacroPrompt } from '../services/macroPromptExport';
import { RulesAdviceBanner } from './RulesAdviceBanner';
import { MacroClinicalProfileBanner } from './MacroClinicalProfileBanner';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import {
  getMacroTarget,
  getMentors,
  getUserRules,
  resolveFiberTarget_g,
  resolveNetCarbTarget_g,
  saveMacroTarget,
  withCarbFiberNetTargets,
  type BodyTarget,
  type DailyMacroTarget,
  type MentorType,
  type UserRules,
  type UserLanguage,
} from '../services/TargetService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import {
  DEFAULT_WATER_GOAL_ML,
  getWaterGoalMl,
  getWaterMl,
  setWaterGoalMl,
} from '../services/WaterPersistenceService';
import { foodLogDayKey } from '../services/FoodLogService';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';
import { DEFAULT_UNITS_PREFS } from '../services/UnitsPreferenceService';
import {
  displayToKcal,
  displayToMl,
  energyUnitLabel,
  kcalToDisplay,
  mlToDisplay,
  parseLocaleNumber,
  waterUnitLabel,
} from '../logic/unitConvert';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  /** Parent-held target â€” refreshes strip after weigh-in/lab auto-revision. */
  savedTarget?: DailyMacroTarget | null;
  onSaved?: (t: DailyMacroTarget) => void;
  /** Weigh-in blocked auto-save â€” parent injects Gemini proposal for one-tap Accept. */
  weighInSuggestion?: DailyMacroTarget | null;
  weighInSuggestionHint?: string | null;
  onWeighInSuggestionConsumed?: () => void;
  /** Increment to auto-run Analyze (e.g. when weigh-in Gemini failed). */
  analyzeRequestId?: number;
  expanded: boolean;
  onToggleExpand: () => void;
  lang?: UserLanguage | null;
  unitsPrefs?: UnitsPrefs;
};

type Screen = 'idle' | 'loading' | 'suggestion' | 'editing' | 'active';

function formatMacroUpdatedAt(iso: string | undefined, lang?: UserLanguage | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const code = (lang?.code || 'en').toLowerCase().slice(0, 2);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = formatLocalizedTime(d, code, { hour: '2-digit', minute: '2-digit' });
  if (sameDay) {
    if (code === 'he') return `×¢×•×“×›×Ÿ ×”×™×•× ${time}`;
    if (code === 'ar') return `Ø­ÙØ¯Ù‘Ø« Ø§Ù„ÙŠÙˆÙ… ${time}`;
    if (code === 'es') return `Actualizado hoy ${time}`;
    if (code === 'fr') return `Mis Ã  jour aujourd'hui ${time}`;
    if (code === 'de') return `Heute aktualisiert ${time}`;
    if (code === 'ru') return `ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¾ ÑÐµÐ³Ð¾Ð´Ð½Ñ ${time}`;
    if (code === 'pt') return `Atualizado hoje ${time}`;
    if (code === 'it') return `Aggiornato oggi ${time}`;
    if (code === 'tr') return `BugÃ¼n gÃ¼ncellendi ${time}`;
    return `Updated today ${time}`;
  }
  const date = formatLocalizedDate(d, code, { day: 'numeric', month: 'short' });
  if (code === 'he') return `×¢×•×“×›×Ÿ ${date} ${time}`;
  if (code === 'ar') return `Ø­ÙØ¯Ù‘Ø« ${date} ${time}`;
  if (code === 'es') return `Actualizado ${date} ${time}`;
  if (code === 'fr') return `Mis Ã  jour ${date} ${time}`;
  if (code === 'de') return `Aktualisiert ${date} ${time}`;
  if (code === 'ru') return `ÐžÐ±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¾ ${date} ${time}`;
  if (code === 'pt') return `Atualizado ${date} ${time}`;
  if (code === 'it') return `Aggiornato ${date} ${time}`;
  if (code === 'tr') return `GÃ¼ncellendi ${date} ${time}`;
  return `Updated ${date} ${time}`;
}

// â”€â”€â”€ Macro bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MacroBar({
  label,
  actual,
  target,
  color,
  unit = 'g',
  onPress,
}: {
  label: string;
  actual: number | null;
  target: number;
  color: string;
  unit?: 'g' | 'kcal' | 'kj' | 'ml' | 'floz';
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const barStyles = useMemo(() => makeBarStyles(colors), [colors]);
  const pct = actual != null && target > 0 ? Math.min(1, actual / target) : 0;
  const over = actual != null && actual > target * 1.1;
  const suffix =
    unit === 'g' ? 'g' : unit === 'ml' ? 'ml' : unit === 'floz' ? 'fl oz' : '';
  const fmt = (v: number) =>
    unit === 'floz' ? v.toFixed(1) : String(Math.round(v));
  const actualText = actual != null ? fmt(actual) : 'â€”';
  const valueText =
    unit === 'kcal' || unit === 'kj'
      ? `${actualText} / ${Math.round(target)}`
      : `${actualText} / ${fmt(target)}${suffix}`;

  const row = (
    <View style={barStyles.row}>
      <Text style={barStyles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct * 100}%`, backgroundColor: over ? '#EF5350' : color }]} />
      </View>
      <Text
        style={[barStyles.nums, over && barStyles.numsOver]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}
      >
        {valueText}
      </Text>
    </View>
  );

  if (!onPress) return row;
  return (
    <Pressable style={barStyles.rowPressable} onPress={onPress} accessibilityRole="button" hitSlop={4}>
      {row}
    </Pressable>
  );
}

const makeBarStyles = (c: ThemeColors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8, width: '100%' },
  rowPressable: { alignSelf: 'stretch' },
  label: {
    width: 34,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '700',
    color: c.textSecondary,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.progressTrack ?? c.gridLine,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  nums: {
    width: 98,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '600',
    color: c.textPrimary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  numsOver: { color: '#EF5350' },
});

// â”€â”€â”€ Edit field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EditField({
  label, value, onChange, unit, aiVal, hint,
}: { label: string; value: string; onChange: (v: string) => void; unit: string; aiVal?: number; hint?: string }) {
  const { colors } = useTheme();
  const editStyles = useMemo(() => makeEditStyles(colors), [colors]);
  return (
    <View style={editStyles.row}>
      <Text style={editStyles.label}>{label}</Text>
      <TextInput
        style={editStyles.input}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        maxLength={8}
        selectTextOnFocus
      />
      <Text style={editStyles.unit}>{unit}</Text>
      <Text style={editStyles.ai}>{hint ?? (aiVal != null ? `AI: ${Math.round(aiVal)}` : '')}</Text>
    </View>
  );
}

const makeEditStyles = (c: ThemeColors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  label: { width: 70, fontSize: 12, fontWeight: '700', color: c.textSecondary },
  input: {
    flex: 1, borderWidth: 1.5, borderColor: c.gridLine,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    fontSize: 15, fontWeight: '700', color: c.textPrimary, textAlign: 'center',
  },
  unit: { fontSize: 12, color: c.textSecondary, flexShrink: 0 },
  ai: { maxWidth: 72, fontSize: 11, color: c.textSecondary, textAlign: 'right', flexShrink: 1 },
});

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function MacroTargetStrip({
  actualProtein_g, actualFat_g, actualCarb_g, actualFiber_g, actualKcal,
  weightKg, fatMassKg, muscleMass_kg, bmr_kcal, estimatedBurn_kcal,
  heightCm, age, gender, bodyTarget, userRules, mentors, savedTarget,
  onSaved, weighInSuggestion, weighInSuggestionHint, onWeighInSuggestionConsumed,
  analyzeRequestId, expanded, onToggleExpand, lang,
  unitsPrefs = DEFAULT_UNITS_PREFS,
}: MacroTargetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const [screen, setScreen] = useState<Screen>('idle');
  const [target, setTarget] = useState<DailyMacroTarget | null>(null);
  const [suggestion, setSuggestion] = useState<DailyMacroTarget | null>(null);
  const [suggestionHint, setSuggestionHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editP, setEditP] = useState('');
  const [editF, setEditF] = useState('');
  const [editC, setEditC] = useState('');
  const [editFi, setEditFi] = useState('');
  const [editNet, setEditNet] = useState('');
  const [editK, setEditK] = useState('');
  const [editWater, setEditWater] = useState('');
  const [waterGoalMl, setWaterGoalMlState] = useState(DEFAULT_WATER_GOAL_ML);
  const [waterMl, setWaterMlState] = useState(0);
  const [waterGoalModalVisible, setWaterGoalModalVisible] = useState(false);
  const [waterGoalInput, setWaterGoalInput] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const [rulesAdvice, setRulesAdvice] = useState<string | null>(null);
  const lastAnalyzeRequestId = useRef(0);

  useEffect(() => {
    if (!weighInSuggestion) return;
    setSuggestion(withCarbFiberNetTargets(weighInSuggestion));
    setSuggestionHint(weighInSuggestionHint ?? null);
    setScreen('suggestion');
    onWeighInSuggestionConsumed?.();
  }, [weighInSuggestion, weighInSuggestionHint, onWeighInSuggestionConsumed]);

  useEffect(() => {
    getMacroTarget().then((t) => { if (t) { setTarget(withCarbFiberNetTargets(t)); setScreen('active'); } });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [goal, ml] = await Promise.all([getWaterGoalMl(), getWaterMl(foodLogDayKey(Date.now()))]);
      if (cancelled) return;
      setWaterGoalMlState(goal);
      setWaterMlState(ml);
    })();
    return () => { cancelled = true; };
  }, [expanded]);

  useEffect(() => {
    if (savedTarget) {
      setTarget(withCarbFiberNetTargets(savedTarget));
      setScreen((s) => (s === 'loading' || s === 'suggestion' || s === 'editing' ? s : 'active'));
    }
  }, [savedTarget]);

  const canAnalyze = !!(weightKg && fatMassKg != null && muscleMass_kg && bmr_kcal && heightCm && age && gender);

  const headerSub = target
    ? `${target.protein_g}P / ${target.fat_g}F / ${target.carb_g}C / ${resolveFiberTarget_g(target)}Fi / ${resolveNetCarbTarget_g(target)}Net`
    : 'Tap to set AI macro targets';

  const updatedLabel = target ? formatMacroUpdatedAt(target.analyzedAt, lang) : null;

  const handleAsk = useCallback(async () => {
    if (!canAnalyze) { setError('Need body scan data and profile to analyse.'); return; }
    setError(null);
    setRulesAdvice(null);
    setSuggestionHint(null);
    setScreen('loading');
    try {
      const [{ suggestion: result }, rules, mentorList] = await Promise.all([
        suggestMacroTargets({ trigger: 'dashboard-suggest', lang }),
        getUserRules(),
        getMentors(),
      ]);
      setRulesAdvice(result.rules_advice ?? null);
      const proposed = macroSuggestionToDailyTarget(result, rules, mentorList);
      setSuggestion(proposed);
      setScreen('suggestion');
    } catch (e: any) {
      setError(e?.message ?? 'AI analysis failed');
      setScreen('idle');
    }
  }, [canAnalyze, lang]);

  useEffect(() => {
    if (analyzeRequestId == null || analyzeRequestId <= 0) return;
    if (analyzeRequestId === lastAnalyzeRequestId.current) return;
    lastAnalyzeRequestId.current = analyzeRequestId;
    void handleAsk();
  }, [analyzeRequestId, handleAsk]);

  const handleExportPrompt = useCallback(async () => {
    setExportBusy(true);
    setError(null);
    try {
      const result = await buildAndExportMacroPrompt({ trigger: 'dashboard-suggest', lang });
      if (!result.ok) {
        Alert.alert(lang?.code === 'he' ? '×‘×•×˜×œ' : 'Cancelled', lang?.code === 'he' ? '×œ× × ×‘×—×¨ ×ª×™×§×™×™×”' : 'No folder selected');
        return;
      }
      Alert.alert(
        lang?.code === 'he' ? '×¤×¨×•×ž×¤×˜ ×™×•×¦×' : 'Prompt exported',
        lang?.code === 'he'
          ? `${result.charCount.toLocaleString()} ×ª×•×•×™× Â· macro-gemini-prompt_${new Date().toISOString().slice(0, 10)}.txt`
          : `${result.charCount.toLocaleString()} chars Â· macro-gemini-prompt_${new Date().toISOString().slice(0, 10)}.txt`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      setError(msg);
    } finally {
      setExportBusy(false);
    }
  }, [lang]);

  const exportPromptLink = (
    <Pressable
      style={styles.exportPromptBtn}
      onPress={handleExportPrompt}
      disabled={exportBusy}
    >
      {exportBusy ? (
        <ActivityIndicator size="small" color={colors.accentBlue} />
      ) : (
        <Text style={styles.exportPromptText}>
          {lang?.code === 'he' ? '×™×™×¦×•× ×¤×¨×•×ž×¤×˜ Gemini (×œ×œ× ×§×¨×™××ª AI)' : 'Export Gemini prompt (no AI call)'}
        </Text>
      )}
    </Pressable>
  );

  const handleAccept = useCallback(async () => {
    if (!suggestion) return;
    await confirmSavedMacroTarget(suggestion);
    setTarget(suggestion);
    onSaved?.(suggestion);
    setSuggestionHint(null);
    setScreen('active');
  }, [suggestion, onSaved]);

  const energyLab = energyUnitLabel(unitsPrefs.energy);
  const waterLab = waterUnitLabel(unitsPrefs.water);

  const openEdit = useCallback((src: DailyMacroTarget) => {
    const fi = resolveFiberTarget_g(src);
    setEditP(String(src.protein_g));
    setEditF(String(src.fat_g));
    setEditC(String(src.carb_g));
    setEditFi(String(fi));
    setEditNet(String(resolveNetCarbTarget_g(src)));
    setEditK(String(Math.round(kcalToDisplay(src.kcal, unitsPrefs.energy))));
    setEditWater(
      unitsPrefs.water === 'floz'
        ? mlToDisplay(waterGoalMl, 'floz').toFixed(1)
        : String(Math.round(waterGoalMl)),
    );
    setScreen('editing');
  }, [waterGoalMl, unitsPrefs.energy, unitsPrefs.water]);

  const handleSaveEdit = useCallback(async () => {
    const base = suggestion ?? target;
    if (!base) return;
    const p = parseFloat(editP);
    const f = parseFloat(editF);
    let c = parseFloat(editC);
    let fi = parseFloat(editFi);
    const net = parseFloat(editNet);
    const kRaw = parseLocaleNumber(editK);
    const k = kRaw != null ? Math.round(displayToKcal(kRaw, unitsPrefs.energy)) : NaN;
    if ([p, f, k].some(isNaN)) return;
    // Nutritionist-first: if Net is set, total C = Net + Fi (then sanitize clamps Fi â‰¤ C).
    if (!isNaN(net) && net >= 0) {
      if (isNaN(fi) || fi < 0) fi = resolveFiberTarget_g(base);
      c = Math.round(net + fi);
    } else if (isNaN(c)) {
      return;
    }
    if (isNaN(fi) || fi < 0) fi = resolveFiberTarget_g(base);
    const updated = withCarbFiberNetTargets({
      ...base,
      protein_g: p,
      fat_g: f,
      carb_g: c,
      fiber_g: fi,
      net_carb_g: !isNaN(net) ? net : undefined,
      kcal: k,
      analyzedAt: new Date().toISOString(),
    });
    await saveMacroTarget(updated, { userEdited: true });
    const wRaw = parseLocaleNumber(editWater);
    const w = wRaw != null ? Math.round(displayToMl(wRaw, unitsPrefs.water)) : NaN;
    if (!isNaN(w) && w > 0 && w !== waterGoalMl) {
      await setWaterGoalMl(w);
      setWaterGoalMlState(w);
    }
    setTarget(updated);
    onSaved?.(updated);
    setSuggestion(null);
    setScreen('active');
  }, [editP, editF, editC, editFi, editNet, editK, editWater, waterGoalMl, suggestion, target, onSaved, unitsPrefs.energy, unitsPrefs.water]);

  const openWaterGoalModal = useCallback(() => {
    setWaterGoalInput(
      unitsPrefs.water === 'floz'
        ? mlToDisplay(waterGoalMl, 'floz').toFixed(1)
        : String(Math.round(waterGoalMl)),
    );
    setWaterGoalModalVisible(true);
  }, [waterGoalMl, unitsPrefs.water]);

  const handleSaveWaterGoal = useCallback(async () => {
    const n = parseLocaleNumber(waterGoalInput);
    const goal =
      n != null && n > 0
        ? Math.round(displayToMl(n, unitsPrefs.water))
        : DEFAULT_WATER_GOAL_ML;
    await setWaterGoalMl(goal);
    setWaterGoalMlState(goal);
    setWaterGoalModalVisible(false);
  }, [waterGoalInput, unitsPrefs.water]);

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={profileTitles.myMacros}
        subtitle={headerSub}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={lang?.code === 'he' || lang?.code === 'ar'}
        collapseLabel="Collapse my macros"
        expandLabel="Expand my macros"
        subtitleNumberOfLines={2}
      />

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
                <Text style={styles.aiBtnText}>âœ¨ Ask AI to set my macros</Text>
              </Pressable>
              {exportPromptLink}
            </View>
          )}

          {/* loading */}
          {screen === 'loading' && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accentGreen} />
              <Text style={styles.loadingText}>Calculating your macrosâ€¦</Text>
            </View>
          )}

          {/* suggestion */}
          {screen === 'suggestion' && suggestion && (
            <View>
              {suggestionHint ? (
                <Text style={[styles.weighInHint, lang?.code === 'he' && styles.rtl]}>
                  {suggestionHint}
                </Text>
              ) : null}
              {rulesAdvice ? (
                <RulesAdviceBanner
                  advice={rulesAdvice}
                  rtl={lang?.code === 'he' || lang?.code === 'ar'}
                />
              ) : null}
              {suggestion.clinical_profile ? (
                <MacroClinicalProfileBanner
                  clinicalProfile={suggestion.clinical_profile}
                  pcfPriority={suggestion.pcf_priority}
                  macroOrder={suggestion.macro_order}
                />
              ) : null}
              <View style={styles.reasoningBox}>
                <Text style={[styles.reasoningText, contentAlignStyle(suggestion.reasoning)]}>{suggestion.reasoning}</Text>
              </View>
              <View style={styles.suggestionRow}>
                {[
                  { label: 'Protein', val: suggestion.protein_g, unit: 'g' },
                  { label: 'Fat',     val: suggestion.fat_g,     unit: 'g' },
                  { label: 'Carbs',   val: suggestion.carb_g,    unit: 'g' },
                  { label: 'Fiber',   val: suggestion.fiber_g ?? 30, unit: 'g' },
                  { label: 'Net',     val: resolveNetCarbTarget_g(suggestion), unit: 'g' },
                  {
                    label: 'Energy',
                    val: Math.round(kcalToDisplay(suggestion.kcal, unitsPrefs.energy)),
                    unit: energyLab,
                  },
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
                  <Text style={styles.btnTextAccept}>âœ“ Accept</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnEdit]} onPress={() => openEdit(suggestion)}>
                  <Text style={styles.btnTextEdit}>âœŽ Edit</Text>
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
              <EditField
                label="Net carbs"
                value={editNet}
                onChange={setEditNet}
                unit="g"
                aiVal={
                  (suggestion ?? target)?.aiSuggested.net_carb_g ??
                  (suggestion ?? target ? resolveNetCarbTarget_g((suggestion ?? target)!) : 0)
                }
              />
              <EditField
                label={energyLab}
                value={editK}
                onChange={setEditK}
                unit={energyLab}
                aiVal={Math.round(
                  kcalToDisplay((suggestion ?? target)?.aiSuggested.kcal ?? 0, unitsPrefs.energy),
                )}
              />
              <EditField
                label="Water"
                value={editWater}
                onChange={setEditWater}
                unit={waterLab}
                hint={`def ${
                  unitsPrefs.water === 'floz'
                    ? mlToDisplay(DEFAULT_WATER_GOAL_ML, 'floz').toFixed(1)
                    : DEFAULT_WATER_GOAL_ML
                }`}
              />
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
              {target.clinical_profile ? (
                <MacroClinicalProfileBanner
                  clinicalProfile={target.clinical_profile}
                  pcfPriority={target.pcf_priority}
                  macroOrder={target.macro_order}
                  compact
                />
              ) : null}
              <MacroBar
                label={unitsPrefs.energy === 'kj' ? 'kJ' : 'kcal'}
                actual={actualKcal != null ? kcalToDisplay(actualKcal, unitsPrefs.energy) : null}
                target={kcalToDisplay(target.kcal, unitsPrefs.energy)}
                color="#5C6BC0"
                unit={unitsPrefs.energy === 'kj' ? 'kj' : 'kcal'}
              />
              <MacroBar label="P" actual={actualProtein_g} target={target.protein_g} color="#4CAF50" />
              <MacroBar label="C" actual={actualCarb_g}    target={target.carb_g}    color="#FF9800" />
              <MacroBar label="F" actual={actualFat_g}     target={target.fat_g}     color="#2196F3" />
              <MacroBar label="Fi" actual={actualFiber_g} target={resolveFiberTarget_g(target)} color="#66BB6A" />
              <MacroBar
                label="Net"
                actual={
                  actualCarb_g != null && actualFiber_g != null
                    ? Math.max(0, Math.round(actualCarb_g - actualFiber_g))
                    : null
                }
                target={resolveNetCarbTarget_g(target)}
                color="#FB8C00"
              />
              <MacroBar
                label="H2O"
                actual={mlToDisplay(waterMl, unitsPrefs.water)}
                target={mlToDisplay(waterGoalMl, unitsPrefs.water)}
                color="#29B6F6"
                unit={unitsPrefs.water === 'floz' ? 'floz' : 'ml'}
                onPress={openWaterGoalModal}
              />
              <Text style={styles.h2oHint}>Tap H2O bar to edit water goal</Text>
              <Pressable style={[styles.btn, styles.btnEdit, styles.editTargetsBtn]} onPress={() => openEdit(target)}>
                <Text style={styles.btnTextEdit}>âœŽ Edit</Text>
              </Pressable>
              <Pressable style={styles.reanalyzeBtn} onPress={() => void handleAsk()}>
                <Text style={styles.reanalyzeBtnText}>Re-analyze with AI</Text>
              </Pressable>
              {exportPromptLink}
            </View>
          )}
        </View>
      )}

      <Modal visible={waterGoalModalVisible} transparent animationType="fade" onRequestClose={() => setWaterGoalModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setWaterGoalModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Water goal</Text>
            <Text style={styles.modalSub}>
              Daily H2O target in {waterLab} (default{' '}
              {unitsPrefs.water === 'floz'
                ? mlToDisplay(DEFAULT_WATER_GOAL_ML, 'floz').toFixed(1)
                : DEFAULT_WATER_GOAL_ML.toLocaleString()}
              ).
            </Text>
            <TextInput
              style={styles.modalInput}
              value={waterGoalInput}
              onChangeText={setWaterGoalInput}
              keyboardType={unitsPrefs.water === 'floz' ? 'decimal-pad' : 'number-pad'}
              placeholder={
                unitsPrefs.water === 'floz'
                  ? mlToDisplay(DEFAULT_WATER_GOAL_ML, 'floz').toFixed(1)
                  : String(DEFAULT_WATER_GOAL_ML)
              }
              placeholderTextColor={colors.textSecondary}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.suggBtns}>
              <Pressable style={[styles.btn, styles.btnAccept]} onPress={() => void handleSaveWaterGoal()}>
                <Text style={styles.btnTextAccept}>Save</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnEdit]} onPress={() => setWaterGoalModalVisible(false)}>
                <Text style={styles.btnTextEdit}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  wrap: {},
  body: { paddingHorizontal: 4, paddingBottom: 12, paddingTop: 4 },
  h2oHint: { fontSize: 11, color: c.textSecondary, marginTop: -2, marginBottom: 10 },
  editTargetsBtn: { marginBottom: 10 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 6 },
  modalSub: { fontSize: 13, color: c.textSecondary, marginBottom: 14, lineHeight: 18 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: c.gridLine,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
    textAlign: 'center',
    marginBottom: 14,
  },

  idleWrap: { gap: 10 },
  hintText: { fontSize: 12, color: c.textSecondary, fontStyle: 'italic' },
  errorText: { fontSize: 12, color: '#E53935' },
  aiBtn: { backgroundColor: c.accentGreen, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  aiBtnDisabled: { backgroundColor: c.gridLine },
  aiBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  loadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  loadingText: { fontSize: 13, color: c.textSecondary },

  reasoningBox: { backgroundColor: '#FFF8E1', borderRadius: 10, padding: 10, marginBottom: 12 },
  weighInHint: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  dietBadge: { fontSize: 12, fontWeight: '700', color: '#F57F17', marginBottom: 4 },
  reasoningText: { fontSize: 13, color: '#5D4037', lineHeight: 18 },

  suggestionRow: { flexDirection: 'row', justifyContent: 'space-evenly', marginBottom: 14 },
  suggItem: { alignItems: 'center', minWidth: 60 },
  suggVal: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
  suggUnit: { fontSize: 10, color: c.textSecondary },
  suggLabel: { fontSize: 11, color: c.textSecondary },

  suggBtns: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center' },
  btnAccept: { backgroundColor: c.accentGreen },
  btnEdit: { borderWidth: 1.5, borderColor: c.gridLine },
  btnTextAccept: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnTextEdit: { color: c.textPrimary, fontWeight: '600', fontSize: 14 },

  activeLabelRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 },
  dietBadgeSmall: { fontSize: 11, fontWeight: '700', color: '#F57F17', backgroundColor: '#FFF8E1', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  updatedDetail: { fontSize: 11, color: c.accentGreen, fontWeight: '600', marginBottom: 8 },
  reanalyzeBtn: { borderWidth: 1, borderColor: c.gridLine, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  reanalyzeBtnText: { fontSize: 12, color: c.textSecondary, fontWeight: '600' },
  exportPromptBtn: { marginTop: 10, paddingVertical: 8, alignItems: 'center' },
  exportPromptText: { fontSize: 12, color: c.accentBlue, textDecorationLine: 'underline' },
});
