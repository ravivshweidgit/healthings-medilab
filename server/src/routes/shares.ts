import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  ShareError,
  approveShare,
  cancelShare,
  invitePatient,
  listPendingForMe,
  listShares,
  rejectShare,
  requestMentor,
  revokeShare,
} from '../services/shares.js';

const statusQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'revoked']).optional(),
});

export async function registerShareRoutes(app: FastifyInstance) {
  app.post('/v1/shares/invite', { preHandler: authenticate }, async (request, reply) => {
    const body = z.object({ patientEmail: z.string().email() }).parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const share = await invitePatient(user, body.patientEmail);
      return { share };
    } catch (err) {
      if (err instanceof ShareError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/v1/shares/request', { preHandler: authenticate }, async (request, reply) => {
    const body = z.object({ mentorEmail: z.string().email() }).parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const share = await requestMentor(user, body.mentorEmail);
      return { share };
    } catch (err) {
      if (err instanceof ShareError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/v1/shares', { preHandler: authenticate }, async (request, reply) => {
    const query = statusQuery.parse(request.query);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const shares = await listShares(user, query.status);
    return { shares };
  });

  app.get('/v1/shares/pending-for-me', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    const shares = await listPendingForMe(user);
    return { shares };
  });

  app.post('/v1/shares/:id/approve', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const share = await approveShare(user, params.id);
      return { share };
    } catch (err) {
      if (err instanceof ShareError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/v1/shares/:id/reject', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const share = await rejectShare(user, params.id);
      return { share };
    } catch (err) {
      if (err instanceof ShareError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/v1/shares/:id/cancel', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const share = await cancelShare(user, params.id);
      return { share };
    } catch (err) {
      if (err instanceof ShareError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/v1/shares/:id/revoke', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const share = await revokeShare(user, params.id);
      return { share };
    } catch (err) {
      if (err instanceof ShareError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });
}
