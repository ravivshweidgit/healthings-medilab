/**
 * Section 5 — Daily food macro summary strip.
 * Shows today's logged meals with kcal totals and P/C/F bars.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getBurnCorrection, setBurnCorrection } from '../services/BurnCorrectionService';
import { getDailyMacros, foodLogDayKey, exportFoodLog, importFoodLog, type DailyMacros, type FoodEntry } from '../services/FoodLogService';
import { WellnessColors, cardShadow } from '../theme/wellness';

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDatePart(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDayLabel(ms: number): string {
  const todayMs = startOfLocalDay(Date.now());
  const dayMs   = startOfLocalDay(ms);
  const diff    = Math.round((todayMs - dayMs) / MS_DAY);
  const datePart = formatDatePart(ms);
  if (diff === 0) return `Today - ${datePart}`;
  return datePart;
}

import type { DailyMacroTarget } from '../services/TargetService';
import { resolveFiberTarget_g } from '../services/TargetService';

type Props = {
  /** Initial day key — defaults to today. */
  dayKey?: string;
  /** Called with the day key currently shown in the date navigator. */
  onAddMeal: (dayKey: string) => void;
  onEditMeal?: (entry: FoodEntry) => void;
  /** Refresh counter — increment to trigger a reload. */
  refreshKey?: number;
  /** Total burn per day key (BMR + active). Balance shown for any day present in this map. */
  burnKcalByDay?: Record<string, number>;
  /** Called after a successful import so the parent can refresh state. */
  onImported?: () => void;
  /** Daily macro targets — when set, bars show actual vs target. */
  macroTarget?: DailyMacroTarget | null;
};

const COLOR_PROTEIN = '#42A5F5';
const COLOR_CARB    = '#FF9800';
const COLOR_FAT     = '#EF5350';
const COLOR_FIBER   = '#66BB6A';

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
  target: number;
  color: string;
  showTarget?: boolean;
};

