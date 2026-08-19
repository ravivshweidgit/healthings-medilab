import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashSecret(value: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(value, salt, 32);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifySecret(value: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(value, salt, 32);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function generateOtpCode(length: number): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += String(randomInt(0, 10));
  }
  return code;
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Gmail / Googlemail only: dots in the mailbox are ignored by Google.
 * Plus-tags are kept (`alon+clinic@` ≠ `alon@`) — those are separate Healthings users.
 * Returns null for every other domain.
 */
export function gmailDotKey(email: string): string | null {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at < 1) return null;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return null;
  const plus = local.indexOf('+');
  const mailbox = plus === -1 ? local : local.slice(0, plus);
  const tag = plus === -1 ? '' : local.slice(plus);
  return `${mailbox.replace(/\./g, '')}${tag}@gmail.com`;
}
