import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  listTrainingPrograms,
  getTrainingProgram,
  createTrainingProgram,
  updateTrainingProgram,
  deleteTrainingProgram,
  assignProgramToPatients,
  getActivePatientAssignment,
  type TrainingWorkoutDay,
} from '../services/trainingPrograms.js';

export async function registerTrainingRoutes(app: FastifyInstance) {
  // ── Trainer Program Templates CRUD ──────────────────────────────────────────

  app.get('/v1/clinic/training/programs', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'mentor') {
      return reply.code(403).send({ error: 'Only clinic/coach accounts have training programs' });
    }

    const programs = await listTrainingPrograms(user.id);
    return { programs };
  });

  app.get('/v1/clinic/training/programs/:id', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'mentor') {
      return reply.code(403).send({ error: 'Only clinic/coach accounts have training programs' });
    }

    const program = await getTrainingProgram(user.id, params.id);
    if (!program) return reply.code(404).send({ error: 'Training program not found' });
    return { program };
  });

  const workoutDaySchema = z.object({
    dayName: z.string().min(1).max(50),
    workoutType: z.enum(['strength', 'cardio', 'hiit', 'mobility', 'rest']),
    title: z.string().max(100).default(''),
    durationMinutes: z.number().int().min(0).max(360).default(0),
    targetKcal: z.number().int().min(0).max(3000).default(0),
    targetZone2Minutes: z.number().int().min(0).max(360).optional().default(0),
    notes: z.string().max(1000).optional().default(''),
  });

  app.post('/v1/clinic/training/programs', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'mentor') {
      return reply.code(403).send({ error: 'Only clinic/coach accounts can create training programs' });
    }

    const schema = z.object({
      title: z.string().min(1).max(255),
      description: z.string().max(2000).optional(),
      targetSessionsPerWeek: z.number().int().min(1).max(14).optional(),
      targetActiveBurnWeekly: z.number().int().min(0).max(20000).optional(),
      targetZone2MinutesWeekly: z.number().int().min(0).max(1000).optional(),
      targetDailySteps: z.number().int().min(1000).max(50000).optional(),
      schedule: z.array(workoutDaySchema).optional(),
      isTemplate: z.boolean().optional(),
    });

    const body = schema.parse(request.body);
    const program = await createTrainingProgram(user.id, body as {
      title: string;
      description?: string;
      targetSessionsPerWeek?: number;
      targetActiveBurnWeekly?: number;
      targetZone2MinutesWeekly?: number;
      targetDailySteps?: number;
      schedule?: TrainingWorkoutDay[];
      isTemplate?: boolean;
    });

    return reply.code(201).send({ program });
  });

  app.put('/v1/clinic/training/programs/:id', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'mentor') {
      return reply.code(403).send({ error: 'Only clinic/coach accounts can update training programs' });
    }

    const schema = z.object({
      title: z.string().min(1).max(255).optional(),
      description: z.string().max(2000).optional(),
      targetSessionsPerWeek: z.number().int().min(1).max(14).optional(),
      targetActiveBurnWeekly: z.number().int().min(0).max(20000).optional(),
      targetZone2MinutesWeekly: z.number().int().min(0).max(1000).optional(),
      targetDailySteps: z.number().int().min(1000).max(50000).optional(),
      schedule: z.array(workoutDaySchema).optional(),
      isTemplate: z.boolean().optional(),
    });

    const body = schema.parse(request.body);
    const program = await updateTrainingProgram(user.id, params.id, body as {
      title?: string;
      description?: string;
      targetSessionsPerWeek?: number;
      targetActiveBurnWeekly?: number;
      targetZone2MinutesWeekly?: number;
      targetDailySteps?: number;
      schedule?: TrainingWorkoutDay[];
      isTemplate?: boolean;
    });

    if (!program) return reply.code(404).send({ error: 'Training program not found' });
    return { program };
  });

  app.delete('/v1/clinic/training/programs/:id', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'mentor') {
      return reply.code(403).send({ error: 'Only clinic/coach accounts can delete training programs' });
    }

    const deleted = await deleteTrainingProgram(user.id, params.id);
    if (!deleted) return reply.code(404).send({ error: 'Training program not found' });
    return { success: true };
  });

  // ── Assignment & Patient Integration ────────────────────────────────────────

  app.post('/v1/clinic/training/assign', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'mentor') {
      return reply.code(403).send({ error: 'Only clinic/coach accounts can assign programs' });
    }

    const schema = z.object({
      programId: z.string().uuid(),
      patientIds: z.array(z.string().uuid()).min(1),
      customAdjustments: z.record(z.unknown()).optional(),
    });

    const body = schema.parse(request.body);
    const result = await assignProgramToPatients(user.id, body.programId, body.patientIds, body.customAdjustments);
    return { success: true, count: result.count };
  });

  app.get('/v1/clinic/patients/:patientId/training', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    // Can be queried by acting mentor, or by the patient themselves
    const isMentor = user.role === 'mentor';
    const assignment = await getActivePatientAssignment(params.patientId, isMentor ? user.id : undefined);
    return { assignment };
  });

  app.get('/v1/patient/training/active', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const assignment = await getActivePatientAssignment(user.id);
    return { assignment };
  });
}
