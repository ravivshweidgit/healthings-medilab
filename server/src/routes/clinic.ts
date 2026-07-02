import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { findUserById } from '../services/users.js';
import {
  ClinicError,
  appendChatMessages,
  assertMentorType,
  getOverlayForMentor,
  getOverlayForPatient,
  getRulesHistoryForMentor,
  saveRulesForPatient,
  type ClinicUserRules,
} from '../services/clinicOverlay.js';
import { mentorChatReply, summariseRulesForClinic } from '../services/geminiClinic.js';
import {
  SyncRequestError,
  getPatientSyncStatusForMentor,
  requestPatientSyncUpdate,
} from '../services/syncRequests.js';

export async function registerClinicRoutes(app: FastifyInstance) {
  app.get('/v1/clinic/patients/:patientId/overlay', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const overlay = await getOverlayForMentor(user, params.patientId);
      return { overlay };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.get('/v1/clinic/overlays', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const overlay = await getOverlayForPatient(user);
      return { overlay };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.get('/v1/clinic/patients/:patientId/rules/history', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const history = await getRulesHistoryForMentor(user, params.patientId);
      return { history };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.put('/v1/clinic/patients/:patientId/rules', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const body = z.object({ rawText: z.string().min(1) }).parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const rawText = body.rawText.trim();
      const stubRules: ClinicUserRules = {
        rawText,
        summary: rawText.slice(0, 48),
        constraints: [],
        analyzedAt: new Date().toISOString(),
      };
      const overlay = await saveRulesForPatient(user, params.patientId, stubRules);

      void summariseRulesForClinic(rawText)
        .then((rules) => saveRulesForPatient(user, params.patientId, rules))
        .catch((err) => {
          request.log.warn({ err }, 'Clinic rules AI summarise failed; kept raw save');
        });

      return { overlay, rules: stubRules };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to save rules' });
    }
  });

  app.post('/v1/clinic/patients/:patientId/chat', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const body = z.object({
      mentorType: z.enum(['doctor', 'nutritionist', 'coach']),
      message: z.string().min(1).max(4000),
    }).parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      assertMentorType(body.mentorType);
      const overlay = await getOverlayForMentor(user, params.patientId);
      const prior = overlay.chat[body.mentorType] ?? [];
      const sentAt = new Date().toISOString();
      const userMsg = { role: 'user' as const, text: body.message.trim(), sentAt, fromClinic: true };
      const replyText = await mentorChatReply(
        body.mentorType,
        body.message,
        prior,
        params.patientId,
        overlay.rules,
      );
      const assistantMsg = {
        role: 'assistant' as const,
        text: replyText,
        sentAt: new Date().toISOString(),
      };
      const thread = await appendChatMessages(user, params.patientId, body.mentorType, userMsg, assistantMsg);
      return { reply: replyText, thread };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.get('/v1/clinic/patients/:patientId/sync-status', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const status = await getPatientSyncStatusForMentor(user, params.patientId);
      return status;
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      if (err instanceof SyncRequestError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.post('/v1/clinic/patients/:patientId/request-sync', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const requestRow = await requestPatientSyncUpdate(user, params.patientId);
      const status = await getPatientSyncStatusForMentor(user, params.patientId);
      return { request: requestRow, status };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      if (err instanceof SyncRequestError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });
}
