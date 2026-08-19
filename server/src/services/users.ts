import { query } from '../db/pool.js';
import { gmailDotKey } from '../lib/crypto.js';
import { purgeClinicDataIfNoConsumers } from './consent.js';
import { ensureMentorOrg } from './clinicAccess.js';
import type { PublicUser, UserRole } from './jwt.js';

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  user_no: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  web_view_enabled: boolean;
  totp_enabled_at: Date | null;
  created_at: Date;
};

const NAME_MAX = 80;

function normalizeName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, NAME_MAX);
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    userNo: row.user_no,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    webViewEnabled: row.web_view_enabled ?? false,
    totpEnabled: Boolean(row.totp_enabled_at),
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<PublicUser | null> {
  const { rows } = await query<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
  return rows[0] ? toPublicUser(rows[0]) : null;
}

/**
 * Login lookup: Gmail/googlemail match on the dot-stripped mailbox (+tag kept).
 * Oldest row wins if a legacy duplicate still exists. Other domains: exact email.
 */
export async function findUserForLogin(email: string): Promise<PublicUser | null> {
  const key = gmailDotKey(email);
  if (!key) return findUserByEmail(email);
  const { rows } = await query<UserRow>(
    `SELECT * FROM users WHERE gmail_canonical = $1 ORDER BY created_at ASC`,
    [key],
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const { rows } = await query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id]);
  return rows[0] ? toPublicUser(rows[0]) : null;
}

export async function findOrCreateUser(
  email: string,
  role: UserRole,
): Promise<PublicUser> {
  const existing = await findUserForLogin(email);
  if (existing) return existing;

  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, role, gmail_canonical) VALUES ($1, $2, $3)
     RETURNING *`,
    [email, role, gmailDotKey(email)],
  );
  const user = toPublicUser(rows[0]);
  if (role === 'mentor') {
    await ensureMentorOrg(user.id, user.displayName, user.email);
  }
  return user;
}

/**
 * Turns the patient's own read-only web view on or off.
 *
 * Turning it off removes a snapshot consumer, so the purge runs here rather than
 * in the route — the same reasoning as `revokeShare`: a caller that forgets it
 * would leave data on the server the patient believes they just withdrew. The
 * flag is written first so the purge reads the state that now applies.
 */
export async function setWebViewEnabled(
  userId: string,
  enabled: boolean,
): Promise<PublicUser | null> {
  const { rows } = await query<UserRow>(
    `UPDATE users SET web_view_enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, enabled],
  );
  const user = rows[0];
  if (!user) return null;

  if (!enabled) {
    await purgeClinicDataIfNoConsumers(userId);
  }
  return toPublicUser(user);
}

export async function updateUserDisplayName(
  userId: string,
  displayName: string,
): Promise<PublicUser | null> {
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  const { rows } = await query<UserRow>(
    `UPDATE users SET display_name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, trimmed],
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

/** Patient first/last name (be-27). Empty strings clear to null. */
export async function updateUserNames(
  userId: string,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): Promise<PublicUser | null> {
  const first = firstName === undefined ? undefined : normalizeName(firstName);
  const last = lastName === undefined ? undefined : normalizeName(lastName);

  if (first === undefined && last === undefined) {
    return findUserById(userId);
  }

  const { rows } = await query<UserRow>(
    `UPDATE users SET
       first_name = CASE WHEN $2::boolean THEN $3 ELSE first_name END,
       last_name = CASE WHEN $4::boolean THEN $5 ELSE last_name END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      userId,
      first !== undefined,
      first ?? null,
      last !== undefined,
      last ?? null,
    ],
  );
  return rows[0] ? toPublicUser(rows[0]) : null;
}
