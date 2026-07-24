/**
 * Section 5 — Daily food macro summary strip.
 * Shows today's logged meals with kcal totals and P/C/F bars.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getBurnCorrection, setBurnCorrection } from '../services/BurnCorrectionService';
import { getDailyMacros, foodLogDayKey, exportFoodLog, importFoodLog, type DailyMacros, type FoodEntry } from '../services/FoodLogService';
import {
  addWaterMl,
  DEFAULT_WATER_GOAL_ML,
  deleteWaterEntry,
  getWaterEntries,
  getWaterGoalMl,
  getWaterMl,
  setWaterGoalMl,
  setWaterMl,
  updateWaterEntry,
  type WaterEntry,
} from '../services/WaterPersistenceService';
import { WellnessColors, cardShadow, dashCardGap } from '../theme/wellness';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { StripIcons } from '../theme/icons';
import type { DailyMacroTarget } from '../services/TargetService';
import { getMacroTargetForDay, resolveFiberTarget_g, resolveNetCarbTarget_g } from '../services/TargetService';
import { deriveNetCarb_g } from '../logic/macroFiberCoupling';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';
import { DEFAULT_UNITS_PREFS } from '../services/UnitsPreferenceService';
import type { UserLanguage } from '../services/TargetService';
import { DEFAULT_LANGUAGE } from '../services/TargetService';
import { formatFoodLogDayLabel } from '../i18n/dateLocale';
import { getFoodLogUiCopy, type FoodLogUiCopy } from '../i18n/foodLogUiCopy';
import {
  displayToKcal,
  displayToMl,
  energyUnitLabel,
  formatEnergy,
  formatWaterMl,
  kcalToDisplay,
  mlToDisplay,
  parseLocaleNumber,
  waterUnitLabel,
} from '../logic/unitConvert';

/** Food Log strip header — coach/meals language. */
const FOOD_LOG_TITLE: Record<string, string> = {
  en: 'FOOD LOG',
  he: 'יומן ארוחות',
  es: 'DIARIO DE COMIDAS',
  fr: 'JOURNAL DES REPAS',
  de: 'ESSENSTAGEBUCH',
  ar: 'سجل الوجبات',
  ru: 'ДНЕВНИК ПИТАНИЯ',
  pt: 'DIÁRIO ALIMENTAR',
  it: 'DIARIO PASTI',
  tr: 'YEMEK GÜNLÜĞÜ',
};

function foodLogTitle(lang: UserLanguage | null | undefined): string {
  const code = lang?.code ?? 'en';
  return FOOD_LOG_TITLE[code] ?? FOOD_LOG_TITLE.en;
}

/** Persist Food Log expand so it matches glucose / trend chart prefs. */
const FOOD_LOG_EXPANDED_KEY = 'dash_food_log_expanded';

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Shift by calendar days (not fixed 24h — avoids DST / grayed › bugs). */
function addLocalDays(ms: number, delta: number): number {
  const d = new Date(startOfLocalDay(ms));
  d.setDate(d.getDate() + delta);
  return d.getTime();
}

function formatDayLabel(ms: number, langCode?: string | null): string {
  return formatFoodLogDayLabel(ms, langCode, {
    todayDayKey: foodLogDayKey(Date.now()),
    dayKey: foodLogDayKey(ms),
  });
}

type Props = {
  /** Initial day key — defaults to today. */
  dayKey?: string;
  /** Called with the day key currently shown in the date navigator. */
  onAddMeal: (dayKey: string) => void;
  onEditMeal?: (entry: FoodEntry) => void;
  /** Refresh counter — increment to trigger a reload. */
  refreshKey?: number;
  /** Total burn per day key (BMR + activity). Balance shown for any day present in this map. */
  burnKcalByDay?: Record<string, number>;
  /** Split burn for display: BMR line + activity line (edit applies to activity). */
  burnPartsByDay?: Record<string, { bmr: number; activity: number }>;
  /** Called after a successful import so the parent can refresh state. */
  onImported?: () => void;
  /** Daily macro targets — when set, bars show actual vs target. */
  macroTarget?: DailyMacroTarget | null;
  /** Display units (water / energy). Values still stored as ml / kcal. */
  unitsPrefs?: UnitsPrefs;
  /** Coach & meals language — Food Log title. */
  lang?: UserLanguage | null;
};

/** Parent awaits `reload()` after meal save so chips match AsyncStorage before the editor closes. */
export type FoodMacroStripHandle = {
  reload: () => Promise<void>;
};

const COLOR_PROTEIN = '#42A5F5';
const COLOR_CARB    = '#FF9800';
const COLOR_FAT     = '#EF5350';
const COLOR_FIBER   = '#66BB6A';
/** Net carbs (C − Fi) — between carb orange and fiber green. */
const COLOR_NET_CARB = '#FB8C00';
const COLOR_WATER   = '#29B6F6';

const WATER_HALF_ML = 100;
const WATER_FULL_ML = 200;
const WATER_BIG_ML = 250;

type WaterGlassVariant = 'half' | 'full' | 'big';

