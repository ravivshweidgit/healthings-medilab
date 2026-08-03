import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { isAdminEmail } from '../config.js';
import { findUserById } from '../services/users.js';
import { getWalletForUser } from '../services/wallet.js';
import {
  getActiveUsageByPatient,
  getMarginReport,
  getMentorUsageSummary,
  getPatientUsageTotal,
  getUsageEventsForPayer,
  meterAiUsage,
  meterAiUsageResult,
  type AiUsageReason,
} from '../services/usage.js';

const usageReasonSchema = z.enum([
  'ai_meal',
  'ai_chat',
  'ai_coach',
  'ai_macro',
  'ai_rules',
  'ai_lab',
  'ai_help',
  'ai_other',
]);

const geminiSchema = z
  .object({
    promptTokens: z.number().int().nonnegative(),
    candidatesTokens: z.number().int().nonnegative(),
    thoughtsTokens: z.number().int().nonnegative().default(0),
    totalTokens: z.number().int().nonnegative(),
    model: z.string().max(64),
  })
  .optional();

export async function registerUsageRoutes(app: FastifyInstance) {
  /** Legacy per-call report — kept for older app builds. Prefer /v1/usage/ai/batch. */
  app.post('/v1/usage/ai', { preHandler: authenticate }, async (request, reply) => {
    const body = z
      .object({
        reason: usageReasonSchema,
        tokens: z.number().int().positive().optional(),
        /** Real Gemini usageMetadata from the phone call — analytics only. */
        gemini: geminiSchema,
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

  /**
   * Phone prepaid-bucket flush (be-33). At-least-once client delivery;
   * `clientEventId` makes settlement exactly-once. Returns payer-aware wallet
   * so the phone adopts authoritative `balanceTokens` as creditsLeft.
   */
  app.post('/v1/usage/ai/batch', { preHandler: authenticate }, async (request, reply) => {
    const body = z
      .object({
        events: z
          .array(
            z.object({
              clientEventId: z.string().uuid(),
              reason: usageReasonSchema,
              tokens: z.number().int().positive().optional(),
              gemini: geminiSchema,
              occurredAt: z.string().datetime().optional(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(request.body);

    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'patient') {
      return reply.code(403).send({ error: 'Requires patient role' });
    }

    let recorded = 0;
    let duplicates = 0;
    for (const ev of body.events) {
      const result = await meterAiUsageResult(
        user.id,
        ev.reason as AiUsageReason,
        ev.tokens,
        ev.gemini ?? null,
        { clientEventId: ev.clientEventId, occurredAt: ev.occurredAt ?? null },
      );
      if (result.duplicate) duplicates += 1;
      else recorded += 1;
    }

    const wallet = await getWalletForUser(user.id, 'patient');
    return { recorded, duplicates, wallet };
  });

  /**
   * Platform-wide revenue vs estimated Gemini COGS (be-35, admin-gated be-37).
   * Unit economics — server-side allowlist, never mentor-visible. Rates are
   * config estimates, not live Google billing.
   */
  app.get('/v1/usage/margin', { preHandler: authenticate }, async (request, reply) => {
    const q = z
      .object({ days: z.coerce.number().int().positive().max(90).optional() })
      .parse(request.query);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (!isAdminEmail(user.email)) {
      return reply.code(403).send({ error: 'Admin only' });
    }
    const margin = await getMarginReport(null, q.days ?? 30);
    return { margin };
  });

  /**
   * Who used AI in a window — all patients (admin only).
   * Pass local-day `from`/`to` ISO from the browser so "today" matches the operator clock.
   */
  app.get('/v1/usage/active', { preHandler: authenticate }, async (request, reply) => {
    const q = z
      .object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .parse(request.query);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (!isAdminEmail(user.email)) {
      return reply.code(403).send({ error: 'Admin only' });
    }
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from
      ? new Date(q.from)
      : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    const patients = await getActiveUsageByPatient(from, to);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      patients,
    };
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
