/**
 * Food Log Modal — camera / text → Gemini AI → correction chat → save.
 * New meal: text or first photo auto-saves and stays open for Done review.
 * Photo add/remove merge on existing meals still uses approve preview.
 */

import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { saveMeal, deleteMeal, foodLogDayKey, getDailyMacros, getRecentMeals, type FoodEntry } from '../services/FoodLogService';
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
import { getNutritionDirectiveAiContext } from '../services/NutritionDirectiveService';
import { WellnessColors, cardShadow } from '../theme/wellness';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = 'idle' | 'analyzing' | 'result' | 'saving';

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
  /** Refresh dashboard; pass `{ close: false }` to keep the modal open (auto-save review). */
  onSaved: (opts?: { close?: boolean }) => void;
  initialTimestamp?: number;
  editEntry?: FoodEntry;
  /** Pre-fill from recipe card (prompt40) — opens on result screen. */
  prefillItems?: FoodItem[];
  prefillDescription?: string;
  lang?: UserLanguage | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatMealDateTime(ms: number): string {
  const mealDay = foodLogDayKey(ms);
  const todayDay = foodLogDayKey(Date.now());
  const time = formatTime(ms);
  if (mealDay === todayDay) return time;
  const date = new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}

function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  if (c === 'high') return '#2E7D32';
  if (c === 'medium') return '#E65100';
  return '#C62828';
}

function macroSummary(items: FoodItem[]): string {
  const t = computeTotals(items);
  return `${Math.round(t.totalKcal)} kcal · P ${t.totalProtein_g.toFixed(0)}g · C ${t.totalCarb_g.toFixed(0)}g · F ${t.totalFat_g.toFixed(0)}g · Fi ${t.totalFiber_g.toFixed(0)}g`;
}