function WaterGlassIcon({ variant }: { variant: WaterGlassVariant }) {
  const spec =
    variant === 'half'
      ? { w: 22, h: 28, fill: 0.4 }
      : variant === 'full'
        ? { w: 26, h: 34, fill: 0.72 }
        : { w: 30, h: 40, fill: 0.88 };
  const innerH = Math.round(spec.h * 0.84);
  const fillH = Math.max(4, Math.round(innerH * spec.fill));
  return (
    <View style={glassIconStyles.wrap}>
      <View
        style={[
          glassIconStyles.glass,
          { width: spec.w, height: innerH },
        ]}
      >
        <View style={[glassIconStyles.fill, { height: fillH }]} />
      </View>
    </View>
  );
}

const glassIconStyles = StyleSheet.create({
  wrap: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  glass: {
    borderWidth: 2,
    borderColor: '#0288D1',
    borderRadius: 3,
    borderTopWidth: 1.5,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(41, 182, 246, 0.1)',
  },
  fill: {
    width: '100%',
    backgroundColor: COLOR_WATER,
  },
});

type WaterQuickTileProps = {
  variant: WaterGlassVariant;
  ml: number;
  label: string;
  onPress: () => void;
  waterUnit?: 'ml' | 'floz';
};

function WaterQuickTile({ variant, ml, label, onPress, waterUnit = 'ml' }: WaterQuickTileProps) {
  return (
    <Pressable
      style={({ pressed }) => [waterTileStyles.tile, pressed && waterTileStyles.tilePressed]}
      onPress={onPress}
      accessibilityLabel={`Add ${formatWaterMl(ml, waterUnit)}, ${label}`}
    >
      <WaterGlassIcon variant={variant} />
      <Text style={waterTileStyles.ml}>{formatWaterMl(ml, waterUnit)}</Text>
      <Text style={waterTileStyles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const waterTileStyles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(41, 182, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(41, 182, 246, 0.28)',
  },
  tilePressed: {
    opacity: 0.75,
    backgroundColor: 'rgba(41, 182, 246, 0.18)',
  },
  ml: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0277BD',
    fontVariant: ['tabular-nums'],
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    textAlign: 'center',
  },
});

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function mealLabel(entry: FoodEntry, copy: FoodLogUiCopy): string {
  if (entry.note) return entry.note;
  const h = new Date(entry.timestamp).getHours();
  if (h < 10) return copy.breakfast;
  if (h < 14) return copy.lunch;
  if (h < 17) return copy.snack;
  return copy.dinner;
}

type MacroBarProps = {
  label: string;
  value: number;
  target: number;
  color: string;
  showTarget?: boolean;
  /** Default grams (`g`). Energy/water pass already-converted display values. */
  unit?: 'g' | 'kcal' | 'kj' | 'ml' | 'floz';
  onPress?: () => void;
};

