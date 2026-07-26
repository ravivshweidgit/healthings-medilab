import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById, setWebViewEnabled } from '../services/users.js';

const webViewBody = z.object({ enabled: z.boolean() });

export async function registerAccountRoutes(app: FastifyInstance) {
  // Reading the current value needs no endpoint: GET /v1/me already carries
  // `webViewEnabled` on the user object.
  app.put('/v1/account/web-view', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'patient') {
      return reply.code(403).send({ error: 'Only patients have a personal web view' });
    }

    const body = webViewBody.parse(request.body);
    const updated = await setWebViewEnabled(user.id, body.enabled);
    if (!updated) return reply.code(404).send({ error: 'User not found' });
    return { user: updated };
  });
}
