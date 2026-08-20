/**
 * Operator-only marker catalog (be-47). Admin never uses the clinic portal.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isAdminEmail } from '../config.js';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  listDietMarkerCatalog,
  addDietMarkerCatalogRow,
} from '../services/treatmentMarkers.js';
import { ClinicError } from '../services/clinicOverlay.js';

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get('/v1/admin/marker-catalog', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (!isAdminEmail(user.email)) return reply.code(403).send({ error: 'Admin only' });
    try {
      const catalog = await listDietMarkerCatalog();
      return { catalog, maxMarkers: 3 };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to load marker catalog' });
    }
  });

  app.post('/v1/admin/marker-catalog', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (!isAdminEmail(user.email)) return reply.code(403).send({ error: 'Admin only' });
    const body = z
      .object({
        code: z.string().min(2).max(48),
        unit: z.enum(['g', 'mg', 'mcg']),
        defaultDirection: z.enum(['cap', 'floor']),
        linkedLabCodes: z.array(z.string()).optional(),
        labels: z.object({
          en: z.object({ short: z.string().optional(), full: z.string().min(1) }),
          he: z.object({ short: z.string().optional(), full: z.string().min(1) }).optional(),
        }),
        estimateGuidance: z.string().max(2000).optional(),
      })
      .parse(request.body);
    try {
      const labels: Record<string, { short: string; full: string }> = {
        en: {
          short: (body.labels.en.short || body.labels.en.full).trim(),
          full: body.labels.en.full.trim(),
        },
      };
      if (body.labels.he?.full) {
        labels.he = {
          short: (body.labels.he.short || body.labels.he.full).trim(),
          full: body.labels.he.full.trim(),
        };
      }
      const row = await addDietMarkerCatalogRow({
        code: body.code,
        unit: body.unit,
        defaultDirection: body.defaultDirection,
        linkedLabCodes: body.linkedLabCodes,
        labels,
        estimateGuidance: body.estimateGuidance,
      });
      return { catalogItem: row };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to add catalog item' });
    }
  });
}
