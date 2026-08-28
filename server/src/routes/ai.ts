/**
 * Phone Gemini proxy (be-40). The app sends the raw generateContent body plus a
 * wallet reason; the server holds the key, debits the payer, and passes the
 * Google response through.
 *
 * PRIVACY: bodies carry patient health data — never log request or response
 * contents on this route. Only usage metadata is persisted (ai_usage_events).
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import { resolveAiPayer } from '../services/sponsor.js';
import { ensureWallet, getBalance } from '../services/wallet.js';
import { ensurePayerBalance } from '../services/payments.js';
import { tokensForReason } from '../services/aiBilling.js';
import { meterAiUsageResult, type AiUsageReason } from '../services/usage.js';
import { forwardGeminiGenerate } from '../services/geminiProxy.js';

/** Meal photos / lab PDFs travel as inline base64 — well above the 1 MiB default. */
const AI_BODY_LIMIT_BYTES = 15 * 1024 * 1024;

const reasonSchema = z.enum([
  'ai_meal',
  'ai_chat',
  'ai_coach',
  'ai_macro',
  'ai_rules',
  'ai_lab',
  'ai_help',
  'ai_other',
]);

const requestSchema = z.object({
  clientEventId: z.string().uuid(),
  reason: reasonSchema,
  body: z.object({
    contents: z.array(z.unknown()).min(1).max(256),
    generationConfig: z.record(z.unknown()).optional(),
  }),
});

export async function registerAiRoutes(app: FastifyInstance) {
  app.post(
    '/v1/ai/generate',
    {
      preHandler: authenticate,
      bodyLimit: AI_BODY_LIMIT_BYTES,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = requestSchema.parse(request.body);
      const reason = parsed.reason as AiUsageReason;

      const user = await findUserById(request.userId!);
      if (!user) return reply.code(404).send({ error: 'User not found' });
      if (user.role !== 'patient') {
        return reply.code(403).send({ error: 'Requires patient role' });
      }

      // Balance gate before touching Google. debitAiUsage never blocks (auto-
      // reload, comped while BILLING_LIVE=false), so 402 only fires when a
      // reload genuinely cannot cover the cost.
      const cost = tokensForReason(reason);
      const payer = await resolveAiPayer(user.id);
      await ensureWallet(payer.payerUserId);
      let balance = await getBalance(payer.payerUserId);
      if (balance < cost) {
        await ensurePayerBalance(payer.payerUserId, cost);
        balance = await getBalance(payer.payerUserId);
        if (balance < cost) {
          return reply.code(402).send({ error: 'out_of_credits' });
        }
      }

      const result = await forwardGeminiGenerate(
        parsed.body as { contents: unknown[]; generationConfig?: Record<string, unknown> },
      );
      if (result.status !== 200 || result.json == null) {
        // No body detail — upstream errors can echo request content.
        return reply.code(502).send({ error: 'ai_upstream_error', upstreamStatus: result.status });
      }

      // Exactly-once debit via clientEventId; a duplicate means a client retry
      // of an already-metered call — return the response without re-debiting.
      const metered = await meterAiUsageResult(user.id, reason, undefined, result.usage, {
        clientEventId: parsed.clientEventId,
      });
      const balanceAfter = metered.event?.balanceAfter ?? (await getBalance(payer.payerUserId));

      return {
        response: result.json,
        wallet: { balanceTokens: balanceAfter, sponsored: payer.sponsored },
      };
    },
  );
}
