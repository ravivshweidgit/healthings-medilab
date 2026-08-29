import { pool } from '../db/pool.js';

export type TrainingTimeSlot = 'morning' | 'noon' | 'evening' | 'anytime';
export type TrainingWorkoutType = 'strength' | 'cardio' | 'hiit' | 'mobility' | 'rest';
/** Which wearable/manual session can satisfy this prescription without a manual tap. */
export type TrainingMatchType = 'bike' | 'walk' | 'run' | 'gym' | 'any';

export interface PrescribedActivitySession {
  id: string;
  timeSlot: TrainingTimeSlot;
  workoutType: TrainingWorkoutType;
  title: string;
  durationMinutes: number;
  targetKcal: number;
  targetDistanceKm?: number;
  targetZone2Minutes?: number;
  notes?: string;
  matchType?: TrainingMatchType;
}

export interface TrainingWorkoutDay {
  dayName: string; // 'Sunday', 'Monday', etc. or 'Day 1'
  dayFocus?: string;
  activities?: PrescribedActivitySession[];
  /** Legacy single-session fields (pre multi-activity). Read for migration only. */
  workoutType?: TrainingWorkoutType;
  title?: string;
  durationMinutes?: number;
  targetKcal?: number;
  targetZone2Minutes?: number;
  notes?: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Programs saved before multi-activity carried one workout per day on the day object.
 * Lift those into a single-element activities array so every reader sees one shape.
 */
export function normalizeSchedule(raw: unknown): TrainingWorkoutDay[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, idx) => {
    const day = (entry ?? {}) as TrainingWorkoutDay;
    const dayName = day.dayName || DAY_NAMES[idx] || `Day ${idx + 1}`;
    if (Array.isArray(day.activities)) {
      return {
        dayName,
        dayFocus: day.dayFocus || '',
        activities: day.activities.map((a, i) => ({
          id: a.id || `${dayName.toLowerCase()}-${i}`,
          timeSlot: a.timeSlot || 'anytime',
          workoutType: a.workoutType || 'cardio',
          title: a.title || '',
          durationMinutes: Number(a.durationMinutes) || 0,
          targetKcal: Number(a.targetKcal) || 0,
          targetDistanceKm: Number.isFinite(Number(a.targetDistanceKm)) ? Number(a.targetDistanceKm) : 0,
          targetZone2Minutes: Number(a.targetZone2Minutes) || 0,
          notes: a.notes || '',
          matchType: a.matchType || 'any',
        })),
      };
    }

    const legacyType = day.workoutType || 'rest';
    return {
      dayName,
      dayFocus: day.title || '',
      activities:
        legacyType === 'rest' && !Number(day.durationMinutes)
          ? []
          : [
              {
                id: `${dayName.toLowerCase()}-0`,
                timeSlot: 'anytime' as TrainingTimeSlot,
                workoutType: legacyType,
                title: day.title || '',
                durationMinutes: Number(day.durationMinutes) || 0,
                targetKcal: Number(day.targetKcal) || 0,
                targetZone2Minutes: Number(day.targetZone2Minutes) || 0,
                notes: day.notes || '',
                matchType: 'any' as TrainingMatchType,
              },
            ],
    };
  });
}

