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
import {
  listDietMarkerCatalog,
  saveMarkersForPatient,
  requestMarkersBackfill,
  ackMarkersBackfill,
  MARKERS_BACKFILL_DEFAULT_DAYS,
  MARKERS_BACKFILL_MAX_DAYS,
  MARKERS_BACKFILL_MIN_DAYS,
} from '../services/treatmentMarkers.js';
import { saveMacrosForPatient } from '../services/clinicMacros.js';
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

  /** Catalog of diet-marker codes for the portal picker (be-47 table). */
  app.get('/v1/clinic/marker-catalog', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (user.role !== 'mentor') return reply.code(403).send({ error: 'Requires mentor role' });
    try {
      const catalog = await listDietMarkerCatalog();
      return { catalog, maxMarkers: 3 };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to load marker catalog' });
    }
  });

  app.put('/v1/clinic/patients/:patientId/markers', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        markers: z.array(
          z.object({
            marker: z.string().min(1),
            direction: z.enum(['cap', 'floor']),
            dailyTarget: z.number(),
            note: z.string().max(500).optional(),
            linkedLabCodes: z.array(z.string()).optional(),
          }),
        ),
      })
      .parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const overlay = await saveMarkersForPatient(user, params.patientId, body.markers);
      return { overlay, markers: overlay.markers, markersBackfill: overlay.markersBackfill };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to save markers' });
    }
  });

  /** Clinic live macro order (be-45). Empty bounds clears the order. */
  app.put('/v1/clinic/patients/:patientId/macros', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const activityAddBackSchema = z
      .object({
        thresholdKcal: z.number(),
        capValue: z.number(),
        ratio: z.number().optional(),
      })
      .optional();
    const body = z
      .object({
        bounds: z.array(
          z.object({
            axis: z.string().min(1),
            direction: z.enum(['floor', 'ceiling']),
            kind: z.enum(['constant', 'percent']).optional(),
            value: z.number(),
            of: z.enum(['kcal_order', 'kcal_eaten']).optional(),
            resolvedValue: z.number().optional(),
            strength: z.enum(['hard', 'flex']),
            activityAddBack: activityAddBackSchema,
            followsActivity: z.boolean().optional(),
          }),
        ),
        source: z.enum(['rules', 'clinic_override']).optional(),
        rulesHash: z.string().optional(),
        reasoning: z.string().max(4000).optional(),
      })
      .parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const overlay = await saveMacrosForPatient(user, params.patientId, body.bounds, {
        source: body.source ?? 'clinic_override',
        rulesHash: body.rulesHash,
        reasoning: body.reasoning,
      });
      return { overlay, macros: overlay.macros };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to save macros' });
    }
  });

  /** Clinic: queue past-meal marker estimates on the patient's phone. */
  app.post('/v1/clinic/patients/:patientId/markers/backfill', { preHandler: authenticate }, async (request, reply) => {
    const params = z.object({ patientId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        days: z
          .number()
          .int()
          .min(MARKERS_BACKFILL_MIN_DAYS)
          .max(MARKERS_BACKFILL_MAX_DAYS)
          .optional()
          .default(MARKERS_BACKFILL_DEFAULT_DAYS),
      })
      .parse(request.body ?? {});
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const overlay = await requestMarkersBackfill(user, params.patientId, body.days);
      return { overlay, markersBackfill: overlay.markersBackfill };
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to request marker backfill' });
    }
  });

  /** Patient phone: report past-meal marker fill finished. */
  app.post('/v1/clinic/overlays/markers-backfill/ack', { preHandler: authenticate }, async (request, reply) => {
    const body = z
      .object({
        id: z.string().uuid(),
        status: z.enum(['done', 'failed']),
        mealsUpdated: z.number().int().min(0).optional(),
        error: z.string().max(500).optional(),
      })
      .parse(request.body);
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const result = await ackMarkersBackfill(user, body);
      return result;
    } catch (err) {
      if (err instanceof ClinicError) return reply.code(err.status).send({ error: err.message });
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to ack marker backfill' });
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
        overlay.markers,
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
