/**
 * Activity Log strip — Food Log twin (prompt104).
 * Manual/favorite sessions + wearable WorkoutSession chips (read-only).
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  activityLogDayKey,
  getActivitiesForDay,
  getDailyActivityKcal,
  type ActivityEntry,
} from '../services/ActivityLogService';
import {
  loadActiveTrainingProgram,
  getTodayPrescribedWorkout,
  getPrescribedActivities,
  resolveSessionMatchType,
  sortActivitiesByTimeSlot,
  type PrescribedActivitySession,
  type PrescribedWorkoutDay,
} from '../services/TrainingDirectiveService';
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
import {
  keepMountedCollapsedStyles,
  useKeepMountedExpand,
} from '../hooks/useKeepMountedExpand';

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
  if (w.manualMinutes != null && Number.isFinite(w.manualMinutes) && w.manualMinutes > 0) {
    return Math.round(w.manualMinutes);
  }
  return Math.max(1, Math.round((w.endMs - w.startMs) / 60_000));
}

function workoutKcal(w: WorkoutSession): number {
  if (w.manualKcal != null && Number.isFinite(w.manualKcal) && w.manualKcal >= 0) {
    return Math.round(w.manualKcal);
  }
  return Math.round(w.kcal || 0);
}

const TYPE_ICON: Record<PrescribedActivitySession['workoutType'], string> = {
  strength: '🏋️',
  cardio: '🏃',
  hiit: '⚡',
  mobility: '🧘',
  rest: '🛌',
};

const SLOT_ICON: Record<PrescribedActivitySession['timeSlot'], string> = {
  morning: '🌅',
  noon: '☀️',
  evening: '🌙',
  anytime: '🕒',
};

export type MatchedPrescription = {
  status: 'pending' | 'logged' | 'watch';
  /** Which number decided `percent` — drives what the card shows. */
  metric: ActivityMetric;
  actualKcal: number;
  actualMinutes: number;
  actualDistanceM?: number;
  actualDistanceKm?: number;
  targetKcal: number;
  targetMinutes: number;
  targetDistanceM?: number;
  targetDistanceKm?: number;
  percent: number;
};

/** kcal burned per kg per km on foot — the walking figure the clinic plans with. */
const KCAL_PER_KG_KM = 0.55;

const FOOT_RE = /walk|run|hike|jog|treadmill|הליכה|ריצה|צעיד/i;
const BIKE_RE = /bike|cycl|bicycl|ride|spin|אופני|רכיב/i;

/** Walk/run/hike — scored on distance; not editable until meters exist in the editor. */
export function isFootWorkout(w: WorkoutSession): boolean {
  return (
    w.category === 1 || // Walk
    w.category === 2 || // Run
    w.category === 3 || // Hike
    FOOT_RE.test(w.activityLabel || '')
  );
}

/**
 * Distance only where a distance is trustworthy.
 *
 * A recorded figure always wins. Failing that, distance is back-solved from kcal
 * for foot sports only: the coefficient is a walking one, and applying it to a
 * ride invents kilometres. Rides are scored on burn instead — see
 * `resolveActivityMetric`.
 */
export function resolveWorkoutDistanceMeters(w: WorkoutSession, weightKg: number): number | null {
  if (w.distanceM != null && Number.isFinite(w.distanceM) && w.distanceM > 0) {
    return Math.round(w.distanceM);
  }
  const effKcal = workoutKcal(w);
  if (isFootWorkout(w) && effKcal > 0 && weightKg > 0) {
    return Math.round((effKcal / (weightKg * KCAL_PER_KG_KM)) * 1000);
  }
  return null;
}

export function resolveManualDistanceMeters(e: ActivityEntry, weightKg: number): number | null {
  if (FOOT_RE.test(e.name || '') && e.activityKcal > 0 && weightKg > 0) {
    return Math.round((e.activityKcal / (weightKg * KCAL_PER_KG_KM)) * 1000);
  }
  return null;
}

export function formatDistanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m';
  const m = Math.round(meters);
  if (m >= 1000) {
    const km = (m / 1000).toFixed(2);
    return `${km.replace(/\.?0+$/, '')} km`;
  }
  return `${m} m`;
}

/** The single number a prescribed session is judged on. */
export type ActivityMetric = 'distance' | 'kcal' | 'minutes' | 'session';

type PrescriptionShape = {
  workoutType?: string;
  matchType?: string;
  title?: string;
  durationMinutes?: number;
  targetKcal?: number;
  targetDistanceM?: number;
  targetDistanceKm?: number;
};

