import { query } from '../db/pool.js';
import { purgeClinicDataIfNoConsumers } from './consent.js';
import type { PublicUser, UserRole } from './jwt.js';

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  web_view_enabled: boolean;
  created_at: Date;
};

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
    webViewEnabled: row.web_view_enabled ?? false,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<PublicUser | null> {
  const { rows } = await query<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
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
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, role) VALUES ($1, $2)
     RETURNING *`,
    [email, role],
  );
  return toPublicUser(rows[0]);
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
