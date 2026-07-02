import { query } from '../db/pool.js';
import type { PublicUser, UserRole } from './jwt.js';

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  created_at: Date;
};

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.display_name,
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