export function prescribedTargetDistanceM(activity: PrescriptionShape): number {
  if (activity.targetDistanceM && activity.targetDistanceM > 0) {
    return Math.round(activity.targetDistanceM);
  }
  if (activity.targetDistanceKm && activity.targetDistanceKm > 0) {
    return Math.round(activity.targetDistanceKm * 1000);
  }
  return 0;
}

/**
 * Which number this session is scored on.
 *
 * On foot, distance is the one figure every phone and watch agrees on — it comes
 * off the step counter rather than an estimate. On a bike it is the opposite:
 * Withings frequently reports no distance at all and vendors disagree when they
 * do, while the ride's kcal is consistent. So rides are scored on burn, and the
 * prescribed kilometres stay as instruction for the rider.
 */
export function resolveActivityMetric(activity: PrescriptionShape): ActivityMetric {
  const match = (activity.matchType || '').toLowerCase();
  const title = activity.title || '';

  if (match === 'bike' || (!match && BIKE_RE.test(title))) {
    return (activity.targetKcal || 0) > 0 ? 'kcal' : 'minutes';
  }
  if (match === 'walk' || match === 'run' || FOOT_RE.test(title)) {
    return 'distance';
  }
  if (prescribedTargetDistanceM(activity) > 0) return 'distance';
  if ((activity.targetKcal || 0) > 0) return 'kcal';
  if ((activity.durationMinutes || 0) > 0) return 'minutes';
  return 'session';
}

/**
 * Daily pool waterfall allocation:
 * Takes the day's total recorded activity per type (bike, foot, gym, any)
 * and waterfall-fills the day's prescribed activities in order.
 * No brittle time-of-day matching — total daily effort is loaded directly onto the plan.
 * Pure over data already in memory; nothing touches disk (render path).
 */
