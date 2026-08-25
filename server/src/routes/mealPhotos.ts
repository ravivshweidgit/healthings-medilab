/**
 * Binary meal-photo channel (prompt116 Phase 2).
 *
 * PUT streams JPEG bytes — never base64 inside the sync snapshot.
 * POST /missing lets the phone upload only what the server lacks.
 * GET serves one plate to the patient or an approved clinic mentor.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  MEAL_PHOTO_MAX_BYTES,
  MealPhotoError,
  findMissingMealPhotoIds,
  getMealPhotoBytes,
  upsertMealPhoto,
} from '../services/mealPhotos.js';

const missingBody = z.object({
  photoIds: z.array(z.string().min(1).max(80)).max(200),
});

export async function registerMealPhotoRoutes(app: FastifyInstance) {
  // Raw JPEG body. Phone Share uses FileSystem.uploadAsync with Content-Type
  // image/jpeg (BINARY_CONTENT); accept octet-stream too for the same path.
  // Without both, Fastify returns 415 and meal_photos stays empty.
  const parseBinary = (
    _req: unknown,
    body: Buffer,
    done: (err: Error | null, body?: Buffer) => void,
  ) => {
    done(null, body);
  };
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, parseBinary);
  app.addContentTypeParser('image/jpeg', { parseAs: 'buffer' }, parseBinary);

  app.put(
    '/v1/meal-photos/:photoId',
    {
      preHandler: authenticate,
      bodyLimit: MEAL_PHOTO_MAX_BYTES,
    },
    async (request, reply) => {
      const user = await findUserById(request.userId!);
      if (!user) return reply.code(404).send({ error: 'User not found' });

      const params = z.object({ photoId: z.string().min(1).max(80) }).parse(request.params);
      const bytes = Buffer.isBuffer(request.body)
        ? request.body
        : Buffer.from(request.body as ArrayBuffer);

      try {
        const saved = await upsertMealPhoto(user, params.photoId, bytes);
        return reply.code(200).send(saved);
      } catch (err) {
        if (err instanceof MealPhotoError) {
          return reply.code(err.status).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.post('/v1/meal-photos/missing', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const body = missingBody.parse(request.body);
    try {
      const missing = await findMissingMealPhotoIds(user, body.photoIds);
      return { missing };
    } catch (err) {
      if (err instanceof MealPhotoError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get('/v1/meal-photos/:photoId', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const params = z.object({ photoId: z.string().min(1).max(80) }).parse(request.params);
    const query = z
      .object({ patientId: z.string().uuid().optional() })
      .parse(request.query);
    const patientId = query.patientId ?? user.id;

    try {
      const bytes = await getMealPhotoBytes(user, patientId, params.photoId);
      if (!bytes) return reply.code(404).send({ error: 'Photo not found' });
      return reply
        .type('image/jpeg')
        .header('Cache-Control', 'private, max-age=3600')
        .send(bytes);
    } catch (err) {
      if (err instanceof MealPhotoError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });
}
