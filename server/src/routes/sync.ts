import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  SyncError,
  getLatestSyncForMentor,
  getLatestSyncMetaForPatient,
  getLatestSyncPayloadForPatient,
  uploadSyncBlob,
  type SyncSummary,
} from '../services/sync.js';
import {
  SyncRequestError,
  listSyncUpdateRequestsForPatient,
} from '../services/syncRequests.js';

const summarySchema = z.object({
  generatedAt: z.string(),
  lookbackDays: z.number().int().positive(),
  lookbackMode: z.enum(['90d', 'full']),
  dayRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  includes: z.array(z.string()),
});

const uploadBody = z.object({
  payloadGzipBase64: z.string().min(1),
  summary: summarySchema,
});

export async function registerSyncRoutes(app: FastifyInstance) {
  app.post('/v1/sync/upload', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const body = uploadBody.parse(request.body);
    let payloadGzip: Buffer;
    try {
      payloadGzip = Buffer.from(body.payloadGzipBase64, 'base64');
    } catch {
      return reply.code(400).send({ error: 'Invalid base64 payload' });
    }

    try {
      const blob = await uploadSyncBlob(user, payloadGzip, body.summary as SyncSummary);
      return { blob };
    } catch (err) {
      if (err instanceof SyncError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/v1/sync/latest', { preHandler: authenticate }, async (request, reply) => {
    const query = z.object({ patientId: z.string().uuid() }).parse(request.query);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      const result = await getLatestSyncForMentor(user, query.patientId);
      if (!result) return reply.code(404).send({ error: 'No shared data yet' });
      return result;
    } catch (err) {
      if (err instanceof SyncError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/v1/sync/mine', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      const blob = await getLatestSyncMetaForPatient(user);
      return { blob };
    } catch (err) {
      if (err instanceof SyncError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/v1/sync/mine/payload', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      const result = await getLatestSyncPayloadForPatient(user);
      if (!result) return reply.code(404).send({ error: 'No snapshot yet' });
      return result;
    } catch (err) {
      if (err instanceof SyncError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/v1/sync/requests', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      const requests = await listSyncUpdateRequestsForPatient(user);
      return { requests };
    } catch (err) {
      if (err instanceof SyncRequestError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });
}
