import pg from 'pg';
import { config } from '../config.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export type Queryable = <T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<pg.QueryResult<T>>;

/**
 * Run several statements on one connection, all or nothing.
 *
 * `query()` checks out a fresh connection per call, so a sequence of them is not
 * a transaction no matter how it reads. Anything whose half-completed state would
 * be wrong — account deletion, where stopping midway leaves the rows that are not
 * reachable by foreign key — must use this instead.
 */
export async function withTransaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {
      /* connection may already be unusable; the original error is what matters */
    });
    throw err;
  } finally {
    client.release();
  }
}
