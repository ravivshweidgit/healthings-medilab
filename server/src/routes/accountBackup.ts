import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  CloudBackupError,
  deleteCloudBackup,
  downloadCloudBackup,
  getCloudBackupStatus,
  upsertCloudBackup,
} from '../services/cloudBackup.js';

const fingerprintSchema = z.object({
  earliestDay: z.string().nullable(),
  latestDay: z.string().nullable(),
  mealDays: z.number().int().nonnegative(),
  glucosePoints: z.number().int().nonnegative(),
  /** Optional for older app builds; server recomputes cloud HR from payload for the guard. */
  heartRatePoints: z.number().int().nonnegative().optional().default(0),
  hrEarliestDay: z.string().nullable().optional().default(null),
  activityDays: z.number().int().nonnegative().optional().default(0),
  activityEntries: z.number().int().nonnegative().optional().default(0),
  activityFavorites: z.number().int().nonnegative().optional().default(0),
  keyCount: z.number().int().nonnegative(),
  byteSize: z.number().int().nonnegative(),
});

const uploadBody = z.object({
  payloadGzipBase64: z.string().min(1),
  exportedAt: z.string().min(1),
  fingerprint: fingerprintSchema,
  force: z.boolean().optional(),
});

export async function registerAccountBackupRoutes(app: FastifyInstance) {
  app.get('/v1/account/backup/status', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      return await getCloudBackupStatus(user);
    } catch (err) {
      if (err instanceof CloudBackupError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.put('/v1/account/backup', { preHandler: authenticate }, async (request, reply) => {
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
      const status = await upsertCloudBackup(
        user,
        payloadGzip,
        body.exportedAt,
        body.fingerprint,
        body.force === true,
      );
      return status;
    } catch (err) {
      if (err instanceof CloudBackupError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/v1/account/backup', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const payloadGzip = await downloadCloudBackup(user);
      return { payloadGzipBase64: payloadGzip.toString('base64') };
    } catch (err) {
      if (err instanceof CloudBackupError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.delete('/v1/account/backup', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      await deleteCloudBackup(user);
      return { ok: true };
    } catch (err) {
      if (err instanceof CloudBackupError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });
}
