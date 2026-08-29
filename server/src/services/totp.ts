import QRCode from 'qrcode';
import { query } from '../db/pool.js';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  totpOtpauthUrl,
  verifyTotpCode,
} from '../lib/totp.js';
import { sendTotpEnrollEmail, TotpEmailSendError } from './email.js';
import { findUserById, findUserForLogin } from './users.js';

export { TotpEmailSendError };

export class TotpAlreadyEnabledError extends Error {
  constructor() {
    super('Authenticator is already on. Remove it first to email a new barcode.');
    this.name = 'TotpAlreadyEnabledError';
  }
}

export class TotpNotPendingError extends Error {
  constructor() {
    super('Email a new barcode first, then confirm with a code from the app.');
    this.name = 'TotpNotPendingError';
  }
}

export class TotpInvalidCodeError extends Error {
  constructor() {
    super('Invalid authenticator code.');
    this.name = 'TotpInvalidCodeError';
  }
}

export async function beginTotpEnroll(userId: string): Promise<{ emailed: true; dataUrl: string; secret: string }> {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');
  if (user.totpEnabled) throw new TotpAlreadyEnabledError();

  const secret = generateTotpSecret();
  const enc = encryptTotpSecret(secret);
  await query(
    `UPDATE users SET totp_secret_enc = $2, totp_enabled_at = NULL, updated_at = NOW() WHERE id = $1`,
    [userId, enc],
  );

  const otpauth = totpOtpauthUrl(user.email, secret);
  const dataUrl = await QRCode.toDataURL(otpauth, {
    margin: 2,
    width: 240,
    errorCorrectionLevel: 'M',
  });
  const png = await QRCode.toBuffer(otpauth, {
    type: 'png',
    width: 280,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  try {
    await sendTotpEnrollEmail(user.email, png, secret);
  } catch (emailErr) {
    // If SMTP fails, the user still gets the direct QR code dataUrl on the screen.
    console.warn('TOTP email send warning:', emailErr);
  }
  return { emailed: true, dataUrl, secret };
}

export async function confirmTotpEnroll(userId: string, code: string): Promise<void> {
  const { rows } = await query<{ totp_secret_enc: string | null; totp_enabled_at: Date | null }>(
    `SELECT totp_secret_enc, totp_enabled_at FROM users WHERE id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row?.totp_secret_enc || row.totp_enabled_at) throw new TotpNotPendingError();
  const secret = decryptTotpSecret(row.totp_secret_enc);
  if (!verifyTotpCode(secret, code)) {
    throw new TotpInvalidCodeError();
  }
  await query(`UPDATE users SET totp_enabled_at = NOW(), updated_at = NOW() WHERE id = $1`, [userId]);
}

export async function disableTotp(userId: string): Promise<void> {
  await query(
    `UPDATE users SET totp_secret_enc = NULL, totp_enabled_at = NULL, updated_at = NOW() WHERE id = $1`,
    [userId],
  );
}

export async function tryVerifyTotp(
  email: string,
  code: string,
): Promise<{ email: string; role: 'patient' | 'mentor' } | null> {
  const user = await findUserForLogin(email);
  if (!user?.totpEnabled) return null;
  const { rows } = await query<{ totp_secret_enc: string | null }>(
    `SELECT totp_secret_enc FROM users WHERE id = $1`,
    [user.id],
  );
  const enc = rows[0]?.totp_secret_enc;
  if (!enc) return null;
  let secret: string;
  try {
    secret = decryptTotpSecret(enc);
  } catch {
    return null;
  }
  if (!verifyTotpCode(secret, code)) return null;
  return { email: user.email, role: user.role };
}
