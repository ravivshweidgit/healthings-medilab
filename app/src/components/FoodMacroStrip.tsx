/**
 * Section 5 — Daily food macro summary strip.
 * Shows today's logged meals with kcal totals and P/C/F bars.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getDailyMacros, foodLogDayKey, exportFoodLog, importFoodLog, type DailyMacros, type FoodEntry } from '../services/FoodLogService';
import { WellnessColors, cardShadow } from '../theme/wellness';

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDayLabel(ms: number): string {
  const todayMs = startOfLocalDay(Date.now());
  const dayMs   = startOfLocalDay(ms);
  const diff    = Math.round((todayMs - dayMs) / MS_DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

type Props = {
  /** Initial day key — defaults to today. */
  dayKey?: string;
  onAddMeal: () => void;
  onEditMeal?: (entry: FoodEntry) => void;
  /** Refresh counter — increment to trigger a reload. */
  refreshKey?: number;
  /** Total burn per day key (BMR + active). Balance shown for any day present in this map. */
  burnKcalByDay?: Record<string, number>;
  /** Called after a successful import so the parent can refresh state. */
  onImported?: () => void;
};

const COLOR_PROTEIN = '#42A5F5';
const COLOR_CARB    = '#FF9800';
const COLOR_FAT     = '#EF5350';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function mealLabel(entry: FoodEntry): string {
  if (entry.note) return entry.note;
  const h = new Date(entry.timestamp).getHours();
  if (h < 10) return 'Breakfast';
  if (h < 14) return 'Lunch';
  if (h < 17) return 'Snack';
  return 'Dinner';
}

type MacroBarProps = {
  label: string;
  value: number;
  total: number;
  color: string;
  unit: string;
};

function MacroBar({ label, value, total, color, unit }: MacroBarProps) {
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={barStyles.value}>{Math.round(value)}{unit}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  label: { width: 14, fontSize: 11, fontWeight: '700', color: WellnessColors.textSecondary },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: WellnessColors.progressTrack,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  value: {
    width: 40,
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function FoodMacroStrip({ dayKey: initialDayKey, onAddMeal, onEditMeal, refreshKey, burnKcalByDay, onImported }: Props) {
  const todayMs = useMemo(() => startOfLocalDay(Date.now()), []);
  const [selectedMs, setSelectedMs] = useState(() => startOfLocalDay(Date.now()));
  const [macros, setMacros] = useState<DailyMacros | null>(null);

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
  const isToday = selectedMs >= todayMs;

  const shiftDay = useCallback((delta: number) => {
    setSelectedMs((prev) => {
      const next = prev + delta * MS_DAY;
      return next > todayMs ? todayMs : next;
    });
  }, [todayMs]);

  const load = useCallback(async () => {
    const data = await getDailyMacros(activeDayKey);
    setMacros(data);
  }, [activeDayKey]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const isEmpty = !macros || macros.entries.length === 0;
  const maxMacro = macros ? Math.max(macros.protein_g, macros.carb_g, macros.fat_g, 1) : 1;

  const burn    = burnKcalByDay?.[activeDayKey] ?? null;
  const eaten   = macros ? Math.round(macros.kcal) : 0;
  const balance = burn != null && eaten > 0 ? burn - eaten : null;
  const isDeficit = balance != null && balance >= 0;

  return (
    <View style={[styles.card, cardShadow]}>
      {/* Header */}
      <Text style={styles.sectionTitle}>FOOD LOG</Text>

      {/* Date navigator — centred below title */}
      <View style={styles.dateNavRow}>
        <Pressable style={styles.dateNavBtn} onPress={() => shiftDay(-1)} hitSlop={8}>
          <Text style={styles.dateNavArrow}>‹</Text>
        </Pressable>
        <Text style={styles.dateLabel}>{formatDayLabel(selectedMs)}</Text>
        <Pressable
          style={[styles.dateNavBtn, isToday && styles.dateNavBtnDisabled]}
          onPress={() => shiftDay(1)}
          disabled={isToday}
          hitSlop={8}
        >
          <Text style={[styles.dateNavArrow, isToday && styles.dateNavArrowDisabled]}>›</Text>
        </Pressable>
      </View>

      {/* Energy lines — always shown, columns aligned */}
      <View style={styles.energyLines}>
        <View style={styles.energyRow}>
          <Text style={styles.energyNum}>{eaten > 0 ? eaten.toLocaleString() : '—'}</Text>
          <Text style={styles.energyLabel}>kcal eaten</Text>
        </View>
        {burn != null ? (
          <View style={styles.energyRow}>
            <Text style={styles.energyNum}>{burn.toLocaleString()}</Text>
            <Text style={styles.energyLabel}>kcal burned</Text>
          </View>
        ) : null}
        {balance != null ? (
          <View style={styles.energyRow}>
            <Text style={[styles.energyNum, { color: isDeficit ? '#2E7D32' : '#E65100' }]}>
              {Math.abs(balance).toLocaleString()}
            </Text>
            <Text style={[styles.energyLabel, { color: isDeficit ? '#2E7D32' : '#E65100' }]}>
              kcal {isDeficit ? 'deficit' : 'surplus'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Macro bars — only when meals exist */}
      {!isEmpty && (
        <View style={[styles.barsWrap, { marginTop: 10 }]}>
          <MacroBar label="P" value={macros!.protein_g} total={maxMacro} color={COLOR_PROTEIN} unit="g" />
          <MacroBar label="C" value={macros!.carb_g}    total={maxMacro} color={COLOR_CARB}    unit="g" />
          <MacroBar label="F" value={macros!.fat_g}     total={maxMacro} color={COLOR_FAT}     unit="g" />
        </View>
      )}

      {/* Meal chips + Add card */}
      {(!isEmpty || isToday) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {isToday && (
            <Pressable
              style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.chipPressed]}
              onPress={onAddMeal}
              accessibilityLabel="Add meal"
            >
              <Text style={styles.addChipIcon}>＋</Text>
              <Text style={styles.addChipLabel}>Add meal</Text>
            </Pressable>
          )}
          {macros?.entries.map((entry) => (
            <Pressable
              key={entry.id}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              onPress={() => onEditMeal?.(entry)}
            >
              <Text style={styles.chipTime}>{formatTime(entry.timestamp)}</Text>
              <Text style={styles.chipLabel}>{mealLabel(entry)}</Text>
              <Text style={styles.chipKcal}>{Math.round(entry.totalKcal)} kcal</Text>
              <Text style={styles.chipEdit}>✎ edit</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Footer — export / import */}
      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={handleExport} accessibilityLabel="Export food log">
          <Text style={styles.footerBtnText}>⬆ Export</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={handleImport} accessibilityLabel="Import food log">
          <Text style={styles.footerBtnText}>⬇ Import</Text>
        </Pressable>
      </View>
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
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
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
  addChip: {
    borderStyle: 'dashed',
    borderColor: WellnessColors.accentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    paddingVertical: 10,
  },
  addChipIcon: {
    fontSize: 22,
    color: WellnessColors.accentGreen,
    fontWeight: '300',
    lineHeight: 26,
  },
  addChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.accentGreen,
    marginTop: 2,
  },
  energyLines: {
    marginBottom: 6,
    gap: 3,
  },
  energyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  energyNum: {
    width: 56,
    fontSize: 17,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
    marginRight: 8,
  },
  energyLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: WellnessColors.textSecondary,
  },
  barsWrap: { marginBottom: 12 },
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
});
