/**
 * Food Log Modal — camera / text → Gemini AI → correction chat → save.
 * New meal: text or first photo auto-saves when clean, then closes (habit speed).
 * Photo add/remove merge on existing meals still uses approve preview.
 */

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  analyzeFood,
  checkMealAgainstUserRules,
  computeTotals,
  seedMealEditHistory,
  type FoodItem,
  type GeminiAnalysisResult,
  type GeminiTurn,
} from '../services/GeminiService';
import { saveMeal, deleteMeal, foodLogDayKey, getDailyMacros, getRecentMeals, getMealsForDay, type FoodEntry } from '../services/FoodLogService';
import { logMethodTiming, PERF_WARN_AI_MS, PERF_WARN_MEAL_MS, timeAsync } from '../services/AppDailyLogService';
import { formatLocalizedDate, formatLocalizedTime, formatFoodLogDayLabel } from '../i18n/dateLocale';
import { getFoodLogAlertCopy } from '../i18n/foodLogAlertCopy';
import { getHelpStripCopy } from '../i18n/helpStripCopy';
import { OutOfCreditsError } from '../services/UsageQueueService';
import { getFoodLogPhotoUiCopy } from '../i18n/foodLogPhotoUiCopy';
import { getFoodLogUiCopy } from '../i18n/foodLogUiCopy';
import { formatFoodLogHistoryForMealAi } from '../logic/foodLogMealHistory';
import { buildMealMergePreview, type MealMergePreview } from '../logic/mealPhotoMerge';
import {
  analyzeMacroMealIssues,
  flaggedItemIndices,
  issueModalBody,
  mealIssuesFromFoodItems,
  mealItemsCompositionKey,
  mealItemsSnapshotKey,
  syncFoodItemRuleFlags,
  type MealIssue,
} from '../logic/mealIssueAnalysis';
import { getMacroTarget, getUserRules, type UserLanguage } from '../services/TargetService';
import { cardShadow } from '../theme/wellness';
import { IosDateTimePickerSheet } from './IosDateTimePickerSheet';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { ActionIcons, DashIcon } from '../theme/icons';
import { formatEnergy, type EnergyUnit } from '../logic/unitConvert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = 'idle' | 'pickPast' | 'analyzing' | 'result' | 'saving';

