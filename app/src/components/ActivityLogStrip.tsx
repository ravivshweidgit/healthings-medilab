/**
 * Activity Log strip — Food Log twin (prompt104).
 * Manual/favorite sessions + wearable WorkoutSession chips (read-only).
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activityLogDayKey,
  getActivitiesForDay,
  getDailyActivityKcal,
  type ActivityEntry,
} from '../services/ActivityLogService';
import type { WorkoutSession } from '../services/WithingsApiService';
import { getActivityLogUiCopy } from '../i18n/activityLogUiCopy';
import { formatFoodLogDayLabel } from '../i18n/dateLocale';
import { cardShadow, dashCardGap } from '../theme/wellness';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import { StripIcons } from '../theme/icons';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';
import { DEFAULT_UNITS_PREFS } from '../services/UnitsPreferenceService';
import type { UserLanguage } from '../services/TargetService';
import { DEFAULT_LANGUAGE } from '../services/TargetService';
import { formatEnergy } from '../logic/unitConvert';

const ACTIVITY_LOG_EXPANDED_KEY = 'dash_activity_log_expanded';

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

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function workoutMinutes(w: WorkoutSession): number {
  return Math.max(1, Math.round((w.endMs - w.startMs) / 60_000));
}

export type ActivityLogStripHandle = { reload: () => Promise<void> };

type Props = {
  dayKey?: string;
  onAddActivity: (dayKey: string) => void;
  onEditActivity?: (entry: ActivityEntry) => void;
  refreshKey?: number;
  workoutSessions?: WorkoutSession[];
  unitsPrefs?: UnitsPrefs;
  lang?: UserLanguage | null;
};

export const ActivityLogStrip = forwardRef<ActivityLogStripHandle, Props>(function ActivityLogStrip(
  {
    dayKey: initialDayKey,
    onAddActivity,
    onEditActivity,
    refreshKey,
    workoutSessions = [],
    unitsPrefs = DEFAULT_UNITS_PREFS,
    lang = DEFAULT_LANGUAGE,
  },
  ref,
) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const ui = useMemo(() => getActivityLogUiCopy(lang?.code), [lang?.code]);
  const titleRtl = lang?.code === 'he' || lang?.code === 'ar';
  const energyU = unitsPrefs.energy;

  const [expanded, setExpanded] = useState(true);
  const [expandPrefsLoaded, setExpandPrefsLoaded] = useState(false);
  const [selectedMs, setSelectedMs] = useState(() => {
    if (initialDayKey) {
      const parts = initialDayKey.split('-').map(Number);
      if (parts.length === 3) return startOfLocalDay(new Date(parts[0], parts[1] - 1, parts[2]).getTime());
    }
    return startOfLocalDay(Date.now());
  });
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [manualKcal, setManualKcal] = useState(0);

  useEffect(() => {
    void AsyncStorage.getItem(ACTIVITY_LOG_EXPANDED_KEY).then((v) => {
      if (v === 'false') setExpanded(false);
      if (v === 'true') setExpanded(true);
      setExpandPrefsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!expandPrefsLoaded) return;
    void AsyncStorage.setItem(ACTIVITY_LOG_EXPANDED_KEY, expanded ? 'true' : 'false');
  }, [expanded, expandPrefsLoaded]);

  const activeDayKey = activityLogDayKey(selectedMs);
  const todayKey = activityLogDayKey(Date.now());

  const dayWorkouts = useMemo(
    () => workoutSessions.filter((w) => activityLogDayKey(w.startMs) === activeDayKey),
    [workoutSessions, activeDayKey],
  );

  const wearableKcal = useMemo(
    () => dayWorkouts.reduce((s, w) => s + (Number.isFinite(w.kcal) ? w.kcal : 0), 0),
    [dayWorkouts],
  );

  /** Manual + wearable chips in one chronological timeline. */
  const timelineChips = useMemo(() => {
    type Chip =
      | { kind: 'manual'; entry: ActivityEntry; sortMs: number }
      | { kind: 'wearable'; workout: WorkoutSession; sortMs: number };
    const items: Chip[] = [
      ...entries.map((entry) => ({
        kind: 'manual' as const,
        entry,
        sortMs: entry.timestamp,
      })),
      ...dayWorkouts.map((workout) => ({
        kind: 'wearable' as const,
        workout,
        sortMs: workout.startMs,
      })),
    ];
    return items.sort((a, b) => a.sortMs - b.sortMs);
  }, [entries, dayWorkouts]);

  const dayTotal = Math.round(manualKcal + wearableKcal);

  const load = useCallback(async () => {
    const [list, kcal] = await Promise.all([
      getActivitiesForDay(activeDayKey),
      getDailyActivityKcal(activeDayKey),
    ]);
    setEntries(list);
    setManualKcal(kcal);
  }, [activeDayKey]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useImperativeHandle(ref, () => ({ reload: load }), [load]);

  const shiftDay = useCallback((delta: number) => {
    setSelectedMs((prev) => {
      const next = addLocalDays(prev, delta);
      const todayStart = startOfLocalDay(Date.now());
      return next > todayStart ? todayStart : next;
    });
  }, []);

  const dayLabel = formatFoodLogDayLabel(selectedMs, lang?.code, {
    todayDayKey: todayKey,
    dayKey: activeDayKey,
  });

  const collapsedSub =
    dayTotal > 0
      ? `${formatEnergy(dayTotal, energyU)} ${ui.total}`
      : ui.noSessions;

  return (
    <View style={[styles.card, cardShadow, { marginBottom: dashCardGap }]}>
      <DashboardCollapseHeader
        title={ui.title}
        subtitle={collapsedSub}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        titleRtl={titleRtl}
        collapseLabel={ui.collapse}
        expandLabel={ui.expand}
        icon={StripIcons.activityLog}
        perfTag="ActivityLogStrip"
      />

      {expanded ? (
        <>
          <View style={styles.dayNav}>
            <Pressable onPress={() => shiftDay(-1)} hitSlop={8} style={styles.dayNavBtn}>
              <Text style={styles.dayNavArrow}>‹</Text>
            </Pressable>
            <Text style={[styles.dayLabel, titleRtl && styles.rtl]}>{dayLabel}</Text>
            <Pressable
              onPress={() => shiftDay(1)}
              hitSlop={8}
              style={styles.dayNavBtn}
              disabled={activeDayKey === todayKey}
            >
              <Text
                style={[
                  styles.dayNavArrow,
                  activeDayKey === todayKey && styles.dayNavArrowDisabled,
                ]}
              >
                ›
              </Text>
            </Pressable>
            <Pressable
              style={styles.addBtn}
              onPress={() => onAddActivity(activeDayKey)}
              accessibilityLabel={ui.addActivity}
            >
              <Text style={styles.addBtnText}>+ {ui.addActivity}</Text>
            </Pressable>
          </View>

          <Text style={styles.totalLine}>
            {formatEnergy(dayTotal, energyU)} {ui.total}
            {manualKcal > 0 && wearableKcal > 0
              ? ` · ${formatEnergy(manualKcal, energyU)} log + ${formatEnergy(wearableKcal, energyU)} ${ui.wearable}`
              : null}
          </Text>

          {timelineChips.length === 0 ? (
            <Text style={styles.empty}>{ui.noSessions}</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {timelineChips.map((chip) =>
                chip.kind === 'manual' ? (
                  <Pressable
                    key={chip.entry.id}
                    style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                    onPress={() => onEditActivity?.(chip.entry)}
                  >
                    <Text style={styles.chipTime}>{formatTime(chip.entry.timestamp)}</Text>
                    <Text style={styles.chipLabel} numberOfLines={2}>
                      {chip.entry.name}
                    </Text>
                    <Text style={styles.chipMeta}>
                      {chip.entry.minutes} min · {formatEnergy(chip.entry.activityKcal, energyU)}
                      {chip.entry.equipmentWeightKg != null && chip.entry.equipmentWeightKg > 0
                        ? ` · ${chip.entry.equipmentWeightKg} kg`
                        : ''}
                    </Text>
                    <Text style={styles.chipBadge}>
                      {chip.entry.source === 'favorite' ? ui.favorite : ui.manual} · ✎
                    </Text>
                  </Pressable>
                ) : (
                  <View
                    key={`w-${chip.workout.startMs}-${chip.workout.category}`}
                    style={[styles.chip, styles.chipWearable]}
                  >
                    <Text style={styles.chipTime}>{formatTime(chip.workout.startMs)}</Text>
                    <Text style={styles.chipLabel} numberOfLines={2}>
                      {chip.workout.activityLabel || 'Workout'}
                    </Text>
                    <Text style={styles.chipMeta}>
                      {workoutMinutes(chip.workout)} min ·{' '}
                      {formatEnergy(chip.workout.kcal, energyU)}
                    </Text>
                    <Text style={styles.chipBadgeWearable}>
                      {chip.workout.source === 'health-connect' ? 'HC' : ui.wearable}
                    </Text>
                  </View>
                ),
              )}
            </ScrollView>
          )}
        </>
      ) : null}
    </View>
  );
});

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 14,
    },
    dayNav: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 4,
    },
    dayNavBtn: { paddingHorizontal: 4, paddingVertical: 2 },
    dayNavArrow: { fontSize: 22, color: c.textPrimary, fontWeight: '600' },
    dayNavArrowDisabled: { color: c.gridLine },
    dayLabel: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: c.textPrimary,
      textAlign: 'center',
    },
    rtl: { textAlign: 'right', writingDirection: 'rtl' },
    addBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(67,160,71,0.2)' : '#E8F5E9',
    },
    addBtnText: { fontSize: 12, fontWeight: '700', color: '#2E7D32' },
    totalLine: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
      marginBottom: 10,
    },
    empty: { fontSize: 13, color: c.textSecondary, paddingVertical: 8 },
    chipsRow: { gap: 8, paddingBottom: 4 },
    chip: {
      width: 132,
      padding: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.gridLine,
      backgroundColor: isDark ? c.background : '#FAFAFA',
    },
    chipWearable: {
      borderStyle: 'dashed',
    },
    chipPressed: { opacity: 0.75 },
    chipTime: { fontSize: 11, color: c.textSecondary, marginBottom: 2 },
    chipLabel: { fontSize: 13, fontWeight: '700', color: c.textPrimary, minHeight: 34 },
    chipMeta: { fontSize: 11, color: c.textPrimary, marginTop: 4, fontVariant: ['tabular-nums'] },
    chipBadge: { fontSize: 10, color: c.textSecondary, marginTop: 4 },
    chipBadgeWearable: { fontSize: 10, color: '#1E88E5', marginTop: 4, fontWeight: '600' },
  });
