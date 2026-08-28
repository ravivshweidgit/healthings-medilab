/**
 * Training program & activity macros persistence (be-58).
 * Stores trainer prescribed programs, weekly activity macro targets, and daily split schedules.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const TRAINING_PROGRAM_KEY = 'healthings:trainingProgram';

export type WorkoutSplitType = 'strength' | 'cardio' | 'hiit' | 'mobility' | 'rest';

export interface PrescribedWorkoutDay {
  dayName: string; // 'Sunday', 'Monday', etc.
  workoutType: WorkoutSplitType;
  title: string;
  durationMinutes: number;
  targetKcal: number;
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
 * Resolves today's prescribed workout from the active weekly schedule.
 */
export function getTodayPrescribedWorkout(
  program: TrainingProgramPrescription | null,
  date: Date = new Date(),
): PrescribedWorkoutDay | null {
  if (!program || !Array.isArray(program.schedule) || !program.schedule.length) {
    return null;
  }

  const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[dayIndex];

  const matched = program.schedule.find(
    (d) => d.dayName.toLowerCase() === todayName.toLowerCase(),
  );

  return matched || program.schedule[dayIndex] || null;
}
