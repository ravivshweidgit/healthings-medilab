import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import {
  issueRefreshToken,
  revokeRefreshTokensForUser,
  rotateRefreshToken,
  signAccessToken,
} from '../services/jwt.js';
import {
  OtpInvalidError,
  OtpRateLimitError,
  createOtpRequest,
  verifyOtpAndGetEmail,
} from '../services/otp.js';
import { OtpEmailSendError } from '../services/email.js';
import { attachPendingShares } from '../services/shares.js';
import { findOrCreateUser, findUserById, updateUserDisplayName, updateUserNames } from '../services/users.js';
import { isAdminEmail } from '../config.js';

const roleSchema = z.enum(['patient', 'mentor']);

const otpRequestBody = z.object({
  email: z.string().email(),
  role: roleSchema.optional().default('patient'),
  /** Operator console (be-38) — only allowlisted emails get a code. */
  purpose: z.enum(['admin']).optional(),
});

const otpVerifyBody = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/),
});

const refreshBody = z.object({
  refreshToken: z.string().min(20),
});

const patchMeBody = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    firstName: z.string().max(80).nullable().optional(),
    lastName: z.string().max(80).nullable().optional(),
  })
  .refine(
    (b) => b.displayName !== undefined || b.firstName !== undefined || b.lastName !== undefined,
    { message: 'Provide displayName and/or firstName/lastName' },
  );

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/v1/auth/otp/request', async (request, reply) => {
    const body = otpRequestBody.parse(request.body);
    if (body.purpose === 'admin' && !isAdminEmail(body.email)) {
      return reply.code(403).send({ error: 'Not an operator account' });
    }
    try {
      await createOtpRequest(body.email, body.role);
      return { sent: true };
    } catch (err) {
      if (err instanceof OtpRateLimitError) {
        return reply.code(429).send({ error: err.message });
      }
      if (err instanceof OtpEmailSendError) {
        return reply
          .code(502)
          .send({ error: 'Could not send the sign-in code. Please try again.' });
      }
      throw err;
    }
  });

  app.post('/v1/auth/otp/verify', async (request, reply) => {
    const body = otpVerifyBody.parse(request.body);
    try {
      const { email, role } = await verifyOtpAndGetEmail(body.email, body.code);
      const user = await findOrCreateUser(email, role);
      if (user.role === 'patient') {
        await attachPendingShares(user.email, user.id);
      }
      const accessToken = signAccessToken(user);
      const refreshToken = await issueRefreshToken(user.id);
      return {
        accessToken,
        refreshToken,
        user: { ...user, isAdmin: isAdminEmail(user.email) },
      };
    } catch (err) {
      if (err instanceof OtpInvalidError) {
        return reply.code(401).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post('/v1/auth/refresh', async (request, reply) => {
    const body = refreshBody.parse(request.body);
    const rotated = await rotateRefreshToken(body.refreshToken);
    if (!rotated) {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
    const user = await findUserById(rotated.userId);
    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }
    const accessToken = signAccessToken(user);
    return { accessToken, refreshToken: rotated.newToken };
  });

  app.post('/v1/auth/logout', { preHandler: authenticate }, async (request) => {
    if (request.userId) {
      await revokeRefreshTokensForUser(request.userId);
    }
    return { ok: true };
  });

  app.get('/v1/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await findUserById(request.userId!);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return { user: { ...user, isAdmin: isAdminEmail(user.email) } };
  });

  app.patch('/v1/me', { preHandler: authenticate }, async (request, reply) => {
    const body = patchMeBody.parse(request.body);
    const current = await findUserById(request.userId!);
    if (!current) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const wantsDisplay = body.displayName !== undefined;
    const wantsNames = body.firstName !== undefined || body.lastName !== undefined;

    if (current.role === 'patient' && wantsDisplay) {
      return reply.code(422).send({ error: 'Patients cannot set displayName' });
    }
    if (current.role === 'mentor' && wantsNames) {
      return reply.code(422).send({ error: 'Mentors cannot set firstName/lastName' });
    }

    let user: typeof current | null = current;
    if (wantsDisplay) {
      user = await updateUserDisplayName(request.userId!, body.displayName!);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
    }
    if (wantsNames) {
      user = await updateUserNames(request.userId!, body.firstName, body.lastName);
      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }
    }
    return { user };
  });
}
