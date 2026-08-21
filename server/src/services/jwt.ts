import jwt from 'jsonwebtoken';
import { JWT, config } from '../config.js';
import { generateRefreshToken, hashToken } from '../lib/crypto.js';
import { query } from '../db/pool.js';

export type UserRole = 'patient' | 'mentor';

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
  /** Sequential account number (1…n). UUID id stays the primary key. */
  userNo: number;
  displayName: string | null;
  /** Patient first name for clinic findability (be-27). Null for mentors. */
  firstName: string | null;
  /** Patient last name for clinic findability (be-27). Null for mentors. */
  lastName: string | null;
  webViewEnabled: boolean;
  /** Google Authenticator (TOTP) confirmed for this account. */
  totpEnabled: boolean;
  createdAt: string;
  /** Last phone OS seen via X-Healthings-Platform (android|ios|…). */
  lastClientPlatform?: string | null;
  /** Marketing app version, e.g. 1.2.40 */
  lastClientAppVersion?: string | null;
  /** Native build number / versionCode */
  lastClientBuild?: string | null;
  lastClientSeenAt?: string | null;
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
    created_at: Date;
  }>(
    `SELECT id, user_id, expires_at, revoked_at, created_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [oldHash],
  );

  const row = rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    return null;
  }

  // Slide the 30-day expiry on the same token. Do not revoke+reissue — a phone
  // killed after rotate (bi / Play install / OS process death) still held the
  // old token, the next refresh 401'd, and the app wiped the session.
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + JWT.refreshTtlDays);
  await query(`UPDATE refresh_tokens SET expires_at = $2 WHERE id = $1`, [
    row.id,
    expiresAt.toISOString(),
  ]);
  return { userId: row.user_id, newToken: oldToken };
}

export async function revokeRefreshTokensForUser(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}