function MacroBar({ label, value, target, color, showTarget, unit = 'g', onPress }: MacroBarProps) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  const over = value > target * 1.05;
  const suffix =
    unit === 'g' ? 'g' : unit === 'ml' ? 'ml' : unit === 'floz' ? 'fl oz' : unit === 'kj' ? '' : '';
  const valueText = showTarget
    ? unit === 'kcal' || unit === 'kj'
      ? `${Math.round(value)}/${Math.round(target)}${unit === 'kj' ? '' : ''}`
      : unit === 'floz'
        ? `${value.toFixed(1)}/${target.toFixed(1)}${suffix}`
        : `${Math.round(value)}/${Math.round(target)}${suffix}`
    : unit === 'kcal'
      ? `${Math.round(value)} kcal`
      : unit === 'kj'
        ? `${Math.round(value)} kJ`
        : unit === 'floz'
          ? `${value.toFixed(1)}${suffix}`
          : `${Math.round(value)}${suffix}`;
  const row = (
    <View style={barStyles.row}>
      <Text style={barStyles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${ratio * 100}%`, backgroundColor: over ? '#EF5350' : color }]} />
      </View>
      <Text
        style={[barStyles.value, showTarget && barStyles.valueTarget, over && barStyles.valueOver]}
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

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, width: '100%' },
  rowPressable: { alignSelf: 'stretch' },
  label: { width: 40, fontSize: 11, fontWeight: '700', color: WellnessColors.textSecondary },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: WellnessColors.progressTrack,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  value: {
    width: 44,
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  valueTarget: { width: 98 },
  valueOver: { color: '#EF5350' },
});

// ─── Main component ───────────────────────────────────────────────────────────

export const FoodMacroStrip = forwardRef<FoodMacroStripHandle, Props>(function FoodMacroStrip(
  {
    dayKey: initialDayKey,
    onAddMeal,
    onEditMeal,
    refreshKey,
    burnKcalByDay,
    burnPartsByDay,
    onImported,
    macroTarget,
    unitsPrefs = DEFAULT_UNITS_PREFS,
    lang = DEFAULT_LANGUAGE,
  },
  ref,
) {
  const [expanded, setExpanded] = useState(true);
  const [expandPrefsLoaded, setExpandPrefsLoaded] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(FOOD_LOG_EXPANDED_KEY).then((v) => {
      if (v === 'false') setExpanded(false);
      if (v === 'true') setExpanded(true);
      setExpandPrefsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!expandPrefsLoaded) return;
    void AsyncStorage.setItem(FOOD_LOG_EXPANDED_KEY, expanded ? 'true' : 'false');
  }, [expanded, expandPrefsLoaded]);

  const ui = useMemo(() => getFoodLogUiCopy(lang?.code), [lang?.code]);
  const title = foodLogTitle(lang);
  const titleRtl = lang?.code === 'he' || lang?.code === 'ar';
  const balanceNoSign = titleRtl;
  const [selectedMs, setSelectedMs] = useState(() => startOfLocalDay(Date.now()));
  const [macros, setMacros] = useState<DailyMacros | null>(null);
  const [dayMacroTarget, setDayMacroTarget] = useState<DailyMacroTarget | null>(macroTarget ?? null);
  const [burnCorrection, setBurnCorrectionState] = useState(0);
  const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
  const [correctionInput, setCorrectionInput] = useState('');
  const [waterMl, setWaterMlState] = useState(0);
  const [waterGoalMl, setWaterGoalMlState] = useState(DEFAULT_WATER_GOAL_ML);
  const [waterModalVisible, setWaterModalVisible] = useState(false);
  const [waterModalMode, setWaterModalMode] = useState<'intake' | 'goal'>('intake');
  const [waterInput, setWaterInput] = useState('');
  const [waterSheetVisible, setWaterSheetVisible] = useState(false);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [waterEntryEdit, setWaterEntryEdit] = useState<WaterEntry | null>(null);

  const handleExport = useCallback(async () => {
    try {
      await exportFoodLog();
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? String(e));
    }
  }, []);

  const handleImport = useCallback(async () => {
    try {
      const count = await importFoodLog();
      if (count === 0) {
        Alert.alert('Import', 'No new meals found in the file.');
      } else {
        Alert.alert('Import complete', `${count} meal${count === 1 ? '' : 's'} imported.`);
        onImported?.();
      }
    } catch (e: any) {
      Alert.alert('Import failed', e?.message ?? String(e));
    }
  }, [onImported]);

  const activeDayKey = foodLogDayKey(selectedMs);
  const todayKey = foodLogDayKey(Date.now());
  const isToday = activeDayKey === todayKey;
  const displayTarget = dayMacroTarget ?? macroTarget ?? null;

  const reloadWater = useCallback(async () => {
    const [total, entries] = await Promise.all([
      getWaterMl(activeDayKey),
      getWaterEntries(activeDayKey),
    ]);
    setWaterMlState(total);
    setWaterEntries(entries);
  }, [activeDayKey]);

  const shiftDay = useCallback((delta: number) => {
    setSelectedMs((prev) => {
      const next = addLocalDays(prev, delta);
      const todayStart = startOfLocalDay(Date.now());
      return next > todayStart ? todayStart : next;
    });
  }, []);

  const load = useCallback(async () => {
    const [data, correction, dayTarget, dayWater, entries, goal] = await Promise.all([
      getDailyMacros(activeDayKey),
      getBurnCorrection(activeDayKey),
      getMacroTargetForDay(activeDayKey),
      getWaterMl(activeDayKey),
      getWaterEntries(activeDayKey),
      getWaterGoalMl(),
    ]);
    setMacros(data);
    setBurnCorrectionState(correction);
    setDayMacroTarget(dayTarget ?? macroTarget ?? null);
    setWaterMlState(dayWater);
    setWaterEntries(entries);
    setWaterGoalMlState(goal);
  }, [activeDayKey, macroTarget]);

  useImperativeHandle(ref, () => ({ reload: load }), [load]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleSaveCorrection = useCallback(async () => {
    const delta = parseLocaleNumber(correctionInput);
    const value = delta != null ? Math.round(displayToKcal(delta, unitsPrefs.energy)) : 0;
    await setBurnCorrection(activeDayKey, value);
    setBurnCorrectionState(value);
    setCorrectionModalVisible(false);
  }, [correctionInput, activeDayKey, unitsPrefs.energy]);

  const openWaterSheet = useCallback(() => {
    setWaterEntryEdit(null);
    setWaterSheetVisible(true);
  }, []);

  const openWaterIntakeModal = useCallback(() => {
    setWaterModalMode('intake');
    const raw = waterEntryEdit ? waterEntryEdit.ml : waterMl;
    const shown =
      waterEntryEdit || waterMl > 0
        ? unitsPrefs.water === 'floz'
          ? mlToDisplay(raw, 'floz').toFixed(1)
          : String(Math.round(raw))
        : '';
    setWaterInput(shown);
    setWaterModalVisible(true);
  }, [waterMl, waterEntryEdit, unitsPrefs.water]);

  const openWaterGoalModal = useCallback(() => {
    setWaterModalMode('goal');
    setWaterInput(
      unitsPrefs.water === 'floz'
        ? mlToDisplay(waterGoalMl, 'floz').toFixed(1)
        : String(Math.round(waterGoalMl)),
    );
    setWaterModalVisible(true);
  }, [waterGoalMl, unitsPrefs.water]);

  const closeWaterSheet = useCallback(() => {
    setWaterSheetVisible(false);
    setWaterEntryEdit(null);
  }, []);

  const handleGlassPress = useCallback(
    async (ml: number, label: string) => {
      if (waterEntryEdit) {
        await updateWaterEntry(activeDayKey, waterEntryEdit.id, ml, label);
      } else {
        await addWaterMl(activeDayKey, ml, label);
      }
      await reloadWater();
      closeWaterSheet();
    },
    [waterEntryEdit, activeDayKey, reloadWater, closeWaterSheet],
  );

  const handleSaveWaterModal = useCallback(async () => {
    const n = parseFloat(waterInput.replace(/,/g, '.').replace(/\s/g, ''));
    const typed = isNaN(n) ? 0 : n;
    const value = Math.round(displayToMl(typed, unitsPrefs.water));
    if (waterModalMode === 'goal') {
      const goal = value > 0 ? value : DEFAULT_WATER_GOAL_ML;
      await setWaterGoalMl(goal);
      setWaterGoalMlState(goal);
    } else if (waterEntryEdit) {
      await updateWaterEntry(activeDayKey, waterEntryEdit.id, value, waterEntryEdit.label);
      await reloadWater();
      setWaterEntryEdit(null);
    } else {
      await setWaterMl(activeDayKey, value);
      await reloadWater();
    }
    setWaterModalVisible(false);
  }, [waterInput, waterModalMode, activeDayKey, reloadWater, waterEntryEdit, unitsPrefs.water]);

  const handleClearWaterDay = useCallback(async () => {
    if (waterEntryEdit) {
      await deleteWaterEntry(activeDayKey, waterEntryEdit.id);
      setWaterEntryEdit(null);
    } else {
      await setWaterMl(activeDayKey, 0);
    }
    await reloadWater();
    setWaterModalVisible(false);
  }, [activeDayKey, reloadWater, waterEntryEdit]);

  const openWaterEntryEdit = useCallback((entry: WaterEntry) => {
    setWaterEntryEdit(entry);
    setWaterSheetVisible(true);
  }, []);

  const handleDeleteWaterEntry = useCallback(() => {
    if (!waterEntryEdit) return;
    Alert.alert(ui.deleteWaterTitle, ui.deleteWaterMessage, [
      { text: ui.cancel, style: 'cancel' },
      {
        text: ui.deleteItem,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteWaterEntry(activeDayKey, waterEntryEdit.id);
            await reloadWater();
            closeWaterSheet();
          })();
        },
      },
    ]);
  }, [waterEntryEdit, activeDayKey, reloadWater, closeWaterSheet, ui]);

  const dayLogItems = useMemo(() => {
    type Item =
      | { kind: 'meal'; entry: FoodEntry; timestamp: number }
      | { kind: 'water'; entry: WaterEntry; timestamp: number };
    const items: Item[] = [];
    for (const entry of macros?.entries ?? []) {
      items.push({ kind: 'meal', entry, timestamp: entry.timestamp });
    }
    for (const entry of waterEntries) {
      items.push({ kind: 'water', entry, timestamp: entry.timestamp });
    }
    items.sort((a, b) => a.timestamp - b.timestamp);
    return items;
  }, [macros?.entries, waterEntries]);

  const isEmpty = !macros || macros.entries.length === 0;
  // When macro targets are set, bar max = target value; otherwise rolling max of actuals
  const fiberTarget = displayTarget ? resolveFiberTarget_g(displayTarget) : null;
  const netCarbEaten = macros ? deriveNetCarb_g(macros.carb_g, macros.fiber_g) : 0;
  const netCarbTarget = displayTarget ? resolveNetCarbTarget_g(displayTarget) : null;
  const maxMacro = displayTarget
    ? Math.max(
        displayTarget.protein_g,
        displayTarget.carb_g,
        displayTarget.fat_g,
        fiberTarget ?? 0,
        netCarbTarget ?? 0,
        1,
      )
    : macros
      ? Math.max(macros.protein_g, macros.carb_g, macros.fat_g, macros.fiber_g, netCarbEaten, 1)
      : 1;
  const fiberBarTarget = fiberTarget ?? maxMacro;
  const netCarbBarTarget = netCarbTarget ?? maxMacro;

  const rawBurn = burnKcalByDay?.[activeDayKey] ?? null;
  const burnParts = burnPartsByDay?.[activeDayKey] ?? null;
  const burn    = rawBurn != null ? rawBurn + burnCorrection : null;
  const activityShown =
    burnParts != null ? Math.max(0, Math.round(burnParts.activity + burnCorrection)) : null;
  const eaten   = macros ? Math.round(macros.kcal) : 0;
  const balance = burn != null && eaten > 0 ? eaten - burn : null;
  const isDeficit = balance != null && balance < 0;
  const energyU = unitsPrefs.energy;
  const waterU = unitsPrefs.water;
  const eLab = energyUnitLabel(energyU);
  const disp = (kcal: number) => Math.round(kcalToDisplay(kcal, energyU));
  const waterBarUnit = waterU === 'floz' ? 'floz' : 'ml';
  const energyBarUnit = energyU === 'kj' ? 'kj' : 'kcal';
  const energyBarLabel = energyU === 'kj' ? 'kJ' : 'kcal';

  const collapsedSub =
    !expanded ? (
      <>
        {formatDayLabel(selectedMs, lang?.code)}
        {balance != null ? (
          <Text style={{ color: isDeficit ? '#2E7D32' : '#C62828' }}>
            {` · ${balanceNoSign ? '' : isDeficit ? '−' : '+'}${disp(Math.abs(balance)).toLocaleString()} ${eLab}`}
          </Text>
        ) : null}
      </>
    ) : null;

  return (
    <View style={[styles.card, !expanded && styles.cardCollapsed, cardShadow]}>
      <DashboardCollapseHeader
        title={title}
        subtitle={collapsedSub}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        titleRtl={titleRtl}
        collapseLabel={`Collapse ${title}`}
        expandLabel={`Expand ${title}`}
        icon={StripIcons.foodLog}
      />

      {expanded ? (
      <>
      {/* Date navigator — centred below title */}
      <View style={styles.dateNavRow}>
        <Pressable style={styles.dateNavBtn} onPress={() => shiftDay(-1)} hitSlop={8} accessibilityLabel="Previous day">
          <Text style={styles.dateNavArrow}>‹</Text>
        </Pressable>
        <Text style={styles.dateLabel}>{formatDayLabel(selectedMs, lang?.code)}</Text>
        <Pressable
          style={[styles.dateNavBtn, isToday && styles.dateNavBtnDisabled]}
          onPress={() => {
            if (!isToday) shiftDay(1);
          }}
          disabled={isToday}
          hitSlop={8}
          accessibilityLabel="Next day"
        >
          <Text style={[styles.dateNavArrow, isToday && styles.dateNavArrowDisabled]}>›</Text>
        </Pressable>
      </View>

      {/* Energy lines — always shown, columns aligned */}
      <View style={styles.energyLines}>
        <View style={styles.energyRow}>
          <Text style={styles.energyNum} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {eaten > 0 ? disp(eaten).toLocaleString() : '—'}
          </Text>
          <Text style={styles.energyLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {eLab} {ui.eaten}
          </Text>
        </View>
        {burnParts != null && burn != null ? (
          <>
            <Pressable
              style={styles.energyRow}
              onPress={() => {
                setCorrectionInput(
                  burnCorrection !== 0
                    ? String(Math.round(kcalToDisplay(burnCorrection, energyU)))
                    : '',
                );
                setCorrectionModalVisible(true);
              }}
              hitSlop={8}
              accessibilityLabel={`${activityShown} ${eLab} ${ui.activity}, tap to adjust`}
            >
              <Text style={styles.energyNum} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {disp(activityShown ?? 0).toLocaleString()}
              </Text>
              <Text style={styles.energyLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {`${eLab} ${ui.activity}`}
                {burnCorrection !== 0 ? (
                  <Text style={styles.energyCorrection}>{` (${burnCorrection > 0 ? '+' : ''}${disp(burnCorrection)})`}</Text>
                ) : null}
              </Text>
              <Text style={styles.adjustBtn}>✎</Text>
            </Pressable>
            <View style={styles.energyBurnBlock}>
              <View style={styles.energyBurnRow}>
                <Text style={[styles.energyNum, styles.energyNumBurn]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {disp(Math.round(burn)).toLocaleString()}
                </Text>
                <View style={styles.energyBurnTextCol}>
                  <Text style={styles.energyLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {eLab} {ui.burned}
                  </Text>
                  <Text style={styles.energyBurnFormula} numberOfLines={1} maxFontSizeMultiplier={1.15}>
                    {`BMR ${disp(burnParts.bmr).toLocaleString()} + ${ui.activity}`}
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : burn != null ? (
          <Pressable
            style={styles.energyRow}
            onPress={() => {
              setCorrectionInput(
                burnCorrection !== 0
                  ? String(Math.round(kcalToDisplay(burnCorrection, energyU)))
                  : '',
              );
              setCorrectionModalVisible(true);
            }}
            hitSlop={8}
          >
            <Text style={styles.energyNum} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {disp(Math.round(burn)).toLocaleString()}
            </Text>
            <Text style={styles.energyLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {`${eLab} ${ui.burned}`}
              {burnCorrection !== 0 ? (
                <Text style={styles.energyCorrection}>{` (${burnCorrection > 0 ? '+' : ''}${disp(burnCorrection)})`}</Text>
              ) : null}
            </Text>
            <Text style={styles.adjustBtn}>✎</Text>
          </Pressable>
        ) : null}
        {balance != null ? (
          <View style={[styles.energyRow, styles.balanceRow, isDeficit ? styles.balanceDeficitBg : styles.balanceSurplusBg]}>
            <Text
              style={[styles.energyNum, { color: isDeficit ? '#2E7D32' : '#C62828' }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              {disp(Math.abs(balance)).toLocaleString()}
            </Text>
            <Text
              style={[styles.energyLabel, { color: isDeficit ? '#2E7D32' : '#C62828' }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              {eLab} {isDeficit ? ui.deficit : ui.surplus}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Macro bars — meals/targets + always-on H2O */}
      <View style={[styles.barsWrap, { marginTop: 10 }]}>
        {(!isEmpty || displayTarget) ? (
          <>
            {displayTarget ? (
              <MacroBar
                label={energyBarLabel}
                value={kcalToDisplay(eaten, energyU)}
                target={kcalToDisplay(displayTarget.kcal, energyU)}
                color="#5C6BC0"
                showTarget
                unit={energyBarUnit}
              />
            ) : null}
            <MacroBar label="P" value={macros?.protein_g ?? 0} target={displayTarget ? displayTarget.protein_g : maxMacro} color={COLOR_PROTEIN} showTarget={!!displayTarget} />
            <MacroBar label="C" value={macros?.carb_g    ?? 0} target={displayTarget ? displayTarget.carb_g    : maxMacro} color={COLOR_CARB}    showTarget={!!displayTarget} />
            <MacroBar label="F" value={macros?.fat_g     ?? 0} target={displayTarget ? displayTarget.fat_g     : maxMacro} color={COLOR_FAT}     showTarget={!!displayTarget} />
            <MacroBar label="Fi" value={macros?.fiber_g ?? 0} target={fiberBarTarget} color={COLOR_FIBER} showTarget={!!displayTarget} />
            <MacroBar
              label="C-Fi"
              value={netCarbEaten}
              target={netCarbBarTarget}
              color={COLOR_NET_CARB}
              showTarget={!!displayTarget}
            />
          </>
        ) : null}
        <MacroBar
          label="H2O"
          value={mlToDisplay(waterMl, waterU)}
          target={mlToDisplay(waterGoalMl, waterU)}
          color={COLOR_WATER}
          showTarget
          unit={waterBarUnit}
          onPress={openWaterSheet}
        />
      </View>

      {/* Add meal | Add water */}
      <View style={styles.addActionsRow}>
        <Pressable
          style={({ pressed }) => [styles.addActionBtn, styles.addActionMeal, pressed && styles.addActionPressed]}
          onPress={() => onAddMeal(activeDayKey)}
          accessibilityLabel="Add meal"
        >
          <Text style={styles.addActionIcon} accessibilityElementsHidden>
            🍴
          </Text>
          <Text style={styles.addActionLabel}>{ui.meal}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.addActionBtn, styles.addActionWater, pressed && styles.addActionPressed]}
          onPress={openWaterSheet}
          accessibilityLabel={ui.addWater}
        >
          <Text style={styles.addActionIcon} accessibilityElementsHidden>
            💧
          </Text>
          <Text style={[styles.addActionLabel, styles.addActionLabelWater]}>{ui.addWater}</Text>
        </Pressable>
      </View>
      {/* Meal + water event chips (chronological) */}
      {dayLogItems.length > 0 ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {dayLogItems.map((item) =>
          item.kind === 'meal' ? (
            <Pressable
              key={`meal-${item.entry.id}`}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={() => onEditMeal?.(item.entry)}
            >
              <Text style={styles.chipTime}>{formatTime(item.entry.timestamp)}</Text>
              <Text style={styles.chipLabel}>{mealLabel(item.entry, ui)}</Text>
              <Text style={styles.chipKcal}>{formatEnergy(item.entry.totalKcal, energyU)}</Text>
              <Text style={styles.chipEdit}>✎ {ui.editItem}</Text>
            </Pressable>
          ) : (
            <Pressable
              key={`water-${item.entry.id}`}
              style={({ pressed }) => [styles.chip, styles.chipWater, pressed && styles.chipPressed]}
              onPress={() => openWaterEntryEdit(item.entry)}
            >
              <Text style={styles.chipTime}>{formatTime(item.entry.timestamp)}</Text>
              <Text style={styles.chipLabelWater}>{item.entry.label ?? ui.water}</Text>
              <Text style={styles.chipMl}>{formatWaterMl(item.entry.ml, waterU)}</Text>
              <Text style={styles.chipEditWater}>✎ {ui.editItem}</Text>
            </Pressable>
          ),
        )}
      </ScrollView>
      ) : null}

      {/* Footer — export / import */}
      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={handleExport} accessibilityLabel="Export food log">
          <Text style={styles.footerBtnText}>⬆ Export</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={handleImport} accessibilityLabel="Import food log">
          <Text style={styles.footerBtnText}>⬇ Import</Text>
        </Pressable>
      </View>
      </>
      ) : null}

      {/* Burn correction modal */}
      <Modal visible={correctionModalVisible} transparent animationType="fade" onRequestClose={() => setCorrectionModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCorrectionModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Adjust activity {eLab}</Text>
            <Text style={styles.modalSub}>
              Enter a correction (e.g. <Text style={styles.modalCode}>-{Math.round(kcalToDisplay(188, energyU))}</Text> to
              reduce activity by {formatEnergy(188, energyU)}).
              {'\n'}
              Recorded activity:{' '}
              <Text style={styles.modalBold}>
                {burnParts != null
                  ? formatEnergy(burnParts.activity, energyU)
                  : '—'}
              </Text>
              {burnParts != null ? (
                <>
                  {' · '}BMR <Text style={styles.modalBold}>{formatEnergy(burnParts.bmr, energyU)}</Text>
                </>
              ) : null}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={correctionInput}
              onChangeText={setCorrectionInput}
              keyboardType="numbers-and-punctuation"
              placeholder={`-${Math.round(kcalToDisplay(188, energyU))}`}
              placeholderTextColor={WellnessColors.textSecondary}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              {burnCorrection !== 0 && (
                <Pressable style={styles.modalBtnClear} onPress={async () => { await setBurnCorrection(activeDayKey, 0); setBurnCorrectionState(0); setCorrectionModalVisible(false); }}>
                  <Text style={styles.modalBtnClearText}>Clear</Text>
                </Pressable>
              )}
              <Pressable style={styles.modalBtnCancel} onPress={() => setCorrectionModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalBtnSave} onPress={handleSaveCorrection}>
                <Text style={styles.modalBtnSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Water quick sheet */}
      <Modal visible={waterSheetVisible} transparent animationType="fade" onRequestClose={closeWaterSheet}>
        <Pressable style={styles.modalOverlay} onPress={closeWaterSheet}>
          <Pressable style={styles.waterSheetCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{waterEntryEdit ? ui.editWater : ui.addWater}</Text>
            <Text style={styles.modalSub}>
              {waterEntryEdit ? (
                <>
                  {formatTime(waterEntryEdit.timestamp)}
                  {' · '}
                  <Text style={styles.modalBold}>{formatWaterMl(waterEntryEdit.ml, waterU)}</Text>
                  {waterEntryEdit.label ? ` · ${waterEntryEdit.label}` : ''}
                </>
              ) : (
                <>
                  {ui.today}: <Text style={styles.modalBold}>{formatWaterMl(waterMl, waterU)}</Text>
                  {' · '}
                  {ui.goal} <Text style={styles.modalBold}>{formatWaterMl(waterGoalMl, waterU)}</Text>
                </>
              )}
            </Text>
            <View style={styles.waterGlassRow}>
              <WaterQuickTile
                variant="half"
                ml={WATER_HALF_ML}
                label={ui.halfGlass}
                waterUnit={waterU}
                onPress={() => void handleGlassPress(WATER_HALF_ML, ui.halfGlass)}
              />
              <WaterQuickTile
                variant="full"
                ml={WATER_FULL_ML}
                label={ui.fullGlass}
                waterUnit={waterU}
                onPress={() => void handleGlassPress(WATER_FULL_ML, ui.fullGlass)}
              />
              <WaterQuickTile
                variant="big"
                ml={WATER_BIG_ML}
                label={ui.bigGlass}
                waterUnit={waterU}
                onPress={() => void handleGlassPress(WATER_BIG_ML, ui.bigGlass)}
              />
            </View>
            <View style={styles.waterUtilityRow}>
              <Pressable
                style={({ pressed }) => [styles.waterUtilityBtn, pressed && styles.waterUtilityBtnPressed]}
                onPress={() => {
                  setWaterSheetVisible(false);
                  openWaterIntakeModal();
                }}
                accessibilityLabel={waterEntryEdit ? ui.setAmount : ui.setTotal}
              >
                <MaterialCommunityIcons name="numeric" size={20} color="#0288D1" />
                <Text style={styles.waterUtilityText}>{waterEntryEdit ? ui.setAmount : ui.setTotal}</Text>
              </Pressable>
              {!waterEntryEdit ? (
                <Pressable
                  style={({ pressed }) => [styles.waterUtilityBtn, pressed && styles.waterUtilityBtnPressed]}
                  onPress={() => {
                    setWaterSheetVisible(false);
                    openWaterGoalModal();
                  }}
                  accessibilityLabel={ui.editGoal}
                >
                  <MaterialCommunityIcons name="flag-checkered" size={20} color="#0288D1" />
                  <Text style={styles.waterUtilityText}>{ui.editGoal}</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.waterSheetFooter}>
              {waterEntryEdit ? (
                <Pressable
                  style={styles.waterDeleteBtn}
                  onPress={handleDeleteWaterEntry}
                  accessibilityLabel={ui.deleteItem}
                >
                  <Text style={styles.waterDeleteBtnText}>🗑</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.waterSheetCancelBtn, !waterEntryEdit && styles.waterSheetCancelBtnSolo]}
                onPress={closeWaterSheet}
              >
                <Text style={styles.waterSheetBtnCancelText}>{ui.cancel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Water intake / goal modal */}
      <Modal visible={waterModalVisible} transparent animationType="fade" onRequestClose={() => setWaterModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setWaterModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>
              {waterModalMode === 'goal'
                ? ui.waterGoal
                : waterEntryEdit
                  ? ui.waterAmount
                  : ui.waterIntake}
            </Text>
            <Text style={styles.modalSub}>
              {waterModalMode === 'goal' ? (
                <>
                  {ui.waterGoalHint(
                    waterUnitLabel(waterU),
                    formatWaterMl(DEFAULT_WATER_GOAL_ML, waterU),
                  )}
                </>
              ) : waterEntryEdit ? (
                <>
                  {ui.waterAmountHint(
                    waterUnitLabel(waterU),
                    formatTime(waterEntryEdit.timestamp),
                  )}
                </>
              ) : (
                <>
                  {ui.waterIntakeHint(waterUnitLabel(waterU))}{' '}
                  <Text style={styles.modalBold}>{formatWaterMl(waterGoalMl, waterU)}</Text>
                </>
              )}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={waterInput}
              onChangeText={setWaterInput}
              keyboardType="number-pad"
              placeholder={waterModalMode === 'goal' ? String(DEFAULT_WATER_GOAL_ML) : '0'}
              placeholderTextColor={WellnessColors.textSecondary}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              {waterModalMode === 'intake' && (waterEntryEdit || waterMl > 0) ? (
                <Pressable style={styles.modalBtnClear} onPress={() => void handleClearWaterDay()}>
                  <Text style={styles.modalBtnClearText}>{ui.clear}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.modalBtnCancel} onPress={() => setWaterModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>{ui.cancel}</Text>
              </Pressable>
              <Pressable style={styles.modalBtnSave} onPress={() => void handleSaveWaterModal()}>
                <Text style={styles.modalBtnSaveText}>{ui.saveItem}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    marginBottom: dashCardGap,
    borderWidth: 1.5,
    borderColor: WellnessColors.gridLine,
  },
  cardCollapsed: {
    paddingBottom: 12,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
    marginBottom: 10,
    direction: 'ltr',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: WellnessColors.gridLine,
  },
  footerBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: WellnessColors.progressTrack,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateNavBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: WellnessColors.progressTrack,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavBtnDisabled: {
    opacity: 0.3,
  },
  dateNavArrow: {
    fontSize: 20,
    lineHeight: 24,
    color: WellnessColors.textPrimary,
    fontWeight: '300',
  },
  dateNavArrowDisabled: {
    color: WellnessColors.textSecondary,
  },
  dateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    minWidth: 72,
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: WellnessColors.accentGreen,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  energyLines: {
    marginBottom: 6,
    gap: 3,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceRow: {
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  balanceDeficitBg: {
    backgroundColor: '#E8F5E9',
  },
  balanceSurplusBg: {
    backgroundColor: '#FFEBEE',
  },
  energyNum: {
    minWidth: 72,
    flexShrink: 0,
    fontSize: 17,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    marginRight: 8,
  },
  energyNumInline: {
    fontSize: 17,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  energyLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: WellnessColors.textSecondary,
    flexShrink: 1,
    flexGrow: 1,
  },
  energyTarget: {
    fontSize: 12,
    fontWeight: '400',
    color: WellnessColors.textSecondary,
  },
  energyCorrection: {
    fontSize: 13,
    fontWeight: '500',
    color: WellnessColors.textSecondary,
  },
  energyBurnBlock: {
    alignSelf: 'stretch',
  },
  energyBurnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  energyNumBurn: {
    marginTop: 1,
  },
  energyBurnTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  energyBurnFormula: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: WellnessColors.textSecondary,
    opacity: 0.9,
  },
  barsWrap: { marginBottom: 12 },
  addActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  addActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    // Solid (was dashed) — these are primary log actions, not empty "Add" placeholders.
    borderStyle: 'solid',
  },
  addActionMeal: {
    borderColor: 'rgba(76, 175, 80, 0.9)',
    backgroundColor: 'rgba(76, 175, 80, 0.10)',
  },
  addActionWater: {
    borderColor: 'rgba(41, 182, 246, 0.9)',
    backgroundColor: 'rgba(41, 182, 246, 0.12)',
  },
  addActionPressed: {
    opacity: 0.75,
  },
  addActionIcon: {
    fontSize: 20,
  },
  addActionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: WellnessColors.accentGreen,
  },
  addActionLabelWater: {
    color: '#0288D1',
  },
  waterSheetCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    width: '100%',
    maxWidth: 360,
  },
  waterGlassRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 12,
  },
  waterUtilityRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  waterUtilityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.background,
  },
  waterUtilityBtnPressed: {
    opacity: 0.75,
  },
  waterUtilityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0288D1',
  },
  waterSheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  waterDeleteBtn: {
    width: 52,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterDeleteBtnText: {
    fontSize: 18,
  },
  waterSheetCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  waterSheetCancelBtnSolo: {
    flex: 0,
    alignSelf: 'stretch',
  },
  waterSheetBtnCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: WellnessColors.textSecondary,
    textAlign: 'center',
  },
  chipsRow: {
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    backgroundColor: WellnessColors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    minWidth: 90,
  },
  chipPressed: {
    opacity: 0.7,
    borderColor: WellnessColors.accentBlue,
  },
  chipWater: {
    borderColor: 'rgba(41, 182, 246, 0.45)',
    backgroundColor: 'rgba(41, 182, 246, 0.08)',
  },
  chipEdit: {
    fontSize: 10,
    color: WellnessColors.accentBlue,
    marginTop: 2,
  },
  chipTime: {
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
  chipKcal: {
    fontSize: 11,
    color: WellnessColors.accentBlue,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chipLabelWater: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0277BD',
    marginTop: 1,
  },
  chipMl: {
    fontSize: 11,
    color: '#0288D1',
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  chipEditWater: {
    fontSize: 10,
    color: '#0288D1',
    marginTop: 2,
  },
  adjustBtn: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
    marginBottom: 14,
    lineHeight: 19,
  },
  modalCode: {
    fontFamily: 'monospace',
    color: WellnessColors.textPrimary,
  },
  modalBold: {
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 20,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  modalBtnClear: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#EF5350',
    alignItems: 'center',
  },
  modalBtnClearText: { fontSize: 14, color: '#EF5350', fontWeight: '600' },
  modalBtnCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: 14, color: WellnessColors.textSecondary },
  modalBtnSave: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: WellnessColors.accentGreen,
    alignItems: 'center',
  },
  modalBtnSaveText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
