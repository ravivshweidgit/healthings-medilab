import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  getMentorUsageSummary,
  getPatientUsageTotal,
  getUsageEventsForPayer,
  meterAiUsage,
  type AiUsageReason,
} from '../services/usage.js';

const usageReasonSchema = z.enum([
  'ai_meal',
  'ai_chat',
  'ai_coach',
  'ai_macro',
  'ai_rules',
  'ai_lab',
  'ai_other',
]);

export async function registerUsageRoutes(app: FastifyInstance) {
  app.post('/v1/usage/ai', { preHandler: authenticate }, async (request, reply) => {
    const body = z
      .object({
        reason: usageReasonSchema,
        tokens: z.number().int().positive().optional(),
        /** Real Gemini usageMetadata from the phone call — analytics only. */
        gemini: z
          .object({
            promptTokens: z.number().int().nonnegative(),
            candidatesTokens: z.number().int().nonnegative(),
            thoughtsTokens: z.number().int().nonnegative().default(0),
            totalTokens: z.number().int().nonnegative(),
            model: z.string().max(64),
          })
          .optional(),
      })
      .parse(request.body);

    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'patient') {
      return reply.code(403).send({ error: 'Requires patient role' });
    }

    const event = await meterAiUsage(user.id, body.reason as AiUsageReason, body.tokens, body.gemini ?? null);
    return { event };
  });

  /** Recent per-event AI usage paid by the caller (mentor or patient). */
  app.get('/v1/usage/events', { preHandler: authenticate }, async (request, reply) => {
    const q = z
      .object({ limit: z.coerce.number().int().positive().max(200).optional() })
      .parse(request.query);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const events = await getUsageEventsForPayer(user.id, q.limit ?? 50);
    return { events };
  });

  app.get('/v1/usage/summary', { preHandler: authenticate }, async (request, reply) => {
    const query = z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(request.query);

    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    if (user.role === 'mentor') {
      const rows = await getMentorUsageSummary(user.id, from, to);
      const totalTokens = rows.reduce((sum, r) => sum + r.totalTokens, 0);
      return { role: 'mentor', from: query.from ?? null, to: query.to ?? null, totalTokens, byPatient: rows };
    }

    const totalTokens = await getPatientUsageTotal(user.id, from, to);
    return { role: 'patient', from: query.from ?? null, to: query.to ?? null, totalTokens };
  });
}
