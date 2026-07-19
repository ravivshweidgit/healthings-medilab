#!/usr/bin/env node
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const pool = new pg.Pool({ connectionString: env.match(/^DATABASE_URL=(.+)$/m)[1].trim() });
const email = process.argv[2] || 'raviv.shweid@gmail.com';

try {
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public'
    ORDER BY 1`);
  console.log('TABLES', tables.map((t) => t.table_name));

  const { rows: users } = await pool.query(
    `SELECT id, email, role, created_at FROM users WHERE lower(email)=lower($1)`,
    [email],
  );
  console.log('USER', users[0] || null);
  if (!users[0]) process.exit(1);
  const id = users[0].id;

  for (const t of ['refresh_tokens', 'sessions', 'auth_sessions', 'user_sessions', 'devices']) {
    try {
      const { rows: cols } = await pool.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
        [t],
      );
      if (!cols.length) continue;
      console.log(`\n${t} COLS`, cols.map((c) => c.column_name));
      const { rows } = await pool.query(`SELECT * FROM ${t} WHERE user_id=$1 ORDER BY 1 DESC LIMIT 8`, [id]);
      console.log(
        `${t} ROWS`,
        JSON.stringify(
          rows.map((r) => {
            const o = { ...r };
            for (const k of Object.keys(o)) {
              if (/token|secret|hash|password/i.test(k) && o[k]) o[k] = '[redacted]';
            }
            return o;
          }),
          null,
          2,
        ),
      );
    } catch (e) {
      /* skip */
    }
  }

  // Cloud backup fingerprint for main account
  const { rows: cb } = await pool.query(
    `SELECT exported_at, byte_size, fingerprint FROM user_cloud_backups WHERE user_id=$1`,
    [id],
  );
  console.log('\nCLOUD', cb[0] || null);

  const { rows: blobs } = await pool.query(
    `SELECT version, created_at, byte_size, payload_gzip FROM sync_blobs WHERE patient_id=$1 ORDER BY version DESC LIMIT 3`,
    [id],
  );
  for (const b of blobs) {
    const p = JSON.parse(inflateSync(b.payload_gzip).toString('utf8'));
    let sc = p.asyncStorage?.source_config;
    if (typeof sc === 'string') {
      try {
        sc = JSON.parse(sc);
      } catch {
        /* */
      }
    }
    console.log('BLOB', b.version, b.created_at.toISOString?.() ?? b.created_at, {
      glucose: sc?.glucose,
      activity: sc?.activity,
      bodyComposition: sc?.bodyComposition,
    });
  }
} finally {
  await pool.end();
}
