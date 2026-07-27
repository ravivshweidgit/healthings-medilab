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
  type ClinicUserRules,
} from '../services/clinicOverlay.js';
import { saveDietaryRules } from '../services/dietaryRules.js';
import { CLINIC_CHAT_LOCALES, mentorChatReply } from '../services/geminiClinic.js';
import { sendPatientAppChat } from '../services/patientChat.js';
import { SyncError } from '../services/sync.js';
import { meterClinicChat } from '../services/usage.js';
import {
  SyncRequestError,
  getSyncStatusForActor,
  requestSyncUpdate,
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
      // Match app prompt52: rawText-only save — no "AI understood" constraints UI.
      const stubRules: ClinicUserRules = {
        rawText,
        summary: '',
        constraints: [],
        analyzedAt: new Date().toISOString(),
      };
      // Same service for mentor (org overlay) and patient self (sync blob).
      const { overlay, rules } = await saveDietaryRules(user, params.patientId, stubRules);
      return { overlay, rules };
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
      /** Portal clinicLocale — independent of patient app language (language-policy). */
      locale: z.enum(CLINIC_CHAT_LOCALES).optional().default('en'),
      /** Patient /account/ local calendar day for chat_history_* key. */
      dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      assertMentorType(body.mentorType);

      if (user.role === 'patient') {
        if (user.id !== params.patientId) {
          return reply.code(403).send({ error: 'Patients can only use their own AI chat' });
        }
        const dayKey = body.dayKey || new Date().toISOString().slice(0, 10);
        const { reply: replyText, thread } = await sendPatientAppChat(
          user,
          body.mentorType,
          body.message,
          dayKey,
          body.locale,
        );
        return { reply: replyText, thread };
      }

      const overlay = await getOverlayForMentor(user, params.patientId);
      const prior = overlay.chat[body.mentorType] ?? [];
      const sentAt = new Date().toISOString();
      const userMsg = { role: 'user' as const, text: body.message.trim(), sentAt, fromClinic: true };
      const { text: replyText, usage: geminiUsage } = await mentorChatReply(
        body.mentorType,
        body.message,
        prior,
        params.patientId,
        overlay.rules,
        body.locale,
      );
      // Clinic portal chat → acting mentor's wallet (before persist).
      await meterClinicChat(user.id, params.patientId, geminiUsage);
      const assistantMsg = {
        role: 'assistant' as const,
        text: replyText,
        sentAt: new Date().toISOString(),
      };
      const thread = await appendChatMessages(user, params.patientId, body.mentorType, userMsg, assistantMsg);
      return { reply: replyText, thread };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      if (err instanceof SyncError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  app.get('/v1/clinic/patients/:patientId/sync-status', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      return await getSyncStatusForActor(user, params.patientId);
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
      // Mentor or patient self — same service (requestSyncUpdate).
      const requestRow = await requestSyncUpdate(user, params.patientId);
      const status = await getSyncStatusForActor(user, params.patientId);
      return { request: requestRow, status };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      if (err instanceof SyncRequestError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });
}