function matchPrescribedActivities(
  activities: PrescribedActivitySession[],
  entries: ActivityEntry[],
  workouts: WorkoutSession[],
  weightKg: number = 74.9,
  dayDistanceM: number = 0,
): Record<string, MatchedPrescription> {
  type Candidate = {
    key: string;
    matchType: string;
    name: string;
    origin: 'logged' | 'watch';
    kcal: number;
    minutes: number;
    distanceM: number;
  };

  const candidates: Candidate[] = [
    ...entries.map((e, i) => ({
      key: `m-${e.id ?? i}`,
      matchType: resolveSessionMatchType({ name: e.name }),
      name: (e.name || '').toLowerCase().trim(),
      origin: 'logged' as const,
      kcal: Math.round(e.activityKcal || 0),
      minutes: Math.round(e.minutes || 0),
      distanceM: resolveManualDistanceMeters(e, weightKg) || 0,
    })),
    ...workouts.map((w, i) => ({
      key: `w-${w.startMs}-${i}`,
      matchType: resolveSessionMatchType({ category: w.category, activityLabel: w.activityLabel }),
      name: (w.activityLabel || '').toLowerCase().trim(),
      origin: 'watch' as const,
      kcal: workoutKcal(w),
      minutes: Math.round(workoutMinutes(w)),
      distanceM: resolveWorkoutDistanceMeters(w, weightKg) || 0,
    })),
  ];

  // Group candidates by broad activity bucket
  const bikeCandidates = candidates.filter((c) => c.matchType === 'bike');
  const footCandidates = candidates.filter(
    (c) => c.matchType === 'walk' || c.matchType === 'run',
  );
  const gymCandidates = candidates.filter((c) => c.matchType === 'gym');
  const otherCandidates = candidates.filter(
    (c) => c.matchType !== 'bike' && c.matchType !== 'walk' && c.matchType !== 'run' && c.matchType !== 'gym',
  );

  // Totals for Bike
  const totalBikeKcal = bikeCandidates.reduce((s, c) => s + c.kcal, 0);
  const totalBikeMin = bikeCandidates.reduce((s, c) => s + c.minutes, 0);
  const hasBikeWatch = bikeCandidates.some((c) => c.origin === 'watch');
  const hasBikeLogged = bikeCandidates.some((c) => c.origin === 'logged');

  // Totals for Foot (Walk / Run)
  const workoutFootDistSum = footCandidates.reduce((s, c) => s + (c.distanceM || 0), 0);
  const totalFootDistanceM = Math.round(Math.max(dayDistanceM, workoutFootDistSum));
  const hasFootWatch = footCandidates.some((c) => c.origin === 'watch') || dayDistanceM > 0;
  const hasFootLogged = footCandidates.some((c) => c.origin === 'logged');

  // Totals for Gym / Strength
  const totalGymKcal = gymCandidates.reduce((s, c) => s + c.kcal, 0);
  const totalGymMin = gymCandidates.reduce((s, c) => s + c.minutes, 0);
  const hasGymWatch = gymCandidates.some((c) => c.origin === 'watch');
  const hasGymLogged = gymCandidates.some((c) => c.origin === 'logged');

  // Totals for Other
  const totalOtherKcal = otherCandidates.reduce((s, c) => s + c.kcal, 0);
  const totalOtherMin = otherCandidates.reduce((s, c) => s + c.minutes, 0);
  const hasOtherWatch = otherCandidates.some((c) => c.origin === 'watch');
  const hasOtherLogged = otherCandidates.some((c) => c.origin === 'logged');

  // Filter activities into buckets while keeping their original order
  const bikeActivities = activities.filter(
    (a) => a.matchType === 'bike' || (!a.matchType && BIKE_RE.test(a.title || '')),
  );
  const footActivities = activities.filter(
    (a) => resolveActivityMetric(a) === 'distance',
  );
  const gymActivities = activities.filter(
    (a) => a.matchType === 'gym' || a.workoutType === 'strength' || a.workoutType === 'hiit',
  );
  const otherActivities = activities.filter(
    (a) =>
      !bikeActivities.includes(a) &&
      !footActivities.includes(a) &&
      !gymActivities.includes(a),
  );

  const result: Record<string, MatchedPrescription> = {};

  // 1. Waterfall for Bike activities
  let remainingBikeKcal = totalBikeKcal;
  let remainingBikeMin = totalBikeMin;
  for (let i = 0; i < bikeActivities.length; i++) {
    const a = bikeActivities[i];
    const targetKcal = a.targetKcal || 0;
    const targetMinutes = a.durationMinutes || 0;
    const targetDistanceM = prescribedTargetDistanceM(a);
    const targetDistanceKm =
      targetDistanceM > 0 ? Number((targetDistanceM / 1000).toFixed(2)) : 0;
    const isLast = i === bikeActivities.length - 1;

    let fillKcal = 0;
    let fillMin = 0;

    if (isLast) {
      fillKcal = remainingBikeKcal;
      fillMin = remainingBikeMin;
      remainingBikeKcal = 0;
      remainingBikeMin = 0;
    } else {
      fillKcal = Math.min(remainingBikeKcal, targetKcal > 0 ? targetKcal : remainingBikeKcal);
      fillMin = Math.min(remainingBikeMin, targetMinutes > 0 ? targetMinutes : remainingBikeMin);
      remainingBikeKcal = Math.max(0, remainingBikeKcal - fillKcal);
      remainingBikeMin = Math.max(0, remainingBikeMin - fillMin);
    }

    const status: MatchedPrescription['status'] =
      fillKcal > 0 || fillMin > 0
        ? hasBikeWatch
          ? 'watch'
          : 'logged'
        : 'pending';

    const percent =
      status === 'pending'
        ? 0
        : targetKcal > 0
          ? Math.round((fillKcal / targetKcal) * 100)
          : targetMinutes > 0
            ? Math.round((fillMin / targetMinutes) * 100)
            : 100;

    result[a.id] = {
      status,
      metric: 'kcal',
      actualKcal: fillKcal,
      actualMinutes: fillMin,
      actualDistanceM: targetDistanceM > 0 ? Math.round((fillKcal / 200) * targetDistanceM) : 0,
      actualDistanceKm: targetDistanceM > 0 ? Number(((fillKcal / 200) * targetDistanceKm).toFixed(2)) : 0,
      targetKcal,
      targetMinutes,
      targetDistanceM,
      targetDistanceKm,
      percent,
    };
  }

  // 2. Waterfall for Foot activities (Walk / Run)
  let remainingFootM = totalFootDistanceM;
  for (let i = 0; i < footActivities.length; i++) {
    const a = footActivities[i];
    const targetKcal = a.targetKcal || 0;
    const targetMinutes = a.durationMinutes || 0;
    const targetDistanceM = prescribedTargetDistanceM(a);
    const targetDistanceKm =
      targetDistanceM > 0 ? Number((targetDistanceM / 1000).toFixed(2)) : 0;
    const isLast = i === footActivities.length - 1;

    let fillM = 0;
    if (isLast) {
      fillM = remainingFootM;
      remainingFootM = 0;
    } else {
      fillM = Math.min(remainingFootM, targetDistanceM > 0 ? targetDistanceM : remainingFootM);
      remainingFootM = Math.max(0, remainingFootM - fillM);
    }

    const actualKcal = fillM > 0 ? Math.round((fillM / 1000) * weightKg * KCAL_PER_KG_KM) : 0;
    const actualMinutes = fillM > 0 ? Math.round((fillM / 1000) * 12) : 0;

    const status: MatchedPrescription['status'] =
      fillM > 0
        ? hasFootWatch
          ? 'watch'
          : hasFootLogged
            ? 'logged'
            : 'pending'
        : 'pending';

    const percent =
      status === 'pending'
        ? 0
        : targetDistanceM > 0
          ? Math.round((fillM / targetDistanceM) * 100)
          : targetKcal > 0
            ? Math.round((actualKcal / targetKcal) * 100)
            : 100;

    result[a.id] = {
      status,
      metric: 'distance',
      actualKcal,
      actualMinutes,
      actualDistanceM: Math.round(fillM),
      actualDistanceKm: fillM > 0 ? Number((fillM / 1000).toFixed(2)) : 0,
      targetKcal,
      targetMinutes,
      targetDistanceM,
      targetDistanceKm,
      percent,
    };
  }

  // 3. Waterfall for Gym / Strength activities
  let remainingGymKcal = totalGymKcal;
  let remainingGymMin = totalGymMin;
  for (let i = 0; i < gymActivities.length; i++) {
    const a = gymActivities[i];
    const targetKcal = a.targetKcal || 0;
    const targetMinutes = a.durationMinutes || 0;
    const isLast = i === gymActivities.length - 1;

    let fillKcal = 0;
    let fillMin = 0;
    if (isLast) {
      fillKcal = remainingGymKcal;
      fillMin = remainingGymMin;
      remainingGymKcal = 0;
      remainingGymMin = 0;
    } else {
      fillKcal = Math.min(remainingGymKcal, targetKcal > 0 ? targetKcal : remainingGymKcal);
      fillMin = Math.min(remainingGymMin, targetMinutes > 0 ? targetMinutes : remainingGymMin);
      remainingGymKcal = Math.max(0, remainingGymKcal - fillKcal);
      remainingGymMin = Math.max(0, remainingGymMin - fillMin);
    }

    const status: MatchedPrescription['status'] =
      fillKcal > 0 || fillMin > 0
        ? hasGymWatch
          ? 'watch'
          : 'logged'
        : 'pending';

    const percent =
      status === 'pending'
        ? 0
        : targetKcal > 0
          ? Math.round((fillKcal / targetKcal) * 100)
          : targetMinutes > 0
            ? Math.round((fillMin / targetMinutes) * 100)
            : 100;

    result[a.id] = {
      status,
      metric: (a.targetKcal || 0) > 0 ? 'kcal' : 'minutes',
      actualKcal: fillKcal,
      actualMinutes: fillMin,
      targetKcal,
      targetMinutes,
      percent,
    };
  }

  // 4. Other remaining activities
  let remainingOtherKcal = totalOtherKcal;
  let remainingOtherMin = totalOtherMin;
  for (let i = 0; i < otherActivities.length; i++) {
    const a = otherActivities[i];
    const targetKcal = a.targetKcal || 0;
    const targetMinutes = a.durationMinutes || 0;
    const isLast = i === otherActivities.length - 1;

    let fillKcal = 0;
    let fillMin = 0;
    if (isLast) {
      fillKcal = remainingOtherKcal;
      fillMin = remainingOtherMin;
      remainingOtherKcal = 0;
      remainingOtherMin = 0;
    } else {
      fillKcal = Math.min(remainingOtherKcal, targetKcal > 0 ? targetKcal : remainingOtherKcal);
      fillMin = Math.min(remainingOtherMin, targetMinutes > 0 ? targetMinutes : remainingOtherMin);
      remainingOtherKcal = Math.max(0, remainingOtherKcal - fillKcal);
      remainingOtherMin = Math.max(0, remainingOtherMin - fillMin);
    }

    const status: MatchedPrescription['status'] =
      fillKcal > 0 || fillMin > 0
        ? hasOtherWatch
          ? 'watch'
          : 'logged'
        : 'pending';

    const percent =
      status === 'pending'
        ? 0
        : targetKcal > 0
          ? Math.round((fillKcal / targetKcal) * 100)
          : targetMinutes > 0
            ? Math.round((fillMin / targetMinutes) * 100)
            : 100;

    result[a.id] = {
      status,
      metric: resolveActivityMetric(a),
      actualKcal: fillKcal,
      actualMinutes: fillMin,
      targetKcal,
      targetMinutes,
      percent,
    };
  }

  return result;
}

