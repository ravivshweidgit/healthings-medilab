import { OTP } from '../config.js';
import {
  generateOtpCode,
  hashSecret,
  normalizeEmail,
  verifySecret,
} from '../lib/crypto.js';
import { query } from '../db/pool.js';
import { sendOtpEmail } from './email.js';
import type { UserRole } from './jwt.js';

export async function countRecentOtpRequests(email: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM otp_requests
     WHERE email = $1 AND created_at > NOW() - INTERVAL '${OTP.requestWindowMinutes} minutes'`,
    [email],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function createOtpRequest(
  email: string,
  role: UserRole,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const recent = await countRecentOtpRequests(normalized);
  if (recent >= OTP.maxRequestsPerWindow) {
    throw new OtpRateLimitError();
  }

  const code = generateOtpCode(OTP.length);
  const codeHash = hashSecret(code);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP.ttlMinutes);

  await query(
    `INSERT INTO otp_requests (email, code_hash, role, expires_at) VALUES ($1, $2, $3, $4)`,
    [normalized, codeHash, role, expiresAt.toISOString()],
  );

  await sendOtpEmail(normalized, code);
}

export class OtpRateLimitError extends Error {
  constructor() {
    super('Too many OTP requests. Try again later.');
    this.name = 'OtpRateLimitError';
  }
}

export class OtpInvalidError extends Error {
  constructor() {
    super('Invalid or expired code.');
    this.name = 'OtpInvalidError';
  }
}

export async function verifyOtpAndGetEmail(
  email: string,
  code: string,
): Promise<{ email: string; role: UserRole }> {
  const normalized = normalizeEmail(email);

  const { rows } = await query<{
    id: string;
    code_hash: string;
    role: UserRole | null;
    expires_at: Date;
    attempts: number;
  }>(
    `SELECT id, code_hash, role, expires_at, attempts
     FROM otp_requests
     WHERE email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalized],
  );

  const row = rows[0];
  if (!row) throw new OtpInvalidError();

  if (row.attempts >= OTP.maxAttempts) throw new OtpInvalidError();
  if (new Date(row.expires_at) < new Date()) throw new OtpInvalidError();

  const ok = verifySecret(code, row.code_hash);
  await query(`UPDATE otp_requests SET attempts = attempts + 1 WHERE id = $1`, [row.id]);

  if (!ok) throw new OtpInvalidError();

  await query(`DELETE FROM otp_requests WHERE email = $1`, [normalized]);
  return { email: normalized, role: row.role ?? 'patient' };
}
