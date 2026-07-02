import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { config } from '../config.js';
import { findUserById } from '../services/users.js';
import { attachSimulatedPaymentMethod, autoReloadTokenPack } from '../services/payments.js';
import { getWalletForUser, grantTokenPack } from '../services/wallet.js';

export async function registerWalletRoutes(app: FastifyInstance) {
  app.get('/v1/wallet', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const wallet = await getWalletForUser(user.id, user.role);
    return { wallet };
  });

  /** Manual pack load (alpha / admin). Production uses auto-reload on usage. */
  app.post('/v1/wallet/add-pack', { preHandler: authenticate }, async (request, reply) => {
    const body = z
      .object({ tokens: z.number().int().positive().optional() })
      .parse(request.body ?? {});

    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const pack = body.tokens ?? config.TOKEN_PACK_SIZE;
    const balanceTokens = await grantTokenPack(user.id, pack, 'manual_pack');
    return { balanceTokens, added: pack };
  });

  /** Alpha: attach simulated card on file (Stripe Checkout replaces this). */
  app.post('/v1/wallet/payment-method/simulate', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const paymentMethod = await attachSimulatedPaymentMethod(user.id);
    return { paymentMethod };
  });

  /** Test auto-reload charge + token grant for signed-in payer. */
  app.post('/v1/wallet/auto-reload', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const result = await autoReloadTokenPack(user.id);
    return { result };
  });
}