function MacroBar({ label, value, target, color, showTarget }: MacroBarProps) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  const over = value > target * 1.05;
  const valueText = showTarget
    ? `${Math.round(value)}/${Math.round(target)}g`
    : `${Math.round(value)}g`;
  return (
    <View style={barStyles.row}>
      <Text style={barStyles.label}>{label}</Text>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${ratio * 100}%`, backgroundColor: over ? '#EF5350' : color }]} />
      </View>
      <Text style={[barStyles.value, showTarget && barStyles.valueWide, over && barStyles.valueOver]}>
        {valueText}
      </Text>
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
  valueWide: { width: 80 },
  valueOver: { color: '#EF5350' },
});

// ─── Main component ───────────────────────────────────────────────────────────

export function FoodMacroStrip({ dayKey: initialDayKey, onAddMeal, onEditMeal, refreshKey, burnKcalByDay, onImported, macroTarget }: Props) {
  const todayMs = useMemo(() => startOfLocalDay(Date.now()), []);
  const [selectedMs, setSelectedMs] = useState(() => startOfLocalDay(Date.now()));
  const [macros, setMacros] = useState<DailyMacros | null>(null);
  const [burnCorrection, setBurnCorrectionState] = useState(0);
  const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
  const [correctionInput, setCorrectionInput] = useState('');

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
    const [data, correction] = await Promise.all([
      getDailyMacros(activeDayKey),
      getBurnCorrection(activeDayKey),
    ]);
    setMacros(data);
    setBurnCorrectionState(correction);
  }, [activeDayKey]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleSaveCorrection = useCallback(async () => {
    const delta = parseInt(correctionInput.replace(/\s/g, ''), 10);
    const value = isNaN(delta) ? 0 : delta;
    await setBurnCorrection(activeDayKey, value);
    setBurnCorrectionState(value);
    setCorrectionModalVisible(false);
  }, [correctionInput, activeDayKey]);

  const isEmpty = !macros || macros.entries.length === 0;
  // When macro targets are set, bar max = target value; otherwise rolling max of actuals
  const maxMacro = macroTarget
    ? Math.max(macroTarget.protein_g, macroTarget.carb_g, macroTarget.fat_g, resolveFiberTarget_g(macroTarget), 1)
    : macros ? Math.max(macros.protein_g, macros.carb_g, macros.fat_g, macros.fiber_g, 1) : 1;
  const fiberTarget = macroTarget ? resolveFiberTarget_g(macroTarget) : maxMacro;

  const rawBurn = burnKcalByDay?.[activeDayKey] ?? null;
  const burn    = rawBurn != null ? rawBurn + burnCorrection : null;
  const eaten   = macros ? Math.round(macros.kcal) : 0;
  const balance = burn != null && eaten > 0 ? eaten - burn : null;
  const isDeficit = balance != null && balance < 0;

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
          {macroTarget ? (
            <Text style={styles.energyLabel}>
              <Text style={styles.energyNumInline}>{eaten > 0 ? eaten.toLocaleString() : '—'}</Text>
              {` kcal eaten `}
              <Text style={styles.energyTarget}>{`/ ${macroTarget.kcal.toLocaleString()}`}</Text>
            </Text>
          ) : (
            <>
              <Text style={styles.energyNum}>{eaten > 0 ? eaten.toLocaleString() : '—'}</Text>
              <Text style={styles.energyLabel}>kcal eaten</Text>
            </>
          )}
        </View>
        {burn != null ? (
          <Pressable style={styles.energyRow} onPress={() => { setCorrectionInput(burnCorrection !== 0 ? String(burnCorrection) : ''); setCorrectionModalVisible(true); }} hitSlop={8}>
            <Text style={styles.energyNum}>{Math.round(burn).toLocaleString()}</Text>
            <Text style={styles.energyLabel} numberOfLines={1}>
              {'kcal burned'}
              {burnCorrection !== 0 ? <Text style={styles.energyCorrection}>{` (${burnCorrection > 0 ? '+' : ''}${burnCorrection})`}</Text> : null}
            </Text>
            <Text style={styles.adjustBtn}>✎</Text>
          </Pressable>
        ) : null}
        {balance != null ? (
          <View style={[styles.energyRow, styles.balanceRow, isDeficit ? styles.balanceDeficitBg : styles.balanceSurplusBg]}>
            <Text style={[styles.energyNum, { color: isDeficit ? '#2E7D32' : '#C62828' }]}>
              {Math.abs(balance).toLocaleString()}
            </Text>
            <Text style={[styles.energyLabel, { color: isDeficit ? '#2E7D32' : '#C62828' }]}>
              kcal {isDeficit ? 'deficit' : 'surplus'}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Macro bars — show when meals exist OR when targets are set */}
      {(!isEmpty || macroTarget) && (
        <View style={[styles.barsWrap, { marginTop: 10 }]}>
          <MacroBar label="P" value={macros?.protein_g ?? 0} target={macroTarget ? macroTarget.protein_g : maxMacro} color={COLOR_PROTEIN} showTarget={!!macroTarget} />
          <MacroBar label="C" value={macros?.carb_g    ?? 0} target={macroTarget ? macroTarget.carb_g    : maxMacro} color={COLOR_CARB}    showTarget={!!macroTarget} />
          <MacroBar label="F" value={macros?.fat_g     ?? 0} target={macroTarget ? macroTarget.fat_g     : maxMacro} color={COLOR_FAT}     showTarget={!!macroTarget} />
          <MacroBar label="Fi" value={macros?.fiber_g ?? 0} target={fiberTarget} color={COLOR_FIBER} showTarget={!!macroTarget} />
        </View>
      )}

      {/* Meal chips + Add */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Pressable
          style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.chipPressed]}
          onPress={() => onAddMeal(activeDayKey)}
          accessibilityLabel="Add meal"
        >
          <Text style={styles.addChipIcon}>＋</Text>
          <Text style={styles.addChipLabel}>{isToday ? 'Add meal' : 'Add meal here'}</Text>
        </Pressable>
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

      {/* Footer — export / import */}
      <View style={styles.footer}>
        <Pressable style={styles.footerBtn} onPress={handleExport} accessibilityLabel="Export food log">
          <Text style={styles.footerBtnText}>⬆ Export</Text>
        </Pressable>
        <Pressable style={styles.footerBtn} onPress={handleImport} accessibilityLabel="Import food log">
          <Text style={styles.footerBtnText}>⬇ Import</Text>
        </Pressable>
      </View>

      {/* Burn correction modal */}
      <Modal visible={correctionModalVisible} transparent animationType="fade" onRequestClose={() => setCorrectionModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCorrectionModalVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Adjust burned calories</Text>
            <Text style={styles.modalSub}>
              Enter a correction (e.g. <Text style={styles.modalCode}>-188</Text> to reduce by 188 kcal).{'\n'}
              Raw recorded: <Text style={styles.modalBold}>{rawBurn?.toLocaleString() ?? '—'} kcal</Text>
            </Text>
            <TextInput
              style={styles.modalInput}
              value={correctionInput}
              onChangeText={setCorrectionInput}
              keyboardType="numbers-and-punctuation"
              placeholder="-188"
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
    width: 56,
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
