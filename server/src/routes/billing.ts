import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import { createCheckoutSession, handleStripeWebhook } from '../services/payments.js';

export async function registerBillingRoutes(app: FastifyInstance) {
  /**
   * Stripe Checkout (setup mode) — save a card for off-session auto-reload.
   * Returns 503 when Stripe is not configured (alpha dark path).
   */
  app.post('/v1/billing/checkout-session', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const session = await createCheckoutSession(user.id);
    if (!session) {
      return reply.code(503).send({
        error: 'Card checkout is not available yet. Stripe is not configured on this server.',
      });
    }
    return { url: session.url };
  });

  /**
   * Stripe webhook — raw body required for signature verify.
   * Global JSON parser stores the original string on request.rawBody.
   */
  app.post('/v1/billing/stripe/webhook', async (request, reply) => {
    const withRaw = request as unknown as { rawBody?: string; body?: unknown };
    const raw =
      typeof withRaw.rawBody === 'string'
        ? withRaw.rawBody
        : typeof withRaw.body === 'string'
          ? withRaw.body
          : JSON.stringify(withRaw.body ?? {});

    const signature = request.headers['stripe-signature'];
    const sigHeader = Array.isArray(signature) ? signature[0] : signature;

    const result = await handleStripeWebhook(raw, sigHeader);
    if (!result.ok) {
      return reply.code(result.status).send({ error: result.error });
    }
    return { received: true };
  });
}