export interface TrainingProgram {
  id: string;
  mentorId: string;
  title: string;
  description: string;
  targetSessionsPerWeek: number;
  targetActiveBurnWeekly: number;
  targetZone2MinutesWeekly: number;
  targetDailySteps: number;
  schedule: TrainingWorkoutDay[];
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingAssignment {
  id: string;
  programId: string;
  patientId: string;
  mentorId: string;
  customAdjustments: Record<string, unknown>;
  startDate: string;
  active: boolean;
  program?: TrainingProgram;
  createdAt: string;
  updatedAt: string;
}

export async function listTrainingPrograms(mentorId: string): Promise<TrainingProgram[]> {
  const res = await pool.query(
    `SELECT id, mentor_id, title, description,
            target_sessions_per_week, target_active_burn_weekly,
            target_zone2_minutes_weekly, target_daily_steps,
            schedule_json, is_template, created_at, updated_at
     FROM training_programs
     WHERE mentor_id = $1
     ORDER BY created_at DESC`,
    [mentorId],
  );

  return res.rows.map((row) => ({
    id: row.id,
    mentorId: row.mentor_id,
    title: row.title,
    description: row.description || '',
    targetSessionsPerWeek: Number(row.target_sessions_per_week || 3),
    targetActiveBurnWeekly: Number(row.target_active_burn_weekly || 2500),
    targetZone2MinutesWeekly: Number(row.target_zone2_minutes_weekly || 120),
    targetDailySteps: Number(row.target_daily_steps || 8000),
    schedule: normalizeSchedule(row.schedule_json),
    isTemplate: Boolean(row.is_template),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

export async function getTrainingProgram(mentorId: string, programId: string): Promise<TrainingProgram | null> {
  const res = await pool.query(
    `SELECT id, mentor_id, title, description,
            target_sessions_per_week, target_active_burn_weekly,
            target_zone2_minutes_weekly, target_daily_steps,
            schedule_json, is_template, created_at, updated_at
     FROM training_programs
     WHERE id = $1 AND mentor_id = $2`,
    [programId, mentorId],
  );

  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    mentorId: row.mentor_id,
    title: row.title,
    description: row.description || '',
    targetSessionsPerWeek: Number(row.target_sessions_per_week || 3),
    targetActiveBurnWeekly: Number(row.target_active_burn_weekly || 2500),
    targetZone2MinutesWeekly: Number(row.target_zone2_minutes_weekly || 120),
    targetDailySteps: Number(row.target_daily_steps || 8000),
    schedule: normalizeSchedule(row.schedule_json),
    isTemplate: Boolean(row.is_template),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function createTrainingProgram(
  mentorId: string,
  data: {
    title: string;
    description?: string;
    targetSessionsPerWeek?: number;
    targetActiveBurnWeekly?: number;
    targetZone2MinutesWeekly?: number;
    targetDailySteps?: number;
    schedule?: TrainingWorkoutDay[];
    isTemplate?: boolean;
  },
): Promise<TrainingProgram> {
  const title = data.title.trim();
  const description = (data.description || '').trim();
  const sessions = data.targetSessionsPerWeek ?? 3;
  const burn = data.targetActiveBurnWeekly ?? 2500;
  const z2 = data.targetZone2MinutesWeekly ?? 120;
  const steps = data.targetDailySteps ?? 8000;
  const schedule = normalizeSchedule(data.schedule || []);
  const isTemplate = data.isTemplate ?? true;

  const res = await pool.query(
    `INSERT INTO training_programs (
       mentor_id, title, description,
       target_sessions_per_week, target_active_burn_weekly,
       target_zone2_minutes_weekly, target_daily_steps,
       schedule_json, is_template
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, mentor_id, title, description,
               target_sessions_per_week, target_active_burn_weekly,
               target_zone2_minutes_weekly, target_daily_steps,
               schedule_json, is_template, created_at, updated_at`,
    [mentorId, title, description, sessions, burn, z2, steps, JSON.stringify(schedule), isTemplate],
  );

  const row = res.rows[0];
  return {
    id: row.id,
    mentorId: row.mentor_id,
    title: row.title,
    description: row.description || '',
    targetSessionsPerWeek: Number(row.target_sessions_per_week),
    targetActiveBurnWeekly: Number(row.target_active_burn_weekly),
    targetZone2MinutesWeekly: Number(row.target_zone2_minutes_weekly),
    targetDailySteps: Number(row.target_daily_steps),
    schedule: normalizeSchedule(row.schedule_json),
    isTemplate: Boolean(row.is_template),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function updateTrainingProgram(
  mentorId: string,
  programId: string,
  data: {
    title?: string;
    description?: string;
    targetSessionsPerWeek?: number;
    targetActiveBurnWeekly?: number;
    targetZone2MinutesWeekly?: number;
    targetDailySteps?: number;
    schedule?: TrainingWorkoutDay[];
    isTemplate?: boolean;
  },
): Promise<TrainingProgram | null> {
  const current = await getTrainingProgram(mentorId, programId);
  if (!current) return null;

  const title = data.title !== undefined ? data.title.trim() : current.title;
  const description = data.description !== undefined ? data.description.trim() : current.description;
  const sessions = data.targetSessionsPerWeek !== undefined ? data.targetSessionsPerWeek : current.targetSessionsPerWeek;
  const burn = data.targetActiveBurnWeekly !== undefined ? data.targetActiveBurnWeekly : current.targetActiveBurnWeekly;
  const z2 = data.targetZone2MinutesWeekly !== undefined ? data.targetZone2MinutesWeekly : current.targetZone2MinutesWeekly;
  const steps = data.targetDailySteps !== undefined ? data.targetDailySteps : current.targetDailySteps;
  const schedule = data.schedule !== undefined ? normalizeSchedule(data.schedule) : current.schedule;
  const isTemplate = data.isTemplate !== undefined ? data.isTemplate : current.isTemplate;

  const res = await pool.query(
    `UPDATE training_programs
     SET title = $1,
         description = $2,
         target_sessions_per_week = $3,
         target_active_burn_weekly = $4,
         target_zone2_minutes_weekly = $5,
         target_daily_steps = $6,
         schedule_json = $7,
         is_template = $8,
         updated_at = NOW()
     WHERE id = $9 AND mentor_id = $10
     RETURNING id, mentor_id, title, description,
               target_sessions_per_week, target_active_burn_weekly,
               target_zone2_minutes_weekly, target_daily_steps,
               schedule_json, is_template, created_at, updated_at`,
    [title, description, sessions, burn, z2, steps, JSON.stringify(schedule), isTemplate, programId, mentorId],
  );

  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    mentorId: row.mentor_id,
    title: row.title,
    description: row.description || '',
    targetSessionsPerWeek: Number(row.target_sessions_per_week),
    targetActiveBurnWeekly: Number(row.target_active_burn_weekly),
    targetZone2MinutesWeekly: Number(row.target_zone2_minutes_weekly),
    targetDailySteps: Number(row.target_daily_steps),
    schedule: normalizeSchedule(row.schedule_json),
    isTemplate: Boolean(row.is_template),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function deleteTrainingProgram(mentorId: string, programId: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM training_programs WHERE id = $1 AND mentor_id = $2`,
    [programId, mentorId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function assignProgramToPatients(
  mentorId: string,
  programId: string,
  patientIds: string[],
  customAdjustments?: Record<string, unknown>,
): Promise<{ count: number }> {
  // Ensure program belongs to mentor
  const prog = await getTrainingProgram(mentorId, programId);
  if (!prog) throw new Error('Training program not found');

  let assignedCount = 0;
  for (const patientId of patientIds) {
    // Deactivate current active assignments from this mentor for this patient
    await pool.query(
      `UPDATE training_assignments
       SET active = FALSE, updated_at = NOW()
       WHERE patient_id = $1 AND mentor_id = $2 AND active = TRUE`,
      [patientId, mentorId],
    );

    await pool.query(
      `INSERT INTO training_assignments (
         program_id, patient_id, mentor_id, custom_adjustments_json, start_date, active
       )
       VALUES ($1, $2, $3, $4, CURRENT_DATE, TRUE)`,
      [programId, patientId, mentorId, JSON.stringify(customAdjustments || {})],
    );
    assignedCount++;
  }

  return { count: assignedCount };
}

export async function getActivePatientAssignment(
  patientId: string,
  mentorId?: string,
): Promise<TrainingAssignment | null> {
  const query = mentorId
    ? `SELECT a.id, a.program_id, a.patient_id, a.mentor_id, a.custom_adjustments_json,
              a.start_date, a.active, a.created_at, a.updated_at,
              p.title as p_title, p.description as p_desc,
              p.target_sessions_per_week as p_sessions,
              p.target_active_burn_weekly as p_burn,
              p.target_zone2_minutes_weekly as p_z2,
              p.target_daily_steps as p_steps,
              p.schedule_json as p_schedule
       FROM training_assignments a
       JOIN training_programs p ON a.program_id = p.id
       WHERE a.patient_id = $1 AND a.mentor_id = $2 AND a.active = TRUE
       ORDER BY a.created_at DESC LIMIT 1`
    : `SELECT a.id, a.program_id, a.patient_id, a.mentor_id, a.custom_adjustments_json,
              a.start_date, a.active, a.created_at, a.updated_at,
              p.title as p_title, p.description as p_desc,
              p.target_sessions_per_week as p_sessions,
              p.target_active_burn_weekly as p_burn,
              p.target_zone2_minutes_weekly as p_z2,
              p.target_daily_steps as p_steps,
              p.schedule_json as p_schedule
       FROM training_assignments a
       JOIN training_programs p ON a.program_id = p.id
       WHERE a.patient_id = $1 AND a.active = TRUE
       ORDER BY a.created_at DESC LIMIT 1`;

  const params = mentorId ? [patientId, mentorId] : [patientId];
  const res = await pool.query(query, params);
  if (res.rowCount === 0) return null;

  const row = res.rows[0];
  return {
    id: row.id,
    programId: row.program_id,
    patientId: row.patient_id,
    mentorId: row.mentor_id,
    customAdjustments: row.custom_adjustments_json || {},
    startDate: row.start_date ? new Date(row.start_date).toISOString().slice(0, 10) : '',
    active: Boolean(row.active),
    program: {
      id: row.program_id,
      mentorId: row.mentor_id,
      title: row.p_title,
      description: row.p_desc || '',
      targetSessionsPerWeek: Number(row.p_sessions || 3),
      targetActiveBurnWeekly: Number(row.p_burn || 2500),
      targetZone2MinutesWeekly: Number(row.p_z2 || 120),
      targetDailySteps: Number(row.p_steps || 8000),
      schedule: normalizeSchedule(row.p_schedule),
      isTemplate: false,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    },
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