export type ActivityLogStripHandle = {
  reload: () => Promise<void>;
  expand: () => void;
  collapse: () => void;
};

type Props = {
  dayKey?: string;
  onAddActivity: (dayKey: string) => void;
  onEditActivity?: (entry: ActivityEntry) => void;
  onEditWorkout?: (workout: WorkoutSession) => void;
  onLogPrescribedWorkout?: (workout: PrescribedActivitySession, dayKey: string) => void;
  refreshKey?: number;
  workoutSessions?: WorkoutSession[];
  unitsPrefs?: UnitsPrefs;
  lang?: UserLanguage | null;
  weightKg?: number | null;
  distanceByDay?: Map<string, number>;
};

export const ActivityLogStrip = forwardRef<ActivityLogStripHandle, Props>(function ActivityLogStrip(
  {
    dayKey: initialDayKey,
    onAddActivity,
    onEditActivity,
    onEditWorkout,
    onLogPrescribedWorkout,
    refreshKey,
    workoutSessions = [],
    unitsPrefs = DEFAULT_UNITS_PREFS,
    lang = DEFAULT_LANGUAGE,
    weightKg = 74.9,
    distanceByDay,
  },
  ref,
) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const ui = useMemo(() => getActivityLogUiCopy(lang?.code), [lang?.code]);
  const titleRtl = lang?.code === 'he' || lang?.code === 'ar';
  const energyU = unitsPrefs.energy;
  const effectiveWeight = weightKg && Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 74.9;

  const [expanded, setExpanded] = useState(false);
  /** Mount once; collapse only hides — pre-warmed via hook for 60fps responsiveness. */
  const bodyMounted = useKeepMountedExpand(expanded);
  const [selectedMs, setSelectedMs] = useState(() => {
    if (initialDayKey) {
      const parts = initialDayKey.split('-').map(Number);
      if (parts.length === 3) return startOfLocalDay(new Date(parts[0], parts[1] - 1, parts[2]).getTime());
    }
    return startOfLocalDay(Date.now());
  });
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [manualKcal, setManualKcal] = useState(0);
  const [prescribedDay, setPrescribedDay] = useState<PrescribedWorkoutDay | null>(null);

  // selectedMs and refreshKey are stable numbers, so this disk read fires on an
  // explicit day change only — never repeatedly on a render pass.
  useEffect(() => {
    void loadActiveTrainingProgram().then((prog) => {
      const prescribed = getTodayPrescribedWorkout(prog, new Date(selectedMs));
      setPrescribedDay(prescribed);
    });
  }, [selectedMs, refreshKey]);

  const activeDayKey = activityLogDayKey(selectedMs);
  const todayKey = activityLogDayKey(Date.now());
  const isToday = activeDayKey === todayKey;

  const dayWorkouts = useMemo(
    () => workoutSessions.filter((w) => activityLogDayKey(w.startMs) === activeDayKey),
    [workoutSessions, activeDayKey],
  );

  const wearableKcal = useMemo(
    () => dayWorkouts.reduce((s, w) => s + workoutKcal(w), 0),
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

  const prescribedActivities = useMemo(
    () => sortActivitiesByTimeSlot(getPrescribedActivities(prescribedDay)),
    [prescribedDay],
  );

  const dayDistanceM = distanceByDay?.get(activeDayKey) || 0;

  const prescribedStatus = useMemo(
    () => matchPrescribedActivities(prescribedActivities, entries, dayWorkouts, effectiveWeight, dayDistanceM),
    [prescribedActivities, entries, dayWorkouts, effectiveWeight, dayDistanceM],
  );

  const prescribedDoneCount = useMemo(
    () => prescribedActivities.filter((a) => prescribedStatus[a.id]?.status !== 'pending').length,
    [prescribedActivities, prescribedStatus],
  );

  /** Summed per unit — a ride's kcal and a walk's kilometres cannot share a total. */
  const targetTotals = useMemo(() => {
    let targetKcal = 0;
    let targetMin = 0;
    let targetDistanceM = 0;
    let actualKcal = 0;
    let actualMin = 0;
    let actualDistanceM = 0;
    for (const a of prescribedActivities) {
      const m = prescribedStatus[a.id];
      targetKcal += a.targetKcal || 0;
      targetMin += a.durationMinutes || 0;
      if (m?.metric === 'distance') targetDistanceM += m.targetDistanceM || 0;
      if (m && m.status !== 'pending') {
        actualKcal += m.actualKcal;
        actualMin += m.actualMinutes;
        if (m.metric === 'distance') actualDistanceM += m.actualDistanceM || 0;
      }
    }
    return { targetKcal, targetMin, targetDistanceM, actualKcal, actualMin, actualDistanceM };
  }, [prescribedActivities, prescribedStatus]);

  /**
   * The mean of each session's own percentage. Mixed units rule out one big
   * ratio, and this keeps every session weighted equally: two walks at 152%
   * still read 152%.
   */
  const overallScore = useMemo(() => {
    if (!prescribedActivities.length) return 0;
    const sum = prescribedActivities.reduce(
      (acc, a) => acc + (prescribedStatus[a.id]?.percent || 0),
      0,
    );
    return Math.round(sum / prescribedActivities.length);
  }, [prescribedActivities, prescribedStatus]);

  const load = useCallback(async () => {
    const [list, kcal] = await Promise.all([
      getActivitiesForDay(activeDayKey),
      getDailyActivityKcal(activeDayKey),
    ]);
    setEntries(list);
    setManualKcal(kcal);
    setEntriesLoaded(true);
  }, [activeDayKey]);

  useEffect(() => {
    setEntriesLoaded(false);
    void load();
  }, [load, refreshKey]);

  useImperativeHandle(
    ref,
    () => ({
      reload: load,
      expand: () => setExpanded(true),
      collapse: () => setExpanded(false),
    }),
    [load],
  );

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
    <View
      style={[
        styles.card,
        !expanded && styles.cardCollapsed,
        cardShadow,
        { marginBottom: dashCardGap },
      ]}
    >
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

      {bodyMounted ? (
        <View
          style={[!expanded && keepMountedCollapsedStyles.bodyCollapsed]}
          pointerEvents={expanded ? 'auto' : 'none'}
          accessibilityElementsHidden={!expanded}
          importantForAccessibility={expanded ? 'yes' : 'no-hide-descendants'}
        >
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
              style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
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

          {prescribedActivities.length > 0 ? (
            <View style={styles.planBlock}>
              <View style={styles.planSummaryCard}>
                <View style={styles.planSummaryHead}>
                  <View style={styles.planSummaryTitleCol}>
                    <Text style={[styles.planHeading, titleRtl && styles.rtl]}>
                      {ui.planToday}
                      {prescribedDay?.dayFocus ? ` · ${prescribedDay.dayFocus}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.planScoreBadge,
                      overallScore >= 100 && styles.planScoreBadgeDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.planScoreText,
                        overallScore >= 100 && styles.planScoreTextDone,
                      ]}
                    >
                      {overallScore}% · {prescribedDoneCount}/{prescribedActivities.length}
                    </Text>
                  </View>
                </View>

                {/* Overall Plan Progress Meter Bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.min(100, overallScore)}%` },
                      overallScore >= 100 && styles.progressBarFillDone,
                    ]}
                  />
                </View>

                {(targetTotals.targetKcal > 0 || targetTotals.targetMin > 0 || targetTotals.targetDistanceM > 0) ? (
                  <View style={styles.planTotalsRow}>
                    <Text style={styles.planTotalsText}>
                      {targetTotals.targetDistanceM > 0
                        ? `${formatDistanceLabel(targetTotals.actualDistanceM)} / ${formatDistanceLabel(targetTotals.targetDistanceM)} · `
                        : ''}
                      {formatEnergy(targetTotals.actualKcal, energyU)} / {formatEnergy(targetTotals.targetKcal, energyU)} {ui.total}
                    </Text>
                  </View>
                ) : null}
              </View>

              {prescribedActivities.map((activity) => {
                const match: MatchedPrescription = prescribedStatus[activity.id] ?? {
                  status: 'pending',
                  metric: resolveActivityMetric(activity),
                  actualKcal: 0,
                  actualMinutes: 0,
                  actualDistanceM: 0,
                  targetKcal: activity.targetKcal || 0,
                  targetMinutes: activity.durationMinutes || 0,
                  targetDistanceM: prescribedTargetDistanceM(activity),
                  percent: 0,
                };
                const done = match.status !== 'pending';
                const slotLabel =
                  activity.timeSlot === 'morning'
                    ? ui.slotMorning
                    : activity.timeSlot === 'noon'
                      ? ui.slotNoon
                      : activity.timeSlot === 'evening'
                        ? ui.slotEvening
                        : '';
                return (
                  <Pressable
                    key={activity.id}
                    style={({ pressed }) => [
                      styles.prescribedCard,
                      done && styles.prescribedCardCompleted,
                      pressed && !done && styles.prescribedCardPressed,
                    ]}
                    onPress={() => {
                      if (onLogPrescribedWorkout) {
                        onLogPrescribedWorkout(activity, activeDayKey);
                      } else {
                        onAddActivity(activeDayKey);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={activity.title || ui.planToday}
                  >
                    <View style={styles.prescribedHead}>
                      <Text style={styles.prescribedTitle} numberOfLines={2}>
                        {SLOT_ICON[activity.timeSlot]} {TYPE_ICON[activity.workoutType]}{' '}
                        {activity.title || ui.planToday}
                        {slotLabel ? ` · ${slotLabel}` : ''}
                      </Text>
                      <Text
                        style={[
                          styles.prescribedActionChip,
                          done && styles.prescribedActionChipDone,
                        ]}
                      >
                        {match.status === 'watch'
                          ? ui.planFromWatch
                          : match.status === 'logged'
                            ? ui.planDone
                            : ui.planLog}
                      </Text>
                    </View>

                    {/* Per-Activity Progress Meter Bar */}
                    <View style={styles.activityMeterTrack}>
                      <View
                        style={[
                          styles.activityMeterFill,
                          { width: `${Math.min(100, match.percent)}%` },
                          done && styles.activityMeterFillDone,
                        ]}
                      />
                    </View>

                    <View style={styles.activityMeterNumbersRow}>
                      <Text style={styles.prescribedMeta}>
                        {(() => {
                          const targetM = match.targetDistanceM || 0;
                          const kcalPair = done
                            ? `${formatEnergy(match.actualKcal, energyU)} / ${formatEnergy(match.targetKcal, energyU)}`
                            : `~${formatEnergy(match.targetKcal, energyU)}`;

                          if (match.metric === 'distance') {
                            const distPair = done
                              ? `${formatDistanceLabel(match.actualDistanceM || 0)} / ${formatDistanceLabel(targetM)}`
                              : formatDistanceLabel(targetM);
                            return `${distPair} · ${kcalPair}`;
                          }
                          if (match.metric === 'kcal') {
                            // The ride is judged on burn; its kilometres stay as the instruction.
                            return targetM > 0
                              ? `${kcalPair} · ${formatDistanceLabel(targetM)}`
                              : kcalPair;
                          }
                          const minPair = done
                            ? `${match.actualMinutes} / ${match.targetMinutes} ${ui.minutes.toLowerCase()}`
                            : `${match.targetMinutes} ${ui.minutes.toLowerCase()}`;
                          return `${minPair} · ${kcalPair}`;
                        })()}
                        {activity.targetZone2Minutes
                          ? ` · Z2 ${activity.targetZone2Minutes} min`
                          : ''}
                      </Text>
                      <Text
                        style={[
                          styles.activityMeterPct,
                          done && styles.activityMeterPctDone,
                        ]}
                      >
                        {match.percent}%
                      </Text>
                    </View>

                    {activity.notes ? (
                      <Text style={styles.prescribedNotes} numberOfLines={2}>
                        {activity.notes}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : prescribedDay ? (
            <Text style={styles.planRestLine}>{ui.planRestDay}</Text>
          ) : null}

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
                      {(() => {
                        const distM = resolveManualDistanceMeters(chip.entry, effectiveWeight);
                        const distStr = distM ? `${formatDistanceLabel(distM)} · ` : '';
                        return `${distStr}${chip.entry.minutes} min · ${formatEnergy(chip.entry.activityKcal, energyU)}`;
                      })()}
                      {chip.entry.equipmentWeightKg != null && chip.entry.equipmentWeightKg > 0
                        ? ` · ${chip.entry.equipmentWeightKg} kg`
                        : ''}
                    </Text>
                    <Text style={styles.chipBadge}>
                      {chip.entry.source === 'favorite' ? ui.favorite : ui.manual} · ✎
                    </Text>
                  </Pressable>
                ) : (
                  (() => {
                    // Foot sports are scored on distance — no meters field in the editor yet,
                    // so walk/run chips stay read-only. Bike (kcal) and gym stay editable.
                    const footOnly = isFootWorkout(chip.workout);
                    const badgeBase = chip.workout.manualUpdatedAt
                      ? ui.manual
                      : chip.workout.source === 'health-connect'
                        ? 'HC'
                        : ui.wearable;
                    const meta = (() => {
                      const distM = resolveWorkoutDistanceMeters(chip.workout, effectiveWeight);
                      const distStr = distM ? `${formatDistanceLabel(distM)} · ` : '';
                      return `${distStr}${workoutMinutes(chip.workout)} min · ${formatEnergy(workoutKcal(chip.workout), energyU)}`;
                    })();
                    if (footOnly) {
                      return (
                        <View
                          key={`w-${chip.workout.startMs}-${chip.workout.category}`}
                          style={[styles.chip, styles.chipWearable]}
                        >
                          <Text style={styles.chipTime}>{formatTime(chip.workout.startMs)}</Text>
                          <Text style={styles.chipLabel} numberOfLines={2}>
                            {chip.workout.activityLabel || 'Workout'}
                          </Text>
                          <Text style={styles.chipMeta}>{meta}</Text>
                          <Text style={styles.chipBadgeWearable}>{badgeBase}</Text>
                        </View>
                      );
                    }
                    return (
                      <Pressable
                        key={`w-${chip.workout.startMs}-${chip.workout.category}`}
                        style={({ pressed }) => [
                          styles.chip,
                          styles.chipWearable,
                          pressed && styles.chipPressed,
                        ]}
                        onPress={() => onEditWorkout?.(chip.workout)}
                        accessibilityRole="button"
                        accessibilityLabel={chip.workout.activityLabel || 'Workout'}
                      >
                        <Text style={styles.chipTime}>{formatTime(chip.workout.startMs)}</Text>
                        <Text style={styles.chipLabel} numberOfLines={2}>
                          {chip.workout.activityLabel || 'Workout'}
                        </Text>
                        <Text style={styles.chipMeta}>{meta}</Text>
                        <Text style={styles.chipBadgeWearable}>{`${badgeBase} · ✎`}</Text>
                      </Pressable>
                    );
                  })()
                ),
              )}
            </ScrollView>
          )}
        </View>
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
    // Match FoodMacroStrip collapsed density (prompt106).
    cardCollapsed: {
      paddingBottom: 12,
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
    // Match FoodMacroStrip add-action / What’s next — black punch-out on dark, navy tint on light.
    addBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: 'solid',
      borderColor: isDark ? 'rgba(142, 155, 255, 0.9)' : 'rgba(31, 61, 92, 0.85)',
      backgroundColor: isDark ? c.background : 'rgba(31, 61, 92, 0.08)',
    },
    addBtnPressed: { opacity: 0.75 },
    addBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? c.accentBlue : '#1F3D5C',
    },
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
    chipBadgeWearable: { fontSize: 10, color: isDark ? c.accentBlue : '#1E88E5', marginTop: 4, fontWeight: '600' },
    planBlock: {
      marginBottom: 4,
    },
    planSummaryCard: {
      padding: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      marginBottom: 10,
    },
    planSummaryHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    planSummaryTitleCol: {
      flex: 1,
    },
    planScoreBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(142, 155, 255, 0.15)' : 'rgba(31, 61, 92, 0.08)',
    },
    planScoreBadgeDone: {
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.12)',
    },
    planScoreText: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? c.accentBlue : '#1F3D5C',
      fontVariant: ['tabular-nums'],
    },
    planScoreTextDone: {
      color: isDark ? '#81C784' : '#2E7D32',
    },
    progressBarTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      marginVertical: 6,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: isDark ? c.accentBlue : '#1E88E5',
    },
    progressBarFillDone: {
      backgroundColor: isDark ? '#81C784' : '#2E7D32',
    },
    planTotalsRow: {
      marginTop: 2,
    },
    planTotalsText: {
      fontSize: 11,
      color: c.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    planHeading: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textSecondary,
      marginBottom: 2,
    },
    planRestLine: {
      fontSize: 12,
      color: c.textSecondary,
      marginBottom: 10,
    },
    prescribedCard: {
      padding: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(142, 155, 255, 0.4)' : 'rgba(31, 61, 92, 0.2)',
      backgroundColor: isDark ? 'rgba(142, 155, 255, 0.08)' : 'rgba(31, 61, 92, 0.04)',
      marginBottom: 8,
    },
    prescribedCardCompleted: {
      borderColor: isDark ? 'rgba(76, 175, 80, 0.5)' : 'rgba(46, 125, 50, 0.3)',
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.06)',
    },
    prescribedCardPressed: {
      opacity: 0.8,
    },
    prescribedHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    prescribedTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textPrimary,
      flex: 1,
    },
    activityMeterTrack: {
      height: 5,
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
      marginTop: 6,
      marginBottom: 4,
      overflow: 'hidden',
    },
    activityMeterFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: isDark ? 'rgba(142, 155, 255, 0.4)' : 'rgba(31, 61, 92, 0.3)',
    },
    activityMeterFillDone: {
      backgroundColor: isDark ? '#81C784' : '#2E7D32',
    },
    activityMeterNumbersRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 6,
    },
    activityMeterPct: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? c.accentBlue : '#1F3D5C',
      fontVariant: ['tabular-nums'],
    },
    activityMeterPctDone: {
      color: isDark ? '#81C784' : '#2E7D32',
    },
    prescribedMeta: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? c.accentBlue : '#1F3D5C',
      fontVariant: ['tabular-nums'],
      flex: 1,
    },
    prescribedActionChip: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? c.accentBlue : '#1F3D5C',
      backgroundColor: isDark ? 'rgba(142, 155, 255, 0.2)' : 'rgba(31, 61, 92, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      overflow: 'hidden',
    },
    prescribedActionChipDone: {
      color: isDark ? '#81C784' : '#2E7D32',
      backgroundColor: isDark ? 'rgba(76, 175, 80, 0.2)' : 'rgba(76, 175, 80, 0.12)',
    },
    prescribedNotes: {
      fontSize: 11,
      color: c.textSecondary,
      marginTop: 4,
      lineHeight: 15,
    },
  });
