/**
 * Training program & activity macros persistence (be-58).
 * Stores trainer prescribed programs, weekly activity macro targets, and daily split schedules.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const TRAINING_PROGRAM_KEY = 'healthings:trainingProgram';

export type WorkoutSplitType = 'strength' | 'cardio' | 'hiit' | 'mobility' | 'rest';
export type TrainingTimeSlot = 'morning' | 'noon' | 'evening' | 'anytime';
/** Which wearable/manual session satisfies this prescription without a manual tap. */
export type TrainingMatchType = 'bike' | 'walk' | 'run' | 'gym' | 'any';

export interface PrescribedActivitySession {
  id: string;
  timeSlot: TrainingTimeSlot;
  workoutType: WorkoutSplitType;
  title: string;
  durationMinutes: number;
  targetKcal: number;
  targetDistanceM?: number;
  targetDistanceKm?: number;
  targetZone2Minutes?: number;
  notes?: string;
  matchType?: TrainingMatchType;
}

export interface PrescribedWorkoutDay {
  dayName: string; // 'Sunday', 'Monday', etc.
  dayFocus?: string;
  activities?: PrescribedActivitySession[];
  /** Legacy single-session fields, kept so old stored programs still read. */
  workoutType?: WorkoutSplitType;
  title?: string;
  durationMinutes?: number;
  targetKcal?: number;
  targetZone2Minutes?: number;
  notes?: string;
}

export interface TrainingProgramPrescription {
  id: string;
  mentorId: string;
  title: string;
  description?: string;
  targetSessionsPerWeek: number;
  targetActiveBurnWeekly: number;
  targetZone2MinutesWeekly: number;
  targetDailySteps: number;
  schedule: PrescribedWorkoutDay[];
  startDate?: string;
  updatedAt: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function loadActiveTrainingProgram(): Promise<TrainingProgramPrescription | null> {
  try {
    const raw = await AsyncStorage.getItem(TRAINING_PROGRAM_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TrainingProgramPrescription;
  } catch (err) {
    console.warn('Failed to load training program:', err);
    return null;
  }
}

export async function saveActiveTrainingProgram(
  program: TrainingProgramPrescription,
): Promise<void> {
  try {
    await AsyncStorage.setItem(TRAINING_PROGRAM_KEY, JSON.stringify(program));
  } catch (err) {
    console.warn('Failed to save training program:', err);
  }
}

export async function clearActiveTrainingProgram(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TRAINING_PROGRAM_KEY);
  } catch (err) {
    console.warn('Failed to clear training program:', err);
  }
}

/**
 * Resolves the prescribed day for a date from the active weekly schedule.
 */
export function getTodayPrescribedWorkout(
  program: TrainingProgramPrescription | null,
  date: Date = new Date(),
): PrescribedWorkoutDay | null {
  if (!program || !Array.isArray(program.schedule) || !program.schedule.length) {
    return null;
  }

  const dayIndex = date.getDay(); // 0 = Sunday … 6 = Saturday
  const todayName = DAY_NAMES[dayIndex];

  const matched = program.schedule.find(
    (d) => (d.dayName || '').toLowerCase() === todayName.toLowerCase(),
  );

  return matched || program.schedule[dayIndex] || null;
}

/**
 * Flattens a day into discrete sessions. Programs written before multi-activity
 * carried one workout on the day object; those become a single-element list so
 * every caller renders one shape.
 */
export function getPrescribedActivities(
  day: PrescribedWorkoutDay | null,
): PrescribedActivitySession[] {
  if (!day) return [];

  if (Array.isArray(day.activities)) {
    return day.activities
      .filter((a) => a && (a.workoutType !== 'rest' || (a.durationMinutes || 0) > 0))
      .map((a, i) => ({
        id: a.id || `${(day.dayName || 'day').toLowerCase()}-${i}`,
        timeSlot: a.timeSlot || 'anytime',
        workoutType: a.workoutType || 'cardio',
        title: a.title || '',
        durationMinutes: Number(a.durationMinutes) || 0,
        targetKcal: Number(a.targetKcal) || 0,
        targetZone2Minutes: Number(a.targetZone2Minutes) || 0,
        notes: a.notes || '',
        matchType: a.matchType || 'any',
      }));
  }

  if (!day.workoutType || day.workoutType === 'rest') return [];
  return [
    {
      id: `${(day.dayName || 'day').toLowerCase()}-0`,
      timeSlot: 'anytime',
      workoutType: day.workoutType,
      title: day.title || '',
      durationMinutes: Number(day.durationMinutes) || 0,
      targetKcal: Number(day.targetKcal) || 0,
      targetZone2Minutes: Number(day.targetZone2Minutes) || 0,
      notes: day.notes || '',
      matchType: 'any',
    },
  ];
}

const SLOT_ORDER: Record<TrainingTimeSlot, number> = {
  morning: 0,
  noon: 1,
  evening: 2,
  anytime: 3,
};

export function sortActivitiesByTimeSlot(
  activities: PrescribedActivitySession[],
): PrescribedActivitySession[] {
  return [...activities].sort((a, b) => SLOT_ORDER[a.timeSlot] - SLOT_ORDER[b.timeSlot]);
}

/**
 * Withings numeric activity categories we can map to a prescription match type.
 * 1 = walk, 2 = run, 187/306 = bike. Health Connect rows arrive with the same
 * numeric category assigned by the adapter.
 */
const BIKE_CATEGORIES = new Set([187, 306, 307]);
const WALK_CATEGORIES = new Set([1, 3]);
const RUN_CATEGORIES = new Set([2]);

function labelMatches(label: string, needles: string[]): boolean {
  const l = label.toLowerCase();
  return needles.some((n) => l.includes(n));
}

/** Which prescription a logged/wearable session can satisfy. */
export function resolveSessionMatchType(session: {
  category?: number;
  activityLabel?: string;
  name?: string;
}): TrainingMatchType {
  const category = session.category;
  if (typeof category === 'number') {
    if (BIKE_CATEGORIES.has(category)) return 'bike';
    if (RUN_CATEGORIES.has(category)) return 'run';
    if (WALK_CATEGORIES.has(category)) return 'walk';
  }

  const label = session.activityLabel || session.name || '';
  if (labelMatches(label, ['bike', 'bicycl', 'cycl', 'ride', 'אופני', 'רכיב'])) return 'bike';
  if (labelMatches(label, ['run', 'jog', 'ריצה'])) return 'run';
  if (labelMatches(label, ['walk', 'hike', 'step', 'הליכ'])) return 'walk';
  if (labelMatches(label, ['gym', 'strength', 'weight', 'lift', 'כוח', 'חדר כושר'])) return 'gym';
  return 'any';
}
