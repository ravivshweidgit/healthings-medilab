import { OTP } from '../config.js';
import {
  generateOtpCode,
  hashSecret,
  normalizeEmail,
  verifySecret,
} from '../lib/crypto.js';
import { query } from '../db/pool.js';
import { sendOtpEmail, type OtpPurpose } from './email.js';
import type { UserRole } from './jwt.js';
import { tryVerifyTotp } from './totp.js';

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
  purpose: OtpPurpose = 'sign-in',
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

  // One live code per email — older mails must not burn attempts on the new row.
  await query(`DELETE FROM otp_requests WHERE email = $1`, [normalized]);

  await query(
    `INSERT INTO otp_requests (email, code_hash, role, expires_at) VALUES ($1, $2, $3, $4)`,
    [normalized, codeHash, role, expiresAt.toISOString()],
  );

  await sendOtpEmail(normalized, code, purpose);
}

export class OtpRateLimitError extends Error {
  constructor() {
    super('Too many OTP requests. Try again later.');
    this.name = 'OtpRateLimitError';
  }
}

export class OtpInvalidError extends Error {
  constructor(message = 'Invalid or expired code.') {
    super(message);
    this.name = 'OtpInvalidError';
  }
}

export async function verifyOtpAndGetEmail(
  email: string,
  code: string,
): Promise<{ email: string; role: UserRole }> {
  const normalized = normalizeEmail(email);
  const fromTotp = await tryVerifyTotp(normalized, code);
  if (fromTotp) {
    await query(`DELETE FROM otp_requests WHERE email = $1`, [normalized]);
    return fromTotp;
  }
  const fromMail = await tryVerifyEmailOtp(normalized, code);
  if (fromMail) return fromMail;

  const { rows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM otp_requests
     WHERE email = $1 AND expires_at > NOW()`,
    [normalized],
  );
  if (Number(rows[0]?.n ?? 0) === 0) {
    throw new OtpInvalidError('No active code for this email. Request a new one.');
  }
  throw new OtpInvalidError();
}

async function tryVerifyEmailOtp(
  normalized: string,
  code: string,
): Promise<{ email: string; role: UserRole } | null> {
  const trimmed = String(code || '').trim();
  if (!trimmed) return null;

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
       AND expires_at > NOW()
       AND attempts < $2
     ORDER BY created_at DESC`,
    [normalized, OTP.maxAttempts],
  );

  if (!rows.length) return null;

  for (const row of rows) {
    const ok = verifySecret(trimmed, row.code_hash);
    if (!ok) {
      await query(`UPDATE otp_requests SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
      continue;
    }
    await query(`DELETE FROM otp_requests WHERE email = $1`, [normalized]);
    return { email: normalized, role: row.role ?? 'patient' };
  }

  return null;
}