type PhotoSession = {
  uri: string;
  base64: string | null;
  items: FoodItem[];
  confidence: 'high' | 'medium' | 'low';
  description: string;
  suggestion?: string;
  history: GeminiTurn[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Refresh dashboard meal chips; await before closing so reopen sees committed JSON. Pass `{ close: false }` to keep the modal open (auto-save review). */
  onSaved: (opts?: { close?: boolean }) => void | Promise<void>;
  initialTimestamp?: number;
  editEntry?: FoodEntry;
  /** Pre-fill from recipe card (prompt40) — opens on result screen. */
  prefillItems?: FoodItem[];
  prefillDescription?: string;
  lang?: UserLanguage | null;
  energyUnit?: EnergyUnit;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number, langCode?: string | null): string {
  return formatLocalizedTime(ms, langCode, { hour: '2-digit', minute: '2-digit' });
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addLocalDays(ms: number, delta: number): number {
  const d = new Date(startOfLocalDay(ms));
  d.setDate(d.getDate() + delta);
  return d.getTime();
}

function formatBrowseDayLabel(ms: number, langCode?: string | null): string {
  return formatFoodLogDayLabel(ms, langCode, {
    todayDayKey: foodLogDayKey(Date.now()),
    dayKey: foodLogDayKey(ms),
  });
}

function mealSlotLabel(entry: FoodEntry, copy: ReturnType<typeof getFoodLogUiCopy>): string {
  if (entry.note) return entry.note;
  const h = new Date(entry.timestamp).getHours();
  if (h < 10) return copy.breakfast;
  if (h < 14) return copy.lunch;
  if (h < 17) return copy.snack;
  return copy.dinner;
}

/** First 1–2 item display names for past-meal picker rows. */
function pastMealItemsPreview(entry: FoodEntry, max = 2): string {
  const names = (entry.items ?? [])
    .map((it) => (it.name_local ?? it.name)?.trim())
    .filter((n): n is string => !!n);
  if (names.length === 0) return '';
  const shown = names.slice(0, max);
  const more = names.length > max ? '…' : '';
  return `${shown.join(' · ')}${more}`;
}

function cloneFoodItems(src: FoodItem[]): FoodItem[] {
  return src.map((it) => ({
    ...it,
    rule_conflict: false,
    rule_message: '',
  }));
}

function formatMealDateTime(ms: number, langCode?: string | null): string {
  const mealDay = foodLogDayKey(ms);
  const todayDay = foodLogDayKey(Date.now());
  const time = formatTime(ms, langCode);
  if (mealDay === todayDay) return time;
  const date = formatLocalizedDate(ms, langCode, { month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}

function confidenceColor(
  level: 'high' | 'medium' | 'low',
  c: ThemeColors,
  isDark: boolean,
): string {
  if (level === 'high') return isDark ? c.accentGreen : '#2E7D32';
  if (level === 'medium') return c.warningAmber;
  return isDark ? c.accentRed : '#C62828';
}

function macroSummary(items: FoodItem[], energyUnit: EnergyUnit = 'kcal'): string {
  const t = computeTotals(items);
  return `${formatEnergy(t.totalKcal, energyUnit)} · P ${t.totalProtein_g.toFixed(0)}g · C ${t.totalCarb_g.toFixed(0)}g · F ${t.totalFat_g.toFixed(0)}g · Fi ${t.totalFiber_g.toFixed(0)}g`;
}

function macroDelta(before: FoodItem[], after: FoodItem[], energyUnit: EnergyUnit = 'kcal'): string {
  const b = computeTotals(before);
  const a = computeTotals(after);
  const dk = Math.round(a.totalKcal - b.totalKcal);
  const dp = (a.totalProtein_g - b.totalProtein_g).toFixed(0);
  const dc = (a.totalCarb_g - b.totalCarb_g).toFixed(0);
  const df = (a.totalFat_g - b.totalFat_g).toFixed(0);
  const dfi = (a.totalFiber_g - b.totalFiber_g).toFixed(0);
  const e = formatEnergy(dk, energyUnit);
  return `${dk > 0 ? '+' : ''}${e} · P ${dp}g · C ${dc}g · F ${df}g · Fi ${dfi}g`;
}

function capMealTimestamp(ms: number): number {
  return Math.min(ms, Date.now());
}

function combineDateAndTime(datePart: Date, timePart: Date): number {
  const combined = new Date(datePart);
  combined.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return capMealTimestamp(combined.getTime());
}

function openAndroidMealDateTimePicker(currentMs: number, onPick: (ms: number) => void): void {
  const current = new Date(currentMs);
  DateTimePickerAndroid.open({
    value: current,
    mode: 'date',
    maximumDate: new Date(),
    onChange: (event, selectedDate) => {
      if (event.type !== 'set' || !selectedDate) return;
      const withDate = new Date(selectedDate);
      withDate.setHours(current.getHours(), current.getMinutes(), 0, 0);
      DateTimePickerAndroid.open({
        value: new Date(capMealTimestamp(withDate.getTime())),
        mode: 'time',
        is24Hour: true,
        onChange: (timeEvent, selectedTime) => {
          if (timeEvent.type !== 'set' || !selectedTime) return;
          onPick(combineDateAndTime(selectedDate, selectedTime));
        },
      });
    },
  });
}

function seedMealHistory(entry: FoodEntry, lang?: UserLanguage | null): GeminiTurn[] {
  return seedMealEditHistory(entry, lang);
}

function applyAnalysisResult(
  result: GeminiAnalysisResult,
  updatedHistory: GeminiTurn[],
): Pick<PhotoSession, 'items' | 'confidence' | 'description' | 'suggestion' | 'history'> {
  return {
    items: result.items,
    confidence: result.confidence,
    description: result.description,
    suggestion: result.suggestion,
    history: updatedHistory,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function parseNum(raw: string): number {
  const n = Number(String(raw).replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Baseline nutrients for linear grams→macro scaling in Edit Item. */
type EditNutrientBase = {
  grams: number;
  kcal: number;
  protein_g: number;
  carb_g: number;
  fat_g: number;
  fiber_g: number;
};

function formatEditKcal(n: number): string {
  return String(Math.max(0, Math.round(n)));
}

function formatEditMacro(n: number): string {
  const r = Math.round(Math.max(0, n) * 10) / 10;
  return String(r);
}

function scaleEditDraftFromGrams(
  draft: {
    name: string;
    grams: string;
    kcal: string;
    protein_g: string;
    carb_g: string;
    fat_g: string;
    fiber_g: string;
  },
  gramsText: string,
  base: EditNutrientBase,
) {
  const next = { ...draft, grams: gramsText };
  const trimmed = gramsText.trim();
  if (trimmed === '' || !(base.grams > 0)) return next;
  const newG = parseNum(gramsText);
  if (!Number.isFinite(newG) || newG < 0) return next;
  const r = newG / base.grams;
  return {
    ...next,
    kcal: formatEditKcal(base.kcal * r),
    protein_g: formatEditMacro(base.protein_g * r),
    carb_g: formatEditMacro(base.carb_g * r),
    fat_g: formatEditMacro(base.fat_g * r),
    fiber_g: formatEditMacro(base.fiber_g * r),
  };
}

function FoodItemsCard({
  items,
  title,
  flaggedIndices,
  energyUnit = 'kcal',
  editable = false,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  emptyLabel = 'Empty',
  onEditItem,
  onDeleteItem,
}: {
  items: FoodItem[];
  title?: string;
  flaggedIndices?: Set<number>;
  energyUnit?: EnergyUnit;
  editable?: boolean;
  editLabel?: string;
  deleteLabel?: string;
  emptyLabel?: string;
  onEditItem?: (index: number) => void;
  onDeleteItem?: (index: number) => void;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  if (items.length === 0) {
    return (
      <View style={[styles.itemsCard, cardShadow]}>
        {title ? <Text style={styles.itemsCardTitle}>{title}</Text> : null}
        <Text style={styles.emptyItemsText}>{emptyLabel}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.itemsCard, cardShadow]}>
      {title ? <Text style={styles.itemsCardTitle}>{title}</Text> : null}
      {items.map((item, i) => {
        const flagged = flaggedIndices?.has(i) || item.rule_conflict;
        return (
          <View
            key={`item-${i}`}
            style={[
              styles.itemRow,
              i > 0 && styles.itemRowBorder,
              flagged && styles.itemRowFlagged,
            ]}
          >
            <View style={styles.itemTopRow}>
              <View style={styles.itemNameRow}>
                {flagged ? <Text style={styles.itemWarningDot}>⚠</Text> : null}
                <Text
                  style={[styles.itemName, flagged && styles.itemNameFlagged]}
                >
                  {item.name_local ?? item.name}
                </Text>
              </View>
              {editable ? (
                <View style={styles.itemActions}>
                  <Pressable
                    style={styles.itemEditBtn}
                    onPress={() => onEditItem?.(i)}
                    accessibilityRole="button"
                    accessibilityLabel={editLabel}
                    hitSlop={6}
                  >
                    <Text style={styles.itemEditBtnText}>{editLabel}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.itemDeleteBtn}
                    onPress={() => onDeleteItem?.(i)}
                    accessibilityRole="button"
                    accessibilityLabel={deleteLabel}
                    hitSlop={6}
                  >
                    <Text style={styles.itemDeleteBtnText}>{deleteLabel}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
            {flagged && item.rule_message ? (
              <Text style={styles.itemRuleMessage}>{item.rule_message}</Text>
            ) : null}
            <Text style={styles.itemGrams}>{item.grams}g</Text>
            <View style={styles.itemMetricsRow}>
              <Text style={styles.itemKcal}>{formatEnergy(item.kcal, energyUnit)}</Text>
              <Text style={styles.itemMacros}>
                P {item.protein_g}g · C {item.carb_g}g · F {item.fat_g}g · Fi {item.fiber_g ?? 0}g
              </Text>
            </View>
          </View>
        );
      })}
      <View style={[styles.itemRow, styles.totalRow]}>
        <Text style={styles.totalValue}>{macroSummary(items, energyUnit)}</Text>
      </View>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FoodLogModal({
  visible,
  onClose,
  onSaved,
  initialTimestamp,
  editEntry,
  prefillItems,
  prefillDescription,
  lang,
  energyUnit = 'kcal',
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const ui = getFoodLogUiCopy(lang?.code);
  const photoUi = useMemo(() => getFoodLogPhotoUiCopy(lang?.code), [lang?.code]);
  const alerts = useMemo(() => getFoodLogAlertCopy(lang?.code), [lang?.code]);
  const helpCopy = useMemo(() => getHelpStripCopy(lang?.code), [lang?.code]);
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  const mapFoodAiError = useCallback(
    (e: unknown) => {
      if (e instanceof OutOfCreditsError) return helpCopy.outOfCredits;
      return alerts.aiAnalysisFailed;
    },
    [alerts.aiAnalysisFailed, helpCopy.outOfCredits],
  );
  const [screen, setScreen] = useState<Screen>(() =>
    editEntry || (prefillItems && prefillItems.length > 0) ? 'result' : 'idle',
  );
  const [items, setItems] = useState<FoodItem[]>(() => editEntry?.items ?? prefillItems ?? []);
  const [mealHistory, setMealHistory] = useState<GeminiTurn[]>(() =>
    editEntry ? seedMealHistory(editEntry, lang) : [],
  );
  const [photoSession, setPhotoSession] = useState<PhotoSession | null>(null);
  const [mergePreview, setMergePreview] = useState<MealMergePreview | null>(null);
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low'>('high');
  const [description, setDescription] = useState(() =>
    editEntry
      ? getFoodLogUiCopy(lang?.code).editingSavedMealHint
      : prefillDescription ?? '',
  );
  const [suggestion, setSuggestion] = useState<string | undefined>();
  const [chatText, setChatText] = useState('');
  const [mealTime, setMealTime] = useState(() => editEntry?.timestamp ?? initialTimestamp ?? Date.now());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>(() => editEntry?.id);
  const [hadPhotoForSave, setHadPhotoForSave] = useState(false);
  const [analyzingPhotoUri, setAnalyzingPhotoUri] = useState<string | null>(null);
  const [mealIssues, setMealIssues] = useState<MealIssue[]>([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [overrideSaveOnce, setOverrideSaveOnce] = useState(false);
  const [overrideSnapshotKey, setOverrideSnapshotKey] = useState<string | null>(null);
  const [foodLogHistoryContext, setFoodLogHistoryContext] = useState<string | null>(null);
  const [autoSavedBanner, setAutoSavedBanner] = useState(false);
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    grams: '',
    kcal: '',
    protein_g: '',
    carb_g: '',
    fat_g: '',
    fiber_g: '',
  });
  /** Fixed while editing grams; refreshed when user manually edits kcal/macros. */
  const editNutrientBaseRef = useRef<EditNutrientBase>({
    grams: 0,
    kcal: 0,
    protein_g: 0,
    carb_g: 0,
    fat_g: 0,
    fiber_g: 0,
  });
  /** Grams at Edit open — slider mid; max = 2× (double). */
  const [editGramsOrigin, setEditGramsOrigin] = useState(0);
  const [browseDayMs, setBrowseDayMs] = useState(() => startOfLocalDay(Date.now()));
  const [pastDayMeals, setPastDayMeals] = useState<FoodEntry[]>([]);
  const [pastDayLoading, setPastDayLoading] = useState(false);
  const chatInputRef = useRef<TextInput>(null);
  const describeInputRef = useRef<TextInput>(null);
  const mealCompositionKey = mealItemsCompositionKey(items);

  const loadFoodLogHistory = useCallback(async (excludeId?: string) => {
    const meals = await getRecentMeals(14);
    const block = formatFoodLogHistoryForMealAi(meals, { excludeEntryId: excludeId, lookbackDays: 14 });
    setFoodLogHistoryContext(block);
    return block;
  }, []);

  const resolveFoodLogHistory = useCallback(async () => {
    if (foodLogHistoryContext) return foodLogHistoryContext;
    return loadFoodLogHistory(editingId ?? undefined);
  }, [foodLogHistoryContext, editingId, loadFoodLogHistory]);

  const mealOpenLoggedRef = useRef(false);

  React.useEffect(() => {
    if (!visible) {
      mealOpenLoggedRef.current = false;
      return;
    }
    const opening = !mealOpenLoggedRef.current;
    mealOpenLoggedRef.current = true;
    const t0 = Date.now();
    if (opening) {
      logMethodTiming('FoodLogModal.open', 0, {
        edit: Boolean(editEntry?.id),
        prefill: Boolean(prefillItems && prefillItems.length > 0),
      });
    }
    void loadFoodLogHistory(editingId).finally(() => {
      if (!opening) return;
      const duration_ms = Date.now() - t0;
      logMethodTiming('FoodLogModal.openReady', duration_ms, {
        edit: Boolean(editEntry?.id),
      }, PERF_WARN_MEAL_MS);
    });
  }, [visible, editingId, loadFoodLogHistory, editEntry?.id, prefillItems]);

  useEffect(() => {
    if (!visible || screen !== 'pickPast') return;
    let cancelled = false;
    const dk = foodLogDayKey(browseDayMs);
    setPastDayLoading(true);
    void getMealsForDay(dk).then((meals) => {
      if (cancelled) return;
      const sorted = [...meals].sort((a, b) => a.timestamp - b.timestamp);
      setPastDayMeals(sorted);
      setPastDayLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, screen, browseDayMs]);

  const shiftBrowseDay = useCallback((delta: number) => {
    setBrowseDayMs((prev) => {
      const next = addLocalDays(prev, delta);
      const todayStart = startOfLocalDay(Date.now());
      return next > todayStart ? todayStart : next;
    });
  }, []);

  const openPastMealPicker = useCallback(() => {
    setPastDayMeals([]);
    setError(null);
    setPastDayLoading(true);
    void (async () => {
      const todayStart = startOfLocalDay(Date.now());
      let day = todayStart;
      try {
        const todayMeals = await getMealsForDay(foodLogDayKey(todayStart));
        // Empty morning log: land on yesterday so the picker has meals ready.
        if (todayMeals.length === 0) day = addLocalDays(todayStart, -1);
      } catch {
        // Keep today; empty-state copy still works.
      }
      setBrowseDayMs(day);
      setScreen('pickPast');
    })();
  }, []);

  const applyPastMealAsNew = useCallback(
    (entry: FoodEntry) => {
      if (!entry.items?.length) return;
      setItems(cloneFoodItems(entry.items));
      setEditingId(undefined);
      setMealHistory([]);
      setPhotoSession(null);
      setMergePreview(null);
      setChatText('');
      setError(null);
      setHadPhotoForSave(false);
      setConfidence('high');
      setSuggestion(undefined);
      setDescription(ui.fromPastMeal);
      setMealIssues([]);
      setOverrideSaveOnce(false);
      setOverrideSnapshotKey(null);
      setAutoSavedBanner(false);
      setMealTime(initialTimestamp ?? Date.now());
      setScreen('result');
    },
    [ui.fromPastMeal, initialTimestamp],
  );

  React.useEffect(() => {
    if (!visible || editEntry) return;
    if (prefillItems && prefillItems.length > 0) {
      setScreen('result');
      setItems(prefillItems);
      setDescription(prefillDescription ?? '');
      setMealHistory([]);
      setPhotoSession(null);
      setMergePreview(null);
      setChatText('');
      setError(null);
      setEditingId(undefined);
      setMealTime(initialTimestamp ?? Date.now());
      setConfidence('high');
    }
  }, [visible, prefillItems, prefillDescription, editEntry, initialTimestamp]);

  React.useEffect(() => {
    if (editEntry) {
      setScreen('result');
      setItems(editEntry.items);
      setMealTime(editEntry.timestamp);
      setDescription(ui.editingSavedMealHint);
      setEditingId(editEntry.id);
      setMealHistory(seedMealHistory(editEntry, lang));
      setPhotoSession(null);
      setMergePreview(null);
      setChatText('');
      setError(null);
    }
  }, [editEntry, lang?.code, ui.editingSavedMealHint]);

  React.useEffect(() => {
    if (visible && !editEntry) {
      setMealTime(initialTimestamp ?? Date.now());
    }
  }, [visible, initialTimestamp, editEntry]);

  // Modal slide steals focus on Android — autoFocus alone often no-ops. Focus after settle.
  useEffect(() => {
    if (!visible || editEntry || screen !== 'idle') return;
    if (prefillItems && prefillItems.length > 0) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (!cancelled) describeInputRef.current?.focus();
      }, Platform.OS === 'android' ? 400 : 250);
    });
    return () => {
      cancelled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
      task.cancel();
    };
  }, [visible, editEntry, screen, prefillItems]);

  const reset = useCallback(() => {
    setScreen('idle');
    setItems([]);
    setMealHistory([]);
    setPhotoSession(null);
    setMergePreview(null);
    setChatText('');
    setTextPrompt('');
    setError(null);
    setEditingId(undefined);
    setHadPhotoForSave(false);
    setMealTime(initialTimestamp ?? Date.now());
    setShowTimePicker(false);
    setConfidence('high');
    setDescription('');
    setSuggestion(undefined);
    setAnalyzingPhotoUri(null);
    setMealIssues([]);
    setShowIssueModal(false);
    setOverrideSaveOnce(false);
    setOverrideSnapshotKey(null);
    setFoodLogHistoryContext(null);
    setAutoSavedBanner(false);
    setEditItemIndex(null);
    setBrowseDayMs(startOfLocalDay(Date.now()));
    setPastDayMeals([]);
    setPastDayLoading(false);
  }, [initialTimestamp]);

  const recomputeMealIssues = useCallback(async (
    mealItems: FoodItem[],
    timestamp: number,
    excludeId?: string,
  ) => {
    const [macroTarget, dayMacros] = await Promise.all([
      getMacroTarget(),
      getDailyMacros(foodLogDayKey(timestamp)),
    ]);
    const before = dayMacros.entries
      .filter((entry) => entry.id !== excludeId)
      .reduce(
        (acc, entry) => ({
          kcal: acc.kcal + entry.totalKcal,
          protein_g: acc.protein_g + entry.totalProtein_g,
          carb_g: acc.carb_g + entry.totalCarb_g,
          fat_g: acc.fat_g + entry.totalFat_g,
        }),
        { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
      );
    const issueInput = {
      items: mealItems,
      dayTotalsBeforeMeal: before,
      macroTarget,
      mealTimestamp: timestamp,
    };

    const msgs = {
      carbOver: alerts.carbOver,
      kcalOver: alerts.kcalOver,
      proteinLow: alerts.proteinLow,
      ruleConflictFallback: alerts.ruleConflictFallback,
    };
    const macroIssues = analyzeMacroMealIssues(issueInput, msgs);
    return [...macroIssues, ...mealIssuesFromFoodItems(mealItems, msgs)];
  }, [alerts]);

  const persistMealItems = useCallback(
    async (opts: {
      mealItems: FoodItem[];
      historyLen: number;
      fromPhoto: boolean;
      id?: string;
      timestamp: number;
      /** Keep modal open so user can fix time / items after first auto-save. */
      stayOpen?: boolean;
    }) => {
      await timeAsync(
        'FoodLogModal.save',
        async () => {
          const totals = computeTotals(opts.mealItems);
          const saved = await saveMeal({
            id: opts.id,
            timestamp: opts.timestamp,
            items: opts.mealItems,
            totalKcal: Math.round(totals.totalKcal),
            totalProtein_g: Math.round(totals.totalProtein_g * 10) / 10,
            totalCarb_g: Math.round(totals.totalCarb_g * 10) / 10,
            totalFat_g: Math.round(totals.totalFat_g * 10) / 10,
            totalFiber_g: Math.round(totals.totalFiber_g * 10) / 10,
            source: opts.fromPhoto ? 'camera-ai' : opts.historyLen > 0 ? 'text-ai' : 'manual',
          });
          if (opts.stayOpen) {
            setEditingId(saved.id);
            setItems(saved.items);
            setMealTime(saved.timestamp);
            setMealHistory((h) => (h.length > 0 ? h : []));
            setScreen('result');
            setAutoSavedBanner(true);
            await onSaved({ close: false });
            return;
          }
          await onSaved({ close: true });
          reset();
        },
        {
          stay_open: Boolean(opts.stayOpen),
          item_count: opts.mealItems.length,
          edit: Boolean(opts.id),
        },
        PERF_WARN_MEAL_MS,
      );
    },
    [reset, onSaved],
  );

  /**
   * New meal (text or first photo): analyze → save when clean, then close.
   * Issue / nutritionist alert and photo+/- merge stay multi-step (modal stays open).
   * Edit a chip on the Food strip if time or items need a tweak after close.
   */
  const tryAutoSaveNewMeal = useCallback(
    async (
      mealItems: FoodItem[],
      opts: { fromPhoto: boolean; historyLen: number },
    ): Promise<boolean> => {
      if (editingId || mealItems.length === 0) return false;
      setScreen('saving');
      const issues = await recomputeMealIssues(mealItems, mealTime, undefined);
      setMealIssues(issues);
      if (issues.length > 0) {
        setScreen('result');
        setShowIssueModal(true);
        return false;
      }
      try {
        await persistMealItems({
          mealItems,
          historyLen: opts.historyLen,
          fromPhoto: opts.fromPhoto,
          timestamp: mealTime,
          stayOpen: false,
        });
        return true;
      } catch {
        setError(alerts.failedToSave);
        setScreen('result');
        return false;
      }
    },
    [editingId, mealTime, recomputeMealIssues, persistMealItems, alerts.failedToSave],
  );

  // Recipe "Log meal" — same one-tap save when clean.
  React.useEffect(() => {
    if (!visible || editEntry) return;
    if (!prefillItems || prefillItems.length === 0) return;
    void tryAutoSaveNewMeal(prefillItems, { fromPhoto: false, historyLen: 0 });
  }, [visible, prefillItems, editEntry, tryAutoSaveNewMeal]);

  React.useEffect(() => {
    if (!visible || items.length === 0) return;

    let cancelled = false;
    void (async () => {
      const userRules = await getUserRules();
      if (cancelled) return;
      if (!userRules?.rawText?.trim()) {
        setItems((prev) =>
          prev.map((item) => ({ ...item, rule_conflict: false, rule_message: undefined })),
        );
        return;
      }
      try {
        const geminiIssues = await checkMealAgainstUserRules(items, userRules, lang);
        if (cancelled) return;
        setItems((prev) => syncFoodItemRuleFlags(prev, geminiIssues));
      } catch {
        // Offline — keep items; macro checks still run.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, mealCompositionKey, lang?.code]);

  React.useEffect(() => {
    if (items.length === 0) {
      setMealIssues([]);
      setShowIssueModal(false);
      setOverrideSaveOnce(false);
      setOverrideSnapshotKey(null);
      return;
    }

    const snapshot = mealItemsSnapshotKey(items);
    if (overrideSnapshotKey && snapshot !== overrideSnapshotKey) {
      setOverrideSaveOnce(false);
      setOverrideSnapshotKey(null);
    }

    let cancelled = false;
    void recomputeMealIssues(items, mealTime, editingId).then((issues) => {
      if (cancelled) return;
      setMealIssues(issues);
      if (issues.length === 0) setShowIssueModal(false);
    });
    return () => {
      cancelled = true;
    };
  }, [items, mealTime, editingId, overrideSnapshotKey, recomputeMealIssues]);

  const handleClose = useCallback(() => {
    if (screen === 'saving') return;
    reset();
    onClose();
  }, [screen, reset, onClose]);

  const openMealDateTimePicker = useCallback(() => {
    if (Platform.OS === 'android') {
      openAndroidMealDateTimePicker(mealTime, setMealTime);
      return;
    }
    setShowTimePicker(true);
  }, [mealTime]);

  const runMealAnalysis = useCallback(
    async (userText: string, hist: GeminiTurn[]) => {
      setScreen('analyzing');
      setAnalyzingPhotoUri(null);
      setError(null);
      try {
        await timeAsync(
          'FoodLogModal.analyzeFood',
          async () => {
            const userRules = await getUserRules();
            const historyBlock = await resolveFoodLogHistory();
            const { result, updatedHistory } = await analyzeFood(
              null,
              userText,
              hist,
              null,
              lang,
              userRules,
              historyBlock,
            );
            setItems(result.items);
            setConfidence(result.confidence);
            setDescription(result.description);
            setSuggestion(result.suggestion);
            setMealHistory(updatedHistory);

            // First parse (text): describe + send → auto-save when clean.
            if (hist.length === 0 && !editingId && result.items.length > 0) {
              const saved = await tryAutoSaveNewMeal(result.items, {
                fromPhoto: false,
                historyLen: updatedHistory.length,
              });
              if (saved) return;
            }

            setScreen('result');
          },
          { photo: 0, history_n: hist.length },
          PERF_WARN_AI_MS,
        );
      } catch (e) {
        setError(mapFoodAiError(e));
        setScreen(editingId ? 'result' : 'idle');
      }
    },
    [lang, resolveFoodLogHistory, editingId, tryAutoSaveNewMeal, mapFoodAiError],
  );

  const runPhotoAnalysis = useCallback(
    async (
      uri: string,
      imageBase64: string | null,
      userText: string,
      hist: GeminiTurn[],
    ) => {
      setScreen('analyzing');
      setAnalyzingPhotoUri(uri);
      setError(null);
      setMergePreview(null);
      try {
        await timeAsync(
          'FoodLogModal.analyzeFood',
          async () => {
            const userRules = await getUserRules();
            const historyBlock = await resolveFoodLogHistory();
            const { result, updatedHistory } = await analyzeFood(
              imageBase64,
              userText,
              hist,
              null,
              lang,
              userRules,
              historyBlock,
            );
            setMealHistory(updatedHistory);
            setHadPhotoForSave(true);

            const isFirstPhotoNewMeal =
              hist.length === 0 && !editingId && items.length === 0 && result.items.length > 0;

            // First photo on a new meal: same as text — auto-save, stay open, Done (no Use/Approve/Save).
            // Do NOT setItems for edit / add-photo paths — photo lives in photoSession until
            // "+ Add to meal" / "Use as meal" → Approve (prompt20). Overwriting items wiped the meal.
            if (isFirstPhotoNewMeal) {
              const saved = await tryAutoSaveNewMeal(result.items, {
                fromPhoto: true,
                historyLen: updatedHistory.length,
              });
              if (saved) {
                // persistMealItems(stayOpen) already set items from the saved entry.
                setConfidence(result.confidence);
                setDescription(result.description);
                setSuggestion(result.suggestion);
                setPhotoSession(null);
                setMergePreview(null);
                return;
              }
              // Nutritionist alert path: keep analyzed items in the editor so Save anyway
              // does not persist an empty meal (text flow already setItems before tryAutoSave).
              setItems(result.items);
              setConfidence(result.confidence);
              setDescription(result.description);
              setSuggestion(result.suggestion);
              setPhotoSession(null);
              setMergePreview(null);
              setScreen('result');
              return;
            }

            setPhotoSession({
              uri,
              base64: imageBase64,
              ...applyAnalysisResult(result, updatedHistory),
            });
            setScreen('result');
          },
          { photo: 1, history_n: hist.length },
          PERF_WARN_AI_MS,
        );
      } catch (e) {
        setError(mapFoodAiError(e));
        setScreen(items.length > 0 || editEntry ? 'result' : 'idle');
      }
    },
    [lang, items.length, editEntry, editingId, resolveFoodLogHistory, tryAutoSaveNewMeal, mapFoodAiError],
  );

  const pickImage = useCallback(
    async (source: 'camera' | 'gallery') => {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          alerts.permissionRequired,
          source === 'camera' ? alerts.permissionCamera : alerts.permissionGallery,
        );
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.7,
              base64: true,
              allowsEditing: false,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.5,
              base64: true,
              allowsEditing: false,
              exif: false,
            });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const b64 = asset.base64 ?? null;
      if (b64 && b64.length > 4_000_000) {
        Alert.alert(alerts.imageTooLargeTitle, alerts.imageTooLargeBody);
      }
      await runPhotoAnalysis(asset.uri, b64, '', []);
    },
    [runPhotoAnalysis, alerts],
  );

  const handleCamera = useCallback(() => pickImage('camera'), [pickImage]);
  const handleGallery = useCallback(() => pickImage('gallery'), [pickImage]);
  const handleAddPhoto = useCallback(
    (source: 'camera' | 'gallery') => pickImage(source),
    [pickImage],
  );

  const handleTextSubmit = useCallback(async () => {
    const text = textPrompt.trim();
    if (!text) return;
    setTextPrompt('');
    await runMealAnalysis(text, []);
  }, [textPrompt, runMealAnalysis]);

  const handleCorrection = useCallback(async () => {
    const text = chatText.trim();
    if (!text || screen !== 'result' || mergePreview) return;
    setChatText('');

    if (photoSession) {
      setScreen('analyzing');
      setError(null);
      try {
        await timeAsync(
          'FoodLogModal.analyzeFood',
          async () => {
            const userRules = await getUserRules();
            const historyBlock = await resolveFoodLogHistory();
            const { result, updatedHistory } = await analyzeFood(
              null,
              text,
              photoSession.history,
              null,
              lang,
              userRules,
              historyBlock,
            );
            setPhotoSession((prev) =>
              prev ? { ...prev, ...applyAnalysisResult(result, updatedHistory) } : prev,
            );
            setScreen('result');
          },
          { photo: 0, correction: 1 },
          PERF_WARN_AI_MS,
        );
      } catch (e) {
        setError(mapFoodAiError(e));
        setScreen('result');
      }
      return;
    }

    await runMealAnalysis(text, mealHistory);
  }, [
    chatText,
    screen,
    mergePreview,
    photoSession,
    mealHistory,
    runMealAnalysis,
    lang,
    resolveFoodLogHistory,
    mapFoodAiError,
  ]);

  const handleStartMerge = useCallback(
    (mode: 'add' | 'remove') => {
      if (!photoSession || photoSession.items.length === 0) return;
      setMergePreview(buildMealMergePreview(mode, items, photoSession.items));
    },
    [photoSession, items],
  );

  const handleApproveMerge = useCallback(() => {
    if (!mergePreview) return;
    setItems(mergePreview.after);
    setMergePreview(null);
    setPhotoSession(null);
    setChatText('');
    setDescription(
      mergePreview.mode === 'add' ? photoUi.photoItemsAdded : photoUi.photoItemsRemoved,
    );
  }, [mergePreview, photoUi.photoItemsAdded, photoUi.photoItemsRemoved]);

  const handleCancelMerge = useCallback(() => {
    setMergePreview(null);
  }, []);

  const openEditItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item || screen !== 'result') return;
      const draft = {
        name: item.name_local ?? item.name,
        grams: String(item.grams),
        kcal: String(item.kcal),
        protein_g: String(item.protein_g),
        carb_g: String(item.carb_g),
        fat_g: String(item.fat_g),
        fiber_g: String(item.fiber_g ?? 0),
      };
      const originG = Math.max(0, item.grams);
      editNutrientBaseRef.current = {
        grams: originG,
        kcal: Math.max(0, item.kcal),
        protein_g: Math.max(0, item.protein_g),
        carb_g: Math.max(0, item.carb_g),
        fat_g: Math.max(0, item.fat_g),
        fiber_g: Math.max(0, item.fiber_g ?? 0),
      };
      setEditGramsOrigin(originG);
      setEditDraft(draft);
      setEditItemIndex(index);
    },
    [items, screen],
  );

  const onEditGramsChange = useCallback((v: string) => {
    setEditDraft((d) => scaleEditDraftFromGrams(d, v, editNutrientBaseRef.current));
  }, []);

  const onEditGramsSlider = useCallback(
    (v: number) => {
      onEditGramsChange(String(Math.max(0, Math.round(v))));
    },
    [onEditGramsChange],
  );

  /** Manual kcal/macro edit — re-baseline so later grams changes keep the new ratios. */
  const onEditNutrientChange = useCallback(
    (key: 'kcal' | 'protein_g' | 'carb_g' | 'fat_g' | 'fiber_g', v: string) => {
      setEditDraft((d) => {
        const next = { ...d, [key]: v };
        const g = parseNum(next.grams);
        editNutrientBaseRef.current = {
          grams: g > 0 ? g : editNutrientBaseRef.current.grams,
          kcal: Math.max(0, parseNum(next.kcal)),
          protein_g: Math.max(0, parseNum(next.protein_g)),
          carb_g: Math.max(0, parseNum(next.carb_g)),
          fat_g: Math.max(0, parseNum(next.fat_g)),
          fiber_g: Math.max(0, parseNum(next.fiber_g)),
        };
        return next;
      });
    },
    [],
  );

  const closeEditItem = useCallback(() => {
    setEditItemIndex(null);
    setEditGramsOrigin(0);
  }, []);

  const editGramsSliderMax = editGramsOrigin * 2;
  const editGramsSliderValue = useMemo(() => {
    if (!(editGramsSliderMax > 0)) return 0;
    const g = parseNum(editDraft.grams);
    if (!Number.isFinite(g)) return editGramsOrigin;
    return Math.min(editGramsSliderMax, Math.max(0, g));
  }, [editDraft.grams, editGramsOrigin, editGramsSliderMax]);

  const saveEditItem = useCallback(() => {
    if (editItemIndex == null) return;
    const name = editDraft.name.trim();
    if (!name) return;
    setItems((prev) => {
      const next = [...prev];
      const cur = next[editItemIndex];
      if (!cur) return prev;
      next[editItemIndex] = {
        ...cur,
        name: cur.name || name,
        name_local: name,
        grams: Math.max(0, Math.round(parseNum(editDraft.grams))),
        kcal: Math.max(0, Math.round(parseNum(editDraft.kcal))),
        protein_g: Math.round(parseNum(editDraft.protein_g) * 10) / 10,
        carb_g: Math.round(parseNum(editDraft.carb_g) * 10) / 10,
        fat_g: Math.round(parseNum(editDraft.fat_g) * 10) / 10,
        fiber_g: Math.round(parseNum(editDraft.fiber_g) * 10) / 10,
        rule_conflict: false,
        rule_message: '',
      };
      return next;
    });
    setOverrideSaveOnce(false);
    setOverrideSnapshotKey(null);
    setEditItemIndex(null);
    setEditGramsOrigin(0);
  }, [editItemIndex, editDraft]);

  const handleDeleteItem = useCallback(
    (index: number) => {
      if (screen !== 'result') return;
      const item = items[index];
      if (!item) return;
      const label = item.name_local ?? item.name;
      Alert.alert(ui.deleteItemTitle, ui.deleteItemMessage(label), [
        { text: ui.cancel, style: 'cancel' },
        {
          text: ui.deleteItem,
          style: 'destructive',
          onPress: () => {
            setItems((prev) => prev.filter((_, i) => i !== index));
            setOverrideSaveOnce(false);
            setOverrideSnapshotKey(null);
          },
        },
      ]);
    },
    [screen, items, ui],
  );

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    Alert.alert(ui.deleteMealTitle, ui.deleteMealMessage, [
      { text: ui.cancel, style: 'cancel' },
      {
        text: ui.deleteMeal,
        style: 'destructive',
        onPress: async () => {
          setScreen('saving');
          await deleteMeal(editingId, mealTime);
          await onSaved();
          reset();
        },
      },
    ]);
  }, [editingId, mealTime, reset, onSaved, ui]);

  const persistSave = useCallback(async () => {
    await persistMealItems({
      mealItems: items,
      historyLen: mealHistory.length,
      fromPhoto: hadPhotoForSave,
      id: editingId,
      timestamp: mealTime,
      stayOpen: false,
    });
  }, [items, mealHistory.length, hadPhotoForSave, editingId, mealTime, persistMealItems]);

  const handleSave = useCallback(async () => {
    if (items.length === 0) return;

    const snapshot = mealItemsSnapshotKey(items);
    setScreen('saving');
    const issues = await recomputeMealIssues(items, mealTime, editingId);
    setMealIssues(issues);

    if (issues.length > 0 && !(overrideSaveOnce && overrideSnapshotKey === snapshot)) {
      setScreen('result');
      setShowIssueModal(true);
      return;
    }

    try {
      await persistSave();
    } catch {
      setError(alerts.failedToSave);
      setScreen('result');
    }
  }, [items, mealTime, editingId, overrideSaveOnce, overrideSnapshotKey, recomputeMealIssues, persistSave]);

  const handleSaveAnyway = useCallback(async () => {
    if (items.length === 0) {
      setShowIssueModal(false);
      setError(alerts.nothingToSave);
      setScreen('result');
      return;
    }
    const snapshot = mealItemsSnapshotKey(items);
    setOverrideSaveOnce(true);
    setOverrideSnapshotKey(snapshot);
    setShowIssueModal(false);
    setScreen('saving');
    try {
      await persistSave();
    } catch {
      setError(alerts.failedToSave);
      setScreen('result');
    }
  }, [items, persistSave]);

  const flaggedIndices = flaggedItemIndices(items, mealIssues);

  const showMealSection = items.length > 0 || editingId != null;
  const describePlaceholder = photoUi.describePlaceholder;
  const chatPlaceholder = photoSession
    ? photoUi.chatPlaceholderPhoto
    : photoUi.chatPlaceholderHistory;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {screen === 'pickPast'
                ? ui.fromPastTitle
                : editingId
                  ? ui.editMeal
                  : ui.logMeal}
            </Text>
            <Pressable
              onPress={screen === 'pickPast' ? () => setScreen('idle') : handleClose}
              style={[styles.closeBtn, screen === 'saving' && styles.closeBtnDisabled]}
              hitSlop={12}
              disabled={screen === 'saving'}
            >
              <Text style={styles.closeBtnText}>{screen === 'pickPast' ? '←' : '✕'}</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {screen === 'idle' && (
              <View style={styles.idleWrap}>
                <View style={styles.photoRow}>
                  <Pressable style={styles.cameraBtn} onPress={handleCamera}>
                    <DashIcon icon={ActionIcons.camera} size={34} color="#fff" />
                    <Text style={styles.cameraBtnLabel}>{ui.camera}</Text>
                  </Pressable>
                  <Pressable style={[styles.cameraBtn, styles.galleryBtn]} onPress={handleGallery}>
                    <DashIcon icon={ActionIcons.gallery} size={34} color="#fff" />
                    <Text style={styles.cameraBtnLabel}>{ui.gallery}</Text>
                  </Pressable>
                </View>

                <Text style={styles.orDivider}>{ui.orDescribeIt}</Text>

                <View style={styles.textInputRow}>
                  <TextInput
                    ref={describeInputRef}
                    style={styles.describeInput}
                    placeholder={describePlaceholder}
                    placeholderTextColor={colors.textSecondary}
                    value={textPrompt}
                    onChangeText={setTextPrompt}
                    onSubmitEditing={handleTextSubmit}
                    returnKeyType="done"
                    multiline={false}
                    showSoftInputOnFocus
                  />
                  <Pressable
                    style={[styles.sendBtn, !textPrompt.trim() && styles.sendBtnDisabled]}
                    onPress={handleTextSubmit}
                    disabled={!textPrompt.trim()}
                  >
                    <Text style={styles.sendBtnText}>→</Text>
                  </Pressable>
                </View>

                {!editEntry ? (
                  <>
                    <Text style={styles.orDivider}>{ui.orDivider}</Text>
                    <Pressable style={styles.fromPastBtn} onPress={openPastMealPicker}>
                      <Text style={styles.fromPastBtnText}>{ui.fromPastMeal}</Text>
                    </Pressable>
                  </>
                ) : null}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}

            {screen === 'pickPast' && (
              <View style={styles.pickPastWrap}>
                <View style={styles.browseDayNav}>
                  <Pressable
                    style={styles.browseDayBtn}
                    onPress={() => shiftBrowseDay(-1)}
                    hitSlop={8}
                    accessibilityLabel="Previous day"
                  >
                    <Text style={styles.browseDayBtnText}>‹</Text>
                  </Pressable>
                  <Text style={styles.browseDayLabel}>
                    {formatBrowseDayLabel(browseDayMs, lang?.code)}
                  </Text>
                  <Pressable
                    style={[
                      styles.browseDayBtn,
                      foodLogDayKey(browseDayMs) === foodLogDayKey(Date.now()) &&
                        styles.browseDayBtnDisabled,
                    ]}
                    onPress={() => shiftBrowseDay(1)}
                    disabled={foodLogDayKey(browseDayMs) === foodLogDayKey(Date.now())}
                    hitSlop={8}
                    accessibilityLabel="Next day"
                  >
                    <Text style={styles.browseDayBtnText}>›</Text>
                  </Pressable>
                </View>

                {pastDayLoading ? (
                  <ActivityIndicator color={colors.accentBlue} style={{ marginTop: 24 }} />
                ) : pastDayMeals.length === 0 ? (
                  <Text style={[styles.emptyPastText, rtl && styles.textRtl]}>{ui.noMealsThatDay}</Text>
                ) : (
                  <View style={styles.pastMealList}>
                    {pastDayMeals.map((entry) => {
                      const itemsPreview = pastMealItemsPreview(entry);
                      return (
                      <Pressable
                        key={entry.id}
                        style={({ pressed }) => [
                          styles.pastMealRow,
                          pressed && styles.pastMealRowPressed,
                        ]}
                        onPress={() => applyPastMealAsNew(entry)}
                        accessibilityRole="button"
                        accessibilityLabel={ui.useAsNewMeal}
                      >
                        <View style={styles.pastMealMain}>
                          <Text style={styles.pastMealTime}>
                            {formatTime(entry.timestamp, lang?.code)}
                          </Text>
                          <Text style={[styles.pastMealLabel, rtl && styles.textRtl]} numberOfLines={1}>
                            {mealSlotLabel(entry, ui)}
                          </Text>
                          {itemsPreview ? (
                            <Text
                              style={[styles.pastMealItems, rtl && styles.textRtl]}
                              numberOfLines={2}
                            >
                              {itemsPreview}
                            </Text>
                          ) : null}
                          <Text style={styles.pastMealKcal}>
                            {formatEnergy(entry.totalKcal, energyUnit)}
                          </Text>
                        </View>
                        <Text style={styles.pastMealCta}>{ui.useAsNewMeal}</Text>
                      </Pressable>
                      );
                    })}
                  </View>
                )}

                <Pressable style={styles.pastBackBtn} onPress={() => setScreen('idle')}>
                  <Text style={styles.pastBackBtnText}>{ui.back}</Text>
                </Pressable>
              </View>
            )}

            {screen === 'analyzing' && (
              <View style={styles.analyzingWrap}>
                {analyzingPhotoUri ? (
                  <Image source={{ uri: analyzingPhotoUri }} style={styles.photoThumb} resizeMode="cover" />
                ) : null}
                <ActivityIndicator color={colors.accentBlue} size="large" style={{ marginTop: 24 }} />
                <Text style={styles.analyzingLabel}>{alerts.analyzing}</Text>
              </View>
            )}

            {(screen === 'result' || screen === 'saving') && (
              <View style={styles.resultWrap}>
                {autoSavedBanner ? (
                  <View style={styles.autoSavedBanner}>
                    <Text
                      style={[styles.autoSavedBannerText, rtl && styles.autoSavedBannerRtl]}
                    >
                      {ui.autoSavedHint}
                    </Text>
                  </View>
                ) : null}
                {mergePreview ? (
                  <View style={styles.previewSection}>
                    <Text style={[styles.sectionTitle, rtl && styles.sectionTitleRtl]}>
                      {photoUi.previewUpdate}
                    </Text>
                    <Text style={[styles.previewModeLabel, rtl && styles.descriptionTextRtl]}>
                      {mergePreview.mode === 'add'
                        ? photoUi.addingPhotoItems
                        : photoUi.removingPhotoItems}
                    </Text>
                    <View style={styles.previewColumns}>
                      <View style={styles.previewCol}>
                        <Text style={styles.previewColTitle}>{photoUi.currentMeal}</Text>
                        <FoodItemsCard
                          items={mergePreview.before}
                          energyUnit={energyUnit}
                          emptyLabel={photoUi.emptyItems}
                        />
                      </View>
                      <View style={styles.previewCol}>
                        <Text style={styles.previewColTitle}>{photoUi.afterUpdate}</Text>
                        <FoodItemsCard
                          items={mergePreview.after}
                          energyUnit={energyUnit}
                          emptyLabel={photoUi.emptyItems}
                        />
                      </View>
                    </View>
                    <View style={styles.deltaBox}>
                      <Text style={styles.deltaLabel}>{photoUi.change}</Text>
                      <Text style={styles.deltaValue}>
                        {macroDelta(mergePreview.before, mergePreview.after, energyUnit)}
                      </Text>
                    </View>
                    <View style={styles.previewActions}>
                      <Pressable style={styles.cancelPreviewBtn} onPress={handleCancelMerge} disabled={screen === 'saving'}>
                        <Text style={styles.cancelPreviewBtnText}>{ui.cancel}</Text>
                      </Pressable>
                      <Pressable style={styles.approveBtn} onPress={handleApproveMerge} disabled={screen === 'saving'}>
                        <Text style={styles.approveBtnText}>{photoUi.approveUpdate}</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {showMealSection && !mergePreview ? (
                  <View style={styles.mealSection}>
                    <Text style={[styles.sectionTitle, rtl && styles.sectionTitleRtl]}>
                      {ui.yourMeal}
                    </Text>
                    {!photoSession && description && items.length > 0 ? (
                      <Text
                        style={[styles.descriptionText, rtl && styles.descriptionTextRtl]}
                      >
                        {description}
                      </Text>
                    ) : null}
                    <FoodItemsCard
                      items={items}
                      flaggedIndices={flaggedIndices}
                      energyUnit={energyUnit}
                      editable={screen === 'result'}
                      editLabel={ui.editItem}
                      deleteLabel={ui.deleteItem}
                      emptyLabel={photoUi.emptyItems}
                      onEditItem={openEditItem}
                      onDeleteItem={handleDeleteItem}
                    />
                  </View>
                ) : null}

                {photoSession && !mergePreview ? (
                  <View style={styles.photoSection}>
                    <Text style={[styles.sectionTitle, rtl && styles.sectionTitleRtl]}>
                      {photoUi.photoAssistant}
                    </Text>
                    <Image source={{ uri: photoSession.uri }} style={styles.photoThumbSmall} resizeMode="cover" />
                    <View
                      style={[
                        styles.confidenceBadge,
                        {
                          backgroundColor: isDark
                            ? colors.background
                            : confidenceColor(photoSession.confidence, colors, isDark) + '20',
                          borderColor:
                            confidenceColor(photoSession.confidence, colors, isDark) +
                            (isDark ? '' : '60'),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confidenceText,
                          { color: confidenceColor(photoSession.confidence, colors, isDark) },
                        ]}
                      >
                        {photoSession.confidence === 'high'
                          ? `✓ ${ui.confidenceHigh}`
                          : photoSession.confidence === 'medium'
                            ? `⚠ ${ui.confidenceMedium}`
                            : `⚠ ${ui.confidenceLow}`}
                      </Text>
                    </View>
                    {photoSession.description ? (
                      <Text style={styles.descriptionText}>{photoSession.description}</Text>
                    ) : null}
                    <FoodItemsCard
                      items={photoSession.items}
                      title={photoUi.fromPhoto}
                      energyUnit={energyUnit}
                      emptyLabel={photoUi.emptyItems}
                    />
                    {photoSession.suggestion ? (
                      <View style={styles.suggestionBox}>
                        <Text style={styles.suggestionText}>💡 {photoSession.suggestion}</Text>
                      </View>
                    ) : null}

                    <View style={styles.photoRow}>
                      <Pressable style={[styles.afterPhotoBtn, styles.afterPhotoBtnRow]} onPress={() => handleAddPhoto('camera')}>
                        <DashIcon icon={ActionIcons.camera} size={15} color={colors.textPrimary} />
                        <Text style={styles.afterPhotoBtnText}>{photoUi.newPhoto}</Text>
                      </Pressable>
                      <Pressable style={[styles.afterPhotoBtn, styles.afterPhotoBtnRow]} onPress={() => handleAddPhoto('gallery')}>
                        <DashIcon icon={ActionIcons.gallery} size={15} color={colors.textPrimary} />
                        <Text style={styles.afterPhotoBtnText}>{ui.gallery}</Text>
                      </Pressable>
                    </View>

                    {photoSession.items.length > 0 ? (
                      <View style={styles.intentRow}>
                        {items.length === 0 ? (
                          <Pressable style={styles.useMealBtn} onPress={() => handleStartMerge('add')}>
                            <Text style={styles.useMealBtnText}>{photoUi.useAsMeal}</Text>
                          </Pressable>
                        ) : (
                          <>
                            <Pressable style={styles.addBtn} onPress={() => handleStartMerge('add')}>
                              <Text style={styles.addBtnText}>{photoUi.addToMeal}</Text>
                            </Pressable>
                            <Pressable style={styles.removeBtn} onPress={() => handleStartMerge('remove')}>
                              <Text style={styles.removeBtnText}>{photoUi.removeFromMeal}</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    ) : null}
                    <Text style={[styles.removeHint, rtl && styles.descriptionTextRtl]}>
                      {photoUi.removeLeftoversHint}
                    </Text>
                  </View>
                ) : null}

                {!photoSession && !mergePreview && items.length > 0 ? (
                  <>
                    <View
                      style={[
                        styles.confidenceBadge,
                        {
                          backgroundColor: isDark
                            ? colors.background
                            : confidenceColor(confidence, colors, isDark) + '20',
                          borderColor:
                            confidenceColor(confidence, colors, isDark) + (isDark ? '' : '60'),
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confidenceText,
                          { color: confidenceColor(confidence, colors, isDark) },
                        ]}
                      >
                        {confidence === 'high'
                          ? `✓ ${ui.confidenceHigh}`
                          : confidence === 'medium'
                            ? `⚠ ${ui.confidenceMedium}`
                            : `⚠ ${ui.confidenceLow}`}
                      </Text>
                    </View>
                    {suggestion ? (
                      <View style={styles.suggestionBox}>
                        <Text style={styles.suggestionText}>💡 {suggestion}</Text>
                      </View>
                    ) : null}
                  </>
                ) : null}

                {!mergePreview && (screen === 'result' || screen === 'saving') ? (
                  <>
                    {!photoSession && items.length > 0 ? (
                      <View style={styles.addPhotoRow}>
                        <Text style={[styles.addPhotoLabel, rtl && styles.addPhotoLabelRtl]}>
                          {ui.updateWithPhoto}
                        </Text>
                        <View style={styles.photoRow}>
                          <Pressable style={[styles.afterPhotoBtn, styles.afterPhotoBtnRow]} onPress={() => handleAddPhoto('camera')}>
                            <DashIcon icon={ActionIcons.camera} size={15} color={colors.textPrimary} />
                            <Text style={styles.afterPhotoBtnText}>{ui.camera}</Text>
                          </Pressable>
                          <Pressable style={[styles.afterPhotoBtn, styles.afterPhotoBtnRow]} onPress={() => handleAddPhoto('gallery')}>
                            <DashIcon icon={ActionIcons.gallery} size={15} color={colors.textPrimary} />
                            <Text style={styles.afterPhotoBtnText}>{ui.gallery}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.chatRow}>
                      <TextInput
                        ref={chatInputRef}
                        style={styles.chatInput}
                        placeholder={chatPlaceholder}
                        placeholderTextColor={colors.textSecondary}
                        value={chatText}
                        onChangeText={setChatText}
                        onSubmitEditing={handleCorrection}
                        returnKeyType="send"
                        editable={screen === 'result'}
                      />
                      <Pressable
                        style={[styles.sendBtn, (!chatText.trim() || screen !== 'result') && styles.sendBtnDisabled]}
                        onPress={handleCorrection}
                        disabled={!chatText.trim() || screen !== 'result'}
                      >
                        <Text style={styles.sendBtnText}>→</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                <Pressable style={styles.timeRow} onPress={openMealDateTimePicker}>
                  <Text style={[styles.timeLabel, rtl && styles.timeLabelRtl]}>
                    🕐 {ui.dateAndTime}:
                  </Text>
                  <Text style={styles.timeValue}>{formatMealDateTime(mealTime, lang?.code)}</Text>
                  <Text style={styles.timeEdit}>{ui.editItem}</Text>
                </Pressable>
                <IosDateTimePickerSheet
                  visible={showTimePicker && Platform.OS === 'ios'}
                  value={new Date(mealTime)}
                  mode="datetime"
                  maximumDate={new Date()}
                  doneLabel={ui.done}
                  onDone={(date) => {
                    setMealTime(capMealTimestamp(date.getTime()));
                    setShowTimePicker(false);
                  }}
                  onCancel={() => setShowTimePicker(false)}
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}
          </ScrollView>

          {(screen === 'result' || screen === 'saving') && !mergePreview ? (
            <View style={styles.actions}>
              {editingId ? (
                <Pressable
                  style={styles.deleteBtn}
                  onPress={handleDelete}
                  disabled={screen === 'saving'}
                  accessibilityRole="button"
                  accessibilityLabel={ui.deleteMeal}
                >
                  <DashIcon icon={ActionIcons.clear} size={16} color={colors.accentRed} />
                  <Text style={styles.deleteBtnText} numberOfLines={1}>{ui.deleteItem}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelBtnText} numberOfLines={1}>{ui.cancel}</Text>
                </Pressable>
              )}
              {autoSavedBanner && editingId ? (
                <Pressable
                  style={[styles.saveBtn, screen === 'saving' && styles.saveBtnDisabled]}
                  onPress={() => void handleSave()}
                  disabled={screen === 'saving'}
                >
                  {screen === 'saving' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText} numberOfLines={1}>{ui.done}</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.saveBtn, (screen === 'saving' || items.length === 0) && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={screen === 'saving' || items.length === 0}
                >
                  {screen === 'saving' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText} numberOfLines={1}>{ui.saveItem}</Text>
                  )}
                </Pressable>
              )}
              {editingId && !autoSavedBanner ? (
                <Pressable style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelBtnText} numberOfLines={1}>{ui.cancel}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {showIssueModal && mealIssues.length > 0 ? (
            <View style={styles.issueOverlay}>
              <View style={styles.issueModalCard}>
                <Text style={styles.issueModalTitle}>{alerts.nutritionistAlert}</Text>
                <Text style={styles.issueModalBody}>{issueModalBody(mealIssues)}</Text>
                <View style={styles.issueModalActions}>
                  <Pressable
                    style={styles.issueEditBtn}
                    onPress={() => setShowIssueModal(false)}
                    disabled={screen === 'saving'}
                  >
                    <Text style={styles.issueEditText}>{alerts.editMealAction}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.issueSaveAnywayBtn}
                    onPress={() => void handleSaveAnyway()}
                    disabled={screen === 'saving'}
                  >
                    <Text style={styles.issueSaveAnywayText}>{alerts.saveAnyway}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {screen === 'saving' ? (
            <View style={styles.savingOverlay} pointerEvents="auto">
              <View style={styles.savingCard}>
                <ActivityIndicator color={colors.accentBlue} size="large" />
                <Text style={styles.savingTitle}>{alerts.savingMeal}</Text>
                <Text style={styles.savingSub}>{alerts.updatingFoodLog}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={editItemIndex != null}
        animationType="slide"
        transparent
        onRequestClose={closeEditItem}
      >
        <View style={styles.editItemBackdrop}>
          <View
            style={[
              styles.editItemCard,
              {
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <Text style={[styles.editItemTitle, rtl && styles.textRtl]}>{ui.editItemTitle}</Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.editItemForm}
            >
              {(
                [
                  ['name', ui.fieldName],
                  ['grams', ui.fieldGrams],
                  ['kcal', ui.fieldKcal],
                ] as const
              ).map(([key, label]) => (
                <View key={key} style={styles.editField}>
                  <Text style={[styles.editFieldLabel, rtl && styles.textRtl]}>{label}</Text>
                  <TextInput
                    style={[styles.editFieldInput, rtl && styles.textRtl]}
                    value={editDraft[key]}
                    onChangeText={(v) => {
                      if (key === 'grams') onEditGramsChange(v);
                      else if (key === 'kcal') onEditNutrientChange('kcal', v);
                      else setEditDraft((d) => ({ ...d, [key]: v }));
                    }}
                    keyboardType={key === 'name' ? 'default' : 'decimal-pad'}
                    autoCapitalize={key === 'name' ? 'sentences' : 'none'}
                  />
                  {key === 'grams' && editGramsOrigin > 0 ? (
                    <View style={styles.editGramsSliderWrap}>
                      <Slider
                        style={styles.editGramsSlider}
                        minimumValue={0}
                        maximumValue={editGramsSliderMax}
                        step={1}
                        value={editGramsSliderValue}
                        onValueChange={onEditGramsSlider}
                        minimumTrackTintColor={colors.accentBlue}
                        maximumTrackTintColor={colors.gridLine}
                        thumbTintColor={colors.accentBlue}
                        accessibilityLabel={ui.fieldGrams}
                      />
                      <View style={styles.editGramsSliderLabels}>
                        <Text style={styles.editGramsSliderLabel}>0</Text>
                        <Text style={styles.editGramsSliderLabelMid}>
                          {Math.round(editGramsOrigin)}
                        </Text>
                        <Text style={styles.editGramsSliderLabel}>
                          {Math.round(editGramsSliderMax)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))}
              <View style={[styles.editMacroRow, rtl && styles.editMacroRowRtl]}>
                {(
                  [
                    ['protein_g', ui.fieldProtein],
                    ['carb_g', ui.fieldCarb],
                    ['fat_g', ui.fieldFat],
                  ] as const
                ).map(([key, label]) => (
                  <View key={key} style={styles.editMacroField}>
                    <Text
                      style={[styles.editFieldLabel, styles.editMacroLabel, rtl && styles.textRtl]}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>
                    <TextInput
                      style={[styles.editFieldInput, styles.editMacroInput, rtl && styles.textRtl]}
                      value={editDraft[key]}
                      onChangeText={(v) => onEditNutrientChange(key, v)}
                      keyboardType="decimal-pad"
                      accessibilityLabel={label}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.editField}>
                <Text style={[styles.editFieldLabel, rtl && styles.textRtl]}>{ui.fieldFiber}</Text>
                <TextInput
                  style={[styles.editFieldInput, rtl && styles.textRtl]}
                  value={editDraft.fiber_g}
                  onChangeText={(v) => onEditNutrientChange('fiber_g', v)}
                  keyboardType="decimal-pad"
                />
              </View>
            </ScrollView>
            <View style={styles.editItemActions}>
              <Pressable
                style={[styles.editItemSaveBtn, !editDraft.name.trim() && styles.saveBtnDisabled]}
                onPress={saveEditItem}
                disabled={!editDraft.name.trim()}
              >
                <Text style={styles.editItemSaveText}>{ui.saveItem}</Text>
              </Pressable>
              <Pressable style={styles.editItemCancelBtn} onPress={closeEditItem}>
                <Text style={styles.editItemCancelText}>{ui.cancel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  kav: { flex: 1 },
  autoSavedBanner: {
    backgroundColor: c.iconTintGreen,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  autoSavedBannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: c.textPrimary,
    fontWeight: '600',
  },
  autoSavedBannerRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.gridLine,
    backgroundColor: c.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
  },
  closeBtn: { padding: 4 },
  closeBtnDisabled: { opacity: 0.35 },
  closeBtnText: { fontSize: 18, color: c.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 60,
  },
  savingCard: {
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 32,
    gap: 10,
    minWidth: 200,
    ...cardShadow,
  },
  savingTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: c.textPrimary,
  },
  savingSub: {
    fontSize: 13,
    color: c.textSecondary,
  },

  idleWrap: { alignItems: 'center', paddingTop: 16 },
  photoRow: { flexDirection: 'row', width: '100%', gap: 12 },
  cameraBtn: {
    flex: 1,
    backgroundColor: c.accentBlue,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    ...cardShadow,
  },
  // On-brand navy (was off-brand purple #7B1FA2) — same blue family as the camera
  // tile, distinguished by icon rather than a foreign hue.
  galleryBtn: { backgroundColor: isDark ? c.brandNavy : '#1F3D5C' },
  cameraBtnIcon: { fontSize: 36 },
  cameraBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  orDivider: { color: c.textSecondary, fontSize: 13, marginVertical: 20 },
  fromPastBtn: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: c.accentBlue,
    backgroundColor: c.accentBlue + '12',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  fromPastBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: c.accentBlue,
  },
  pickPastWrap: { gap: 14, paddingTop: 4 },
  browseDayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  browseDayBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.gridLine,
  },
  browseDayBtnDisabled: { opacity: 0.35 },
  browseDayBtnText: {
    fontSize: 22,
    fontWeight: '600',
    color: c.textPrimary,
    lineHeight: 26,
  },
  browseDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
    paddingHorizontal: 8,
  },
  emptyPastText: {
    marginTop: 20,
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
  },
  pastMealList: { gap: 10 },
  pastMealRow: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.gridLine,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    ...cardShadow,
  },
  pastMealRowPressed: { opacity: 0.85 },
  pastMealMain: { gap: 2 },
  pastMealTime: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textSecondary,
  },
  pastMealLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
  },
  pastMealItems: {
    fontSize: 13,
    color: c.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  pastMealKcal: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 2,
  },
  pastMealCta: {
    fontSize: 13,
    fontWeight: '700',
    color: c.accentBlue,
  },
  pastBackBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  pastBackBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary,
  },
  textInputRow: { flexDirection: 'row', width: '100%', gap: 8 },
  describeInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: isDark ? c.background : c.surface,
    color: c.textPrimary,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: c.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },

  analyzingWrap: { alignItems: 'center', paddingTop: 24 },
  photoThumb: { width: '100%', height: 200, borderRadius: 16 },
  analyzingLabel: { marginTop: 16, color: c.textSecondary, fontSize: 14 },

  resultWrap: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  sectionTitleRtl: { textAlign: 'right', writingDirection: 'rtl' },
  mealSection: { gap: 8 },
  photoSection: { gap: 8, marginTop: 4 },
  photoThumbSmall: { width: 88, height: 88, borderRadius: 12 },
  confidenceBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confidenceText: { fontSize: 12, fontWeight: '600' },
  descriptionText: { color: c.textSecondary, fontSize: 13, lineHeight: 18 },
  descriptionTextRtl: { textAlign: 'right', writingDirection: 'rtl' },
  itemsCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  itemsCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  emptyItemsText: {
    padding: 16,
    fontSize: 13,
    color: c.textSecondary,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: c.gridLine },
  itemRowFlagged: {
    borderLeftWidth: 4,
    borderLeftColor: isDark ? c.accentRed : '#C62828',
    backgroundColor: isDark ? c.background : '#FFEBEE',
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  itemNameRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6, minWidth: 0 },
  itemWarningDot: { fontSize: 11, color: isDark ? c.accentRed : '#C62828', marginTop: 1 },
  itemName: {
    flex: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontSize: 12,
    fontWeight: '600',
    color: c.textPrimary,
    lineHeight: 17,
  },
  itemNameFlagged: { color: isDark ? c.accentRed : '#B71C1C' },
  itemActions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 6,
    alignItems: 'center',
  },
  itemEditBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.accentBlue,
    backgroundColor: isDark ? c.background : c.accentBlue + '12',
  },
  itemEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: c.accentBlue,
  },
  itemDeleteBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.accentRed + '80',
    backgroundColor: isDark ? c.background : '#FFEBEE',
  },
  itemDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: c.accentRed,
  },
  itemRuleMessage: { fontSize: 11, color: isDark ? c.accentRed : '#C62828', lineHeight: 15 },
  itemGrams: { fontSize: 12, color: c.textSecondary },
  itemMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 2,
  },
  itemKcal: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
  itemMacros: { fontSize: 11, color: c.textSecondary, flexShrink: 1 },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: c.accentBlue + '40',
    backgroundColor: c.iconTintBlue,
  },
  totalValue: { fontSize: 13, fontWeight: '700', color: c.accentBlue },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  editItemBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
  },
  editItemCard: {
    backgroundColor: c.background,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    height: '90%',
    paddingHorizontal: 20,
  },
  editItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 12,
  },
  editItemForm: { gap: 12, paddingBottom: 16 },
  editField: { gap: 4 },
  editFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textSecondary,
  },
  editFieldInput: {
    borderWidth: 1.5,
    borderColor: c.gridLine,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: c.textPrimary,
    backgroundColor: isDark ? c.background : c.surface,
  },
  editGramsSliderWrap: {
    marginTop: 4,
    gap: 2,
  },
  editGramsSlider: {
    width: '100%',
    height: 36,
  },
  editGramsSliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  editGramsSliderLabel: {
    fontSize: 11,
    color: c.textSecondary,
    fontWeight: '500',
  },
  editGramsSliderLabelMid: {
    fontSize: 11,
    color: c.accentBlue,
    fontWeight: '700',
  },
  editMacroRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  editMacroRowRtl: {
    flexDirection: 'row-reverse',
  },
  editMacroField: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  editMacroLabel: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    minHeight: 28,
  },
  editMacroInput: {
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  editItemActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  editItemSaveBtn: {
    flex: 1,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    backgroundColor: isDark ? c.background : c.accentBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editItemSaveText: { color: isDark ? c.accentBlue : '#fff', fontWeight: '700', fontSize: 14 },
  editItemCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    backgroundColor: isDark ? c.background : 'transparent',
    alignItems: 'center',
  },
  editItemCancelText: { fontSize: 14, color: c.textSecondary, fontWeight: '600' },
  suggestionBox: {
    backgroundColor: isDark ? c.background : c.noticeSoftBg,
    borderWidth: 1,
    borderColor: c.noticeSoftBorder,
    borderRadius: 12,
    padding: 12,
  },
  suggestionText: { fontSize: 13, color: c.textPrimary, lineHeight: 18 },

  intentRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  useMealBtn: {
    flex: 1,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    backgroundColor: isDark ? c.background : c.accentBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  useMealBtnText: { color: isDark ? c.accentBlue : '#fff', fontSize: 14, fontWeight: '700' },
  addBtn: {
    flex: 1,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    backgroundColor: isDark ? c.background : c.accentBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { color: isDark ? c.accentBlue : '#fff', fontSize: 14, fontWeight: '700' },
  removeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.accentRed + '60',
    backgroundColor: isDark ? c.background : '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeBtnText: { color: c.accentRed, fontSize: 14, fontWeight: '700' },
  removeHint: { fontSize: 11, color: c.textSecondary, fontStyle: 'italic' },

  previewSection: { gap: 10 },
  previewModeLabel: { fontSize: 13, color: c.textSecondary },
  previewColumns: { gap: 16 },
  previewCol: { gap: 6 },
  previewColTitle: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
  deltaBox: {
    backgroundColor: c.iconTintBlue,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deltaLabel: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  deltaValue: { fontSize: 13, fontWeight: '700', color: c.accentBlue },
  previewActions: { flexDirection: 'row', gap: 10 },
  cancelPreviewBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    backgroundColor: isDark ? c.background : 'transparent',
    alignItems: 'center',
  },
  cancelPreviewBtnText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  approveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    backgroundColor: isDark ? c.background : c.accentBlue,
    alignItems: 'center',
  },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: isDark ? c.accentBlue : '#fff' },

  addPhotoRow: { gap: 6 },
  addPhotoLabel: { fontSize: 12, color: c.textSecondary },
  addPhotoLabelRtl: { textAlign: 'right', writingDirection: 'rtl' },
  afterPhotoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: c.progressTrack,
  },
  afterPhotoBtnRow: { flexDirection: 'row', gap: 6 },
  afterPhotoBtnText: { fontSize: 13, fontWeight: '600', color: c.textPrimary },

  chatRow: { flexDirection: 'row', gap: 8 },
  chatInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: isDark ? c.background : c.surface,
    color: c.textPrimary,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  timeLabel: { fontSize: 13, color: c.textSecondary },
  timeLabelRtl: { writingDirection: 'rtl' },
  timeValue: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  timeEdit: { fontSize: 12, color: c.accentBlue, marginLeft: 4 },

  errorText: { color: c.accentRed, fontSize: 13, marginTop: 8, textAlign: 'center' },

  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: c.gridLine,
    backgroundColor: c.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.gridLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
  deleteBtn: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? c.accentRed + '80' : '#FFCDD2',
    backgroundColor: isDark ? c.background : '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: c.accentRed },
  saveBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    backgroundColor: isDark ? c.background : c.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: isDark ? c.accentBlue : '#fff' },

  issueOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 50,
  },
  issueModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 20,
    gap: 14,
    ...cardShadow,
  },
  issueModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: isDark ? c.accentRed : '#B71C1C',
    textAlign: 'center',
  },
  issueModalBody: {
    fontSize: 14,
    lineHeight: 21,
    color: c.textPrimary,
    textAlign: 'center',
  },
  issueModalActions: { gap: 10, marginTop: 4 },
  issueEditBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.accentBlue : 'transparent',
    backgroundColor: isDark ? c.background : c.accentBlue,
    alignItems: 'center',
  },
  issueEditText: { fontSize: 15, fontWeight: '700', color: isDark ? c.accentBlue : '#fff' },
  issueSaveAnywayBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    backgroundColor: isDark ? c.background : 'transparent',
    alignItems: 'center',
  },
  issueSaveAnywayText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
});
