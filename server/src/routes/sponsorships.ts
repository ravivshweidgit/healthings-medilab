import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  SponsorshipError,
  disableSponsorship,
  enableSponsorship,
  getSponsorshipViewForPatient,
  listSponsoredPatientsForMentor,
} from '../services/sponsorships.js';

const patientRefBody = z
  .object({
    patientId: z.string().uuid().optional(),
    patientEmail: z.string().email().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((b) => b.patientId || b.patientEmail, { message: 'patientId or patientEmail required' });

export async function registerSponsorshipRoutes(app: FastifyInstance) {
  app.get('/v1/sponsorships', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'patient') {
      return reply.code(403).send({ error: 'Requires patient role' });
    }
    const sponsorship = await getSponsorshipViewForPatient(user.id);
    return { sponsorship };
  });

  app.get('/v1/sponsorships/mine', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'mentor') {
      return reply.code(403).send({ error: 'Requires mentor role' });
    }
    const sponsorships = await listSponsoredPatientsForMentor(user.id);
    return { sponsorships };
  });

  app.post('/v1/sponsorships/enable', { preHandler: authenticate }, async (request, reply) => {
    const body = patientRefBody.parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      const sponsorship = await enableSponsorship(user, body);
      return { sponsorship };
    } catch (err) {
      if (err instanceof SponsorshipError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/v1/sponsorships/disable', { preHandler: authenticate }, async (request, reply) => {
    const body = patientRefBody.parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      await disableSponsorship(user, body);
      return { ok: true };
    } catch (err) {
      if (err instanceof SponsorshipError) {
        return reply.code(err.status).send({ error: err.message });
      }
      throw err;
    }
  });
}
