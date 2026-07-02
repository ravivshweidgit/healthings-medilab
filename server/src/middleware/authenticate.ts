import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../services/jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userRole?: 'patient' | 'mentor';
    userEmail?: string;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  try {
    const claims = verifyAccessToken(header.slice(7));
    request.userId = claims.sub;
    request.userRole = claims.role;
    request.userEmail = claims.email;
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}