function macroDelta(before: FoodItem[], after: FoodItem[]): string {
  const b = computeTotals(before);
  const a = computeTotals(after);
  const dk = Math.round(a.totalKcal - b.totalKcal);
  const dp = (a.totalProtein_g - b.totalProtein_g).toFixed(0);
  const dc = (a.totalCarb_g - b.totalCarb_g).toFixed(0);
  const df = (a.totalFat_g - b.totalFat_g).toFixed(0);
  const dfi = (a.totalFiber_g - b.totalFiber_g).toFixed(0);
  const sign = dk >= 0 ? '+' : '';
  return `${sign}${dk} kcal · P ${dp}g · C ${dc}g · F ${df}g · Fi ${dfi}g`;
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

function FoodItemsCard({
  items,
  title,
  flaggedIndices,
}: {
  items: FoodItem[];
  title?: string;
  flaggedIndices?: Set<number>;
}) {
  if (items.length === 0) {
    return (
      <View style={[styles.itemsCard, cardShadow]}>
        {title ? <Text style={styles.itemsCardTitle}>{title}</Text> : null}
        <Text style={styles.emptyItemsText}>Empty</Text>
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
            <View style={styles.itemNameRow}>
              {flagged ? <Text style={styles.itemWarningDot}>⚠</Text> : null}
              <Text
                style={[styles.itemName, flagged && styles.itemNameFlagged]}
              >
                {item.name_local ?? item.name}
              </Text>
            </View>
            {flagged && item.rule_message ? (
              <Text style={styles.itemRuleMessage}>{item.rule_message}</Text>
            ) : null}
            <Text style={styles.itemGrams}>{item.grams}g</Text>
            <View style={styles.itemMetricsRow}>
              <Text style={styles.itemKcal}>{item.kcal} kcal</Text>
              <Text style={styles.itemMacros}>
                P {item.protein_g}g · C {item.carb_g}g · F {item.fat_g}g · Fi {item.fiber_g ?? 0}g
              </Text>
            </View>
          </View>
        );
      })}
      <View style={[styles.itemRow, styles.totalRow]}>
        <Text style={styles.totalValue}>{macroSummary(items)}</Text>
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
}: Props) {
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
    editEntry ? 'Editing saved meal' : prefillDescription ?? '',
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
  const chatInputRef = useRef<TextInput>(null);
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

  React.useEffect(() => {
    if (!visible) return;
    void loadFoodLogHistory(editingId);
  }, [visible, editingId, loadFoodLogHistory]);

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
      setDescription('Editing saved meal — add a photo or use chat to correct');
      setEditingId(editEntry.id);
      setMealHistory(seedMealHistory(editEntry, lang));
      setPhotoSession(null);
      setMergePreview(null);
      setChatText('');
      setError(null);
    }
  }, [editEntry, lang?.code]);

  React.useEffect(() => {
    if (visible && !editEntry) {
      setMealTime(initialTimestamp ?? Date.now());
    }
  }, [visible, initialTimestamp, editEntry]);

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

    const macroIssues = analyzeMacroMealIssues(issueInput);
    return [...macroIssues, ...mealIssuesFromFoodItems(mealItems)];
  }, []);

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
        onSaved({ close: false });
        return;
      }
      reset();
      onSaved({ close: true });
    },
    [reset, onSaved],
  );

  /**
   * New meal (text or first photo): analyze → save when clean, stay open to review time/items.
   * Photo +/- merge on existing items / edits stay multi-step.
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
          stayOpen: true,
        });
        return true;
      } catch {
        setError('Failed to save. Please try again.');
        setScreen('result');
        return false;
      }
    },
    [editingId, mealTime, recomputeMealIssues, persistMealItems],
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
      const directiveCtx = await getNutritionDirectiveAiContext();
      if (cancelled) return;
      if (!userRules && !directiveCtx) {
        setItems((prev) =>
          prev.map((item) => ({ ...item, rule_conflict: false, rule_message: undefined })),
        );
        return;
      }
      try {
        const geminiIssues = await checkMealAgainstUserRules(items, userRules, lang, directiveCtx);
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
    reset();
    onClose();
  }, [reset, onClose]);

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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'AI analysis failed. Please try again.');
        setScreen('result');
      }
    },
    [lang, resolveFoodLogHistory, editingId, tryAutoSaveNewMeal],
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
        setItems(result.items);
        setConfidence(result.confidence);
        setDescription(result.description);
        setSuggestion(result.suggestion);
        setMealHistory(updatedHistory);
        setHadPhotoForSave(true);

        const isFirstPhotoNewMeal =
          hist.length === 0 && !editingId && items.length === 0 && result.items.length > 0;

        // First photo on a new meal: same as text — auto-save, stay open, Done (no Use/Approve/Save).
        if (isFirstPhotoNewMeal) {
          const saved = await tryAutoSaveNewMeal(result.items, {
            fromPhoto: true,
            historyLen: updatedHistory.length,
          });
          if (saved) {
            setPhotoSession(null);
            setMergePreview(null);
            return;
          }
        }

        setPhotoSession({
          uri,
          base64: imageBase64,
          ...applyAnalysisResult(result, updatedHistory),
        });
        setScreen('result');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'AI analysis failed. Please try again.');
        setScreen(items.length > 0 || editEntry ? 'result' : 'idle');
      }
    },
    [lang, items.length, editEntry, editingId, resolveFoodLogHistory, tryAutoSaveNewMeal],
  );

  const pickImage = useCallback(
    async (source: 'camera' | 'gallery') => {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission required',
          `Please allow ${source === 'camera' ? 'camera' : 'photo library'} access in Settings.`,
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
        Alert.alert(
          'Image too large',
          'This photo is very large and may fail. Try a smaller image or use the camera instead.',
        );
      }
      await runPhotoAnalysis(asset.uri, b64, '', []);
    },
    [runPhotoAnalysis],
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
      } catch (e) {
        setError(e instanceof Error ? e.message : 'AI analysis failed. Please try again.');
        setScreen('result');
      }
      return;
    }

    await runMealAnalysis(text, mealHistory);
  }, [chatText, screen, mergePreview, photoSession, mealHistory, runMealAnalysis, lang, resolveFoodLogHistory]);

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
      mergePreview.mode === 'add'
        ? 'Photo items added to meal'
        : 'Matching items removed from meal',
    );
  }, [mergePreview]);

  const handleCancelMerge = useCallback(() => {
    setMergePreview(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!editingId) return;
    Alert.alert('Delete meal', 'Remove this meal from your log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setScreen('saving');
          await deleteMeal(editingId, mealTime);
          reset();
          onSaved();
        },
      },
    ]);
  }, [editingId, mealTime, reset, onSaved]);

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
      setError('Failed to save. Please try again.');
      setScreen('result');
    }
  }, [items, mealTime, editingId, overrideSaveOnce, overrideSnapshotKey, recomputeMealIssues, persistSave]);

  const handleSaveAnyway = useCallback(async () => {
    const snapshot = mealItemsSnapshotKey(items);
    setOverrideSaveOnce(true);
    setOverrideSnapshotKey(snapshot);
    setShowIssueModal(false);
    setScreen('saving');
    try {
      await persistSave();
    } catch {
      setError('Failed to save. Please try again.');
      setScreen('result');
    }
  }, [items, persistSave]);

  const flaggedIndices = flaggedItemIndices(items, mealIssues);

  const showMealSection = items.length > 0 || editingId != null;
  const rtl = lang?.code === 'he' || lang?.code === 'ar';
  const describePlaceholder = rtl
    ? 'למשל "שייק חלבון" או "הוסף את השייק מאתמול בערב"'
    : 'e.g. "protein shake" or "add last evening\'s shake"';
  const chatPlaceholder = photoSession
    ? rtl
      ? 'תיקון מהתמונה: "חצי פיתה", "הוסף קפה"…'
      : 'Correct photo list: "only half the pita", "add coffee"…'
    : rtl
      ? 'תיקון או מהעבר: "אותה ארוחת עוף", "השייק הרגיל שלי"…'
      : 'Correct or from history: "same chicken meal", "my usual shake"…';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{editingId ? 'Edit Meal' : 'Log Meal'}</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {screen === 'idle' && (
              <View style={styles.idleWrap}>
                <View style={styles.photoRow}>
                  <Pressable style={styles.cameraBtn} onPress={handleCamera}>
                    <Text style={styles.cameraBtnIcon}>📷</Text>
                    <Text style={styles.cameraBtnLabel}>Camera</Text>
                  </Pressable>
                  <Pressable style={[styles.cameraBtn, styles.galleryBtn]} onPress={handleGallery}>
                    <Text style={styles.cameraBtnIcon}>🖼</Text>
                    <Text style={styles.cameraBtnLabel}>Gallery</Text>
                  </Pressable>
                </View>

                <Text style={styles.orDivider}>— or describe it —</Text>

                <View style={styles.textInputRow}>
                  <TextInput
                    style={styles.describeInput}
                    placeholder={describePlaceholder}
                    placeholderTextColor={WellnessColors.textSecondary}
                    value={textPrompt}
                    onChangeText={setTextPrompt}
                    onSubmitEditing={handleTextSubmit}
                    returnKeyType="done"
                    multiline={false}
                  />
                  <Pressable
                    style={[styles.sendBtn, !textPrompt.trim() && styles.sendBtnDisabled]}
                    onPress={handleTextSubmit}
                    disabled={!textPrompt.trim()}
                  >
                    <Text style={styles.sendBtnText}>→</Text>
                  </Pressable>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}

            {screen === 'analyzing' && (
              <View style={styles.analyzingWrap}>
                {analyzingPhotoUri ? (
                  <Image source={{ uri: analyzingPhotoUri }} style={styles.photoThumb} resizeMode="cover" />
                ) : null}
                <ActivityIndicator color={WellnessColors.accentBlue} size="large" style={{ marginTop: 24 }} />
                <Text style={styles.analyzingLabel}>Analyzing…</Text>
              </View>
            )}

            {(screen === 'result' || screen === 'saving') && (
              <View style={styles.resultWrap}>
                {autoSavedBanner ? (
                  <View style={styles.autoSavedBanner}>
                    <Text style={styles.autoSavedBannerText}>
                      Saved — check time and items, then tap Done. Use chat to correct if needed.
                    </Text>
                  </View>
                ) : null}
                {mergePreview ? (
                  <View style={styles.previewSection}>
                    <Text style={styles.sectionTitle}>Preview update</Text>
                    <Text style={styles.previewModeLabel}>
                      {mergePreview.mode === 'add' ? 'Adding photo items to meal' : 'Removing items shown in photo'}
                    </Text>
                    <View style={styles.previewColumns}>
                      <View style={styles.previewCol}>
                        <Text style={styles.previewColTitle}>Current meal</Text>
                        <FoodItemsCard items={mergePreview.before} />
                      </View>
                      <View style={styles.previewCol}>
                        <Text style={styles.previewColTitle}>After update</Text>
                        <FoodItemsCard items={mergePreview.after} />
                      </View>
                    </View>
                    <View style={styles.deltaBox}>
                      <Text style={styles.deltaLabel}>Change</Text>
                      <Text style={styles.deltaValue}>{macroDelta(mergePreview.before, mergePreview.after)}</Text>
                    </View>
                    <View style={styles.previewActions}>
                      <Pressable style={styles.cancelPreviewBtn} onPress={handleCancelMerge} disabled={screen === 'saving'}>
                        <Text style={styles.cancelPreviewBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable style={styles.approveBtn} onPress={handleApproveMerge} disabled={screen === 'saving'}>
                        <Text style={styles.approveBtnText}>✓ Approve update</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                {showMealSection && !mergePreview ? (
                  <View style={styles.mealSection}>
                    <Text style={styles.sectionTitle}>Your meal</Text>
                    {!photoSession && description && items.length > 0 ? (
                      <Text style={styles.descriptionText}>{description}</Text>
                    ) : null}
                    <FoodItemsCard items={items} flaggedIndices={flaggedIndices} />
                  </View>
                ) : null}

                {photoSession && !mergePreview ? (
                  <View style={styles.photoSection}>
                    <Text style={styles.sectionTitle}>Photo assistant</Text>
                    <Image source={{ uri: photoSession.uri }} style={styles.photoThumbSmall} resizeMode="cover" />
                    <View
                      style={[
                        styles.confidenceBadge,
                        {
                          backgroundColor: confidenceColor(photoSession.confidence) + '20',
                          borderColor: confidenceColor(photoSession.confidence) + '60',
                        },
                      ]}
                    >
                      <Text style={[styles.confidenceText, { color: confidenceColor(photoSession.confidence) }]}>
                        {photoSession.confidence === 'high'
                          ? '✓ High confidence'
                          : photoSession.confidence === 'medium'
                            ? '⚠ Medium confidence'
                            : '⚠ Low confidence'}
                      </Text>
                    </View>
                    {photoSession.description ? (
                      <Text style={styles.descriptionText}>{photoSession.description}</Text>
                    ) : null}
                    <FoodItemsCard items={photoSession.items} title="From photo" />
                    {photoSession.suggestion ? (
                      <View style={styles.suggestionBox}>
                        <Text style={styles.suggestionText}>💡 {photoSession.suggestion}</Text>
                      </View>
                    ) : null}

                    <View style={styles.photoRow}>
                      <Pressable style={styles.afterPhotoBtn} onPress={() => handleAddPhoto('camera')}>
                        <Text style={styles.afterPhotoBtnText}>📷 New photo</Text>
                      </Pressable>
                      <Pressable style={styles.afterPhotoBtn} onPress={() => handleAddPhoto('gallery')}>
                        <Text style={styles.afterPhotoBtnText}>🖼 Gallery</Text>
                      </Pressable>
                    </View>

                    {photoSession.items.length > 0 ? (
                      <View style={styles.intentRow}>
                        {items.length === 0 ? (
                          <Pressable style={styles.useMealBtn} onPress={() => handleStartMerge('add')}>
                            <Text style={styles.useMealBtnText}>Use as meal</Text>
                          </Pressable>
                        ) : (
                          <>
                            <Pressable style={styles.addBtn} onPress={() => handleStartMerge('add')}>
                              <Text style={styles.addBtnText}>+ Add to meal</Text>
                            </Pressable>
                            <Pressable style={styles.removeBtn} onPress={() => handleStartMerge('remove')}>
                              <Text style={styles.removeBtnText}>− Remove from meal</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    ) : null}
                    <Text style={styles.removeHint}>
                      Remove = photo shows food you did not eat (leftovers)
                    </Text>
                  </View>
                ) : null}

                {!photoSession && !mergePreview && items.length > 0 ? (
                  <>
                    <View
                      style={[
                        styles.confidenceBadge,
                        {
                          backgroundColor: confidenceColor(confidence) + '20',
                          borderColor: confidenceColor(confidence) + '60',
                        },
                      ]}
                    >
                      <Text style={[styles.confidenceText, { color: confidenceColor(confidence) }]}>
                        {confidence === 'high'
                          ? '✓ High confidence'
                          : confidence === 'medium'
                            ? '⚠ Medium confidence'
                            : '⚠ Low confidence'}
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
                        <Text style={styles.addPhotoLabel}>Update with a photo:</Text>
                        <View style={styles.photoRow}>
                          <Pressable style={styles.afterPhotoBtn} onPress={() => handleAddPhoto('camera')}>
                            <Text style={styles.afterPhotoBtnText}>📷 Camera</Text>
                          </Pressable>
                          <Pressable style={styles.afterPhotoBtn} onPress={() => handleAddPhoto('gallery')}>
                            <Text style={styles.afterPhotoBtnText}>🖼 Gallery</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.chatRow}>
                      <TextInput
                        ref={chatInputRef}
                        style={styles.chatInput}
                        placeholder={chatPlaceholder}
                        placeholderTextColor={WellnessColors.textSecondary}
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
                  <Text style={styles.timeLabel}>🕐 Date & time:</Text>
                  <Text style={styles.timeValue}>{formatMealDateTime(mealTime)}</Text>
                  <Text style={styles.timeEdit}>Edit</Text>
                </Pressable>
                {showTimePicker && Platform.OS === 'ios' && (
                  <DateTimePicker
                    value={new Date(mealTime)}
                    mode="datetime"
                    display="spinner"
                    maximumDate={new Date()}
                    onChange={(_, date) => {
                      setShowTimePicker(false);
                      if (date) setMealTime(capMealTimestamp(date.getTime()));
                    }}
                  />
                )}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </View>
            )}
          </ScrollView>

          {(screen === 'result' || screen === 'saving') && !mergePreview ? (
            <View style={styles.actions}>
              {editingId ? (
                <Pressable style={styles.deleteBtn} onPress={handleDelete} disabled={screen === 'saving'}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
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
                    <Text style={styles.saveBtnText}>Done</Text>
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
                    <Text style={styles.saveBtnText}>✓ Save meal</Text>
                  )}
                </Pressable>
              )}
              {editingId && !autoSavedBanner ? (
                <Pressable style={styles.cancelBtn} onPress={handleClose}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {showIssueModal && mealIssues.length > 0 ? (
            <View style={styles.issueOverlay}>
              <View style={styles.issueModalCard}>
                <Text style={styles.issueModalTitle}>Nutritionist alert</Text>
                <Text style={styles.issueModalBody}>{issueModalBody(mealIssues)}</Text>
                <View style={styles.issueModalActions}>
                  <Pressable
                    style={styles.issueEditBtn}
                    onPress={() => setShowIssueModal(false)}
                    disabled={screen === 'saving'}
                  >
                    <Text style={styles.issueEditText}>Edit meal</Text>
                  </Pressable>
                  <Pressable
                    style={styles.issueSaveAnywayBtn}
                    onPress={() => void handleSaveAnyway()}
                    disabled={screen === 'saving'}
                  >
                    <Text style={styles.issueSaveAnywayText}>Save anyway</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  kav: { flex: 1 },
  autoSavedBanner: {
    backgroundColor: WellnessColors.iconTintGreen,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  autoSavedBannerText: {
    fontSize: 13,
    lineHeight: 18,
    color: WellnessColors.textPrimary,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: WellnessColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18, color: WellnessColors.textSecondary },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  idleWrap: { alignItems: 'center', paddingTop: 16 },
  photoRow: { flexDirection: 'row', width: '100%', gap: 12 },
  cameraBtn: {
    flex: 1,
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    ...cardShadow,
  },
  galleryBtn: { backgroundColor: '#7B1FA2' },
  cameraBtnIcon: { fontSize: 36 },
  cameraBtnLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  orDivider: { color: WellnessColors.textSecondary, fontSize: 13, marginVertical: 20 },
  textInputRow: { flexDirection: 'row', width: '100%', gap: 8 },
  describeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: WellnessColors.surface,
    color: WellnessColors.textPrimary,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: WellnessColors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },

  analyzingWrap: { alignItems: 'center', paddingTop: 24 },
  photoThumb: { width: '100%', height: 200, borderRadius: 16 },
  analyzingLabel: { marginTop: 16, color: WellnessColors.textSecondary, fontSize: 14 },

  resultWrap: { gap: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: WellnessColors.textPrimary },
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
  descriptionText: { color: WellnessColors.textSecondary, fontSize: 13, lineHeight: 18 },
  itemsCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  itemsCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  emptyItemsText: {
    padding: 16,
    fontSize: 13,
    color: WellnessColors.textSecondary,
    fontStyle: 'italic',
  },
  itemRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: WellnessColors.gridLine },
  itemRowFlagged: {
    borderLeftWidth: 4,
    borderLeftColor: '#C62828',
    backgroundColor: '#FFEBEE',
  },
  itemNameRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, width: '100%' },
  itemWarningDot: { fontSize: 11, color: '#C62828', marginTop: 1 },
  itemName: {
    flex: 1,
    flexShrink: 1,
    flexBasis: 0,
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    lineHeight: 17,
  },
  itemNameFlagged: { color: '#B71C1C' },
  itemRuleMessage: { fontSize: 11, color: '#C62828', lineHeight: 15 },
  itemGrams: { fontSize: 12, color: WellnessColors.textSecondary },
  itemMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 2,
  },
  itemKcal: { fontSize: 14, fontWeight: '700', color: WellnessColors.textPrimary },
  itemMacros: { fontSize: 11, color: WellnessColors.textSecondary, flexShrink: 1 },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: WellnessColors.accentBlue + '40',
    backgroundColor: WellnessColors.iconTintBlue,
  },
  totalValue: { fontSize: 13, fontWeight: '700', color: WellnessColors.accentBlue },
  suggestionBox: {
    backgroundColor: WellnessColors.noticeSoftBg,
    borderWidth: 1,
    borderColor: WellnessColors.noticeSoftBorder,
    borderRadius: 12,
    padding: 12,
  },
  suggestionText: { fontSize: 13, color: '#5D4037', lineHeight: 18 },

  intentRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  useMealBtn: {
    flex: 1,
    backgroundColor: WellnessColors.accentGreen,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  useMealBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  addBtn: {
    flex: 1,
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  removeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.accentRed + '60',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeBtnText: { color: WellnessColors.accentRed, fontSize: 14, fontWeight: '700' },
  removeHint: { fontSize: 11, color: WellnessColors.textSecondary, fontStyle: 'italic' },

  previewSection: { gap: 10 },
  previewModeLabel: { fontSize: 13, color: WellnessColors.textSecondary },
  previewColumns: { gap: 16 },
  previewCol: { gap: 6 },
  previewColTitle: { fontSize: 12, fontWeight: '600', color: WellnessColors.textSecondary },
  deltaBox: {
    backgroundColor: WellnessColors.iconTintBlue,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deltaLabel: { fontSize: 13, fontWeight: '600', color: WellnessColors.textPrimary },
  deltaValue: { fontSize: 13, fontWeight: '700', color: WellnessColors.accentBlue },
  previewActions: { flexDirection: 'row', gap: 10 },
  cancelPreviewBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  cancelPreviewBtnText: { fontSize: 14, fontWeight: '600', color: WellnessColors.textSecondary },
  approveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: WellnessColors.accentGreen,
    alignItems: 'center',
  },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  addPhotoRow: { gap: 6 },
  addPhotoLabel: { fontSize: 12, color: WellnessColors.textSecondary },
  afterPhotoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: WellnessColors.progressTrack,
  },
  afterPhotoBtnText: { fontSize: 13, fontWeight: '600', color: WellnessColors.textPrimary },

  chatRow: { flexDirection: 'row', gap: 8 },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: WellnessColors.surface,
    color: WellnessColors.textPrimary,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  timeLabel: { fontSize: 13, color: WellnessColors.textSecondary },
  timeValue: { fontSize: 13, fontWeight: '600', color: WellnessColors.textPrimary },
  timeEdit: { fontSize: 12, color: WellnessColors.accentBlue, marginLeft: 4 },

  errorText: { color: WellnessColors.accentRed, fontSize: 13, marginTop: 8, textAlign: 'center' },

  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: WellnessColors.textSecondary },
  deleteBtn: {
    width: 52,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 18 },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: WellnessColors.accentGreen,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

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
    backgroundColor: WellnessColors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 14,
    ...cardShadow,
  },
  issueModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B71C1C',
    textAlign: 'center',
  },
  issueModalBody: {
    fontSize: 14,
    lineHeight: 21,
    color: WellnessColors.textPrimary,
    textAlign: 'center',
  },
  issueModalActions: { gap: 10, marginTop: 4 },
  issueEditBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: WellnessColors.accentBlue,
    alignItems: 'center',
  },
  issueEditText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  issueSaveAnywayBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  issueSaveAnywayText: { fontSize: 14, fontWeight: '600', color: WellnessColors.textSecondary },
});
