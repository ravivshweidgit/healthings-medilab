import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { deleteAccountWithCode } from '../services/accountDeletion.js';
import { OtpEmailSendError } from '../services/email.js';
import { OtpInvalidError, OtpRateLimitError, createOtpRequest } from '../services/otp.js';
import {
  SyncError,
  getPatientRulesFromLatestBlob,
} from '../services/sync.js';
import { findUserById, setWebViewEnabled } from '../services/users.js';

const webViewBody = z.object({ enabled: z.boolean() });
const deleteBody = z.object({ code: z.string().min(4).max(12) });

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

  /**
   * Phone pull of My Rules after a web edit.
   * Writes go through PUT /v1/clinic/patients/:id/rules (saveDietaryRules) — same as clinic.
   */
  app.get('/v1/account/rules', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    try {
      const rules = await getPatientRulesFromLatestBlob(user);
      return { rules };
    } catch (err) {
      if (err instanceof SyncError) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
  });

  /**
   * Send a deletion code to the signed-in account's own email.
   *
   * Deliberately not the existing `/v1/auth/otp/request`: that one takes an email
   * in the body, so reusing it would let a client aim a deletion code at any
   * address. Here the address comes from the access token and cannot be chosen.
   */
  app.post('/v1/account/delete/code', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    try {
      await createOtpRequest(user.email, user.role, 'account-deletion');
      return { sent: true };
    } catch (err) {
      if (err instanceof OtpRateLimitError) {
        return reply.code(429).send({ error: err.message });
      }
      if (err instanceof OtpEmailSendError) {
        return reply.code(502).send({ error: 'Could not send the code. Please try again.' });
      }
      throw err;
    }
  });

  /**
   * Permanent, immediate, no grace period. The code proves the requester still
   * controls the email, so a session alone cannot destroy an account.
   */
  app.delete('/v1/account', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const body = deleteBody.parse(request.body);
    try {
      const outcome = await deleteAccountWithCode(user, body.code);
      return { deleted: true, ...outcome };
    } catch (err) {
      if (err instanceof OtpInvalidError) {
        // 422, not the 401 this instinctively wants to be. The session is fine;
        // it is the confirmation code in the body that failed. Browser clients
        // read 401 as "access token expired", try to refresh, and sign the user
        // out when that fails — so a typo in the code would have ended the
        // session and looked like something had happened.
        return reply.code(422).send({ error: err.message });
      }
      throw err;
    }
  });
}
