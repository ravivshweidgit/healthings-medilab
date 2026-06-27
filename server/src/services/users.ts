import { query } from '../db/pool.js';
import type { PublicUser, UserRole } from './jwt.js';

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  created_at: Date;
};

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
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
