/**
 * Phone Withings OAuth token proxy — client secret stays on the server.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  exchangeWithingsToken,
  WithingsNotConfiguredError,
  WithingsTokenError,
} from '../services/withingsOauth.js';

const bodySchema = z.discriminatedUnion('grantType', [
  z.object({
    grantType: z.literal('authorization_code'),
    code: z.string().min(8).max(512),
  }),
  z.object({
    grantType: z.literal('refresh_token'),
    refreshToken: z.string().min(8).max(2048),
  }),
]);

export async function registerWithingsRoutes(app: FastifyInstance) {
  app.post(
    '/v1/withings/oauth/token',
    {
      preHandler: authenticate,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const user = await findUserById(request.userId!);
      if (!user) return reply.code(404).send({ error: 'User not found' });
      if (user.role !== 'patient') {
        return reply.code(403).send({ error: 'Requires patient role' });
      }

      const body = bodySchema.parse(request.body);
      try {
        const tokens =
          body.grantType === 'authorization_code'
            ? await exchangeWithingsToken({ grantType: 'authorization_code', code: body.code })
            : await exchangeWithingsToken({
                grantType: 'refresh_token',
                refreshToken: body.refreshToken,
              });
        return tokens;
      } catch (err) {
        if (err instanceof WithingsNotConfiguredError) {
          return reply.code(503).send({ error: err.message });
        }
        if (err instanceof WithingsTokenError) {
          return reply.code(err.status).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
