import jwt from 'jsonwebtoken';
import { JWT, config } from '../config.js';
import { generateRefreshToken, hashToken } from '../lib/crypto.js';
import { query } from '../db/pool.js';

export type UserRole = 'patient' | 'mentor';

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  webViewEnabled: boolean;
  createdAt: string;
};

export type AccessClaims = {
  sub: string;
  email: string;
  role: UserRole;
};

export function signAccessToken(user: PublicUser): string {
  const claims: AccessClaims = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  return jwt.sign(claims, config.JWT_SECRET, {
    expiresIn: JWT.accessTtlSeconds,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const payload = jwt.verify(token, config.JWT_SECRET) as AccessClaims;
  return payload;
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + JWT.refreshTtlDays);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt.toISOString()],
  );

  return token;
}

export async function rotateRefreshToken(
  oldToken: string,
): Promise<{ userId: string; newToken: string } | null> {
  const oldHash = hashToken(oldToken);
  const { rows } = await query<{
    id: string;
    user_id: string;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT id, user_id, expires_at, revoked_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [oldHash],
  );

  const row = rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    return null;
  }

  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [row.id]);
  const newToken = await issueRefreshToken(row.user_id);
  return { userId: row.user_id, newToken };
}

export async function revokeRefreshTokensForUser(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}
