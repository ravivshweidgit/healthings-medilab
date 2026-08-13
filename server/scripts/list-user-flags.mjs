import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const pool = new pg.Pool({ connectionString: env.match(/^DATABASE_URL=(.+)$/m)[1].trim() });

const { rows } = await pool.query(
  `SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'users'
   ORDER BY ordinal_position`,
);
console.log('USERS COLUMNS');
for (const r of rows) console.log(`- ${r.column_name}: ${r.data_type} default=${r.column_default}`);

const { rows: flags } = await pool.query(
  `SELECT email, web_view_enabled, role, user_no
   FROM users
   WHERE lower(email) = lower($1)`,
  ['ssveta1982@gmail.com'],
);
console.log('SSVETA', flags[0]);

const { rows: tables } = await pool.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name ILIKE '%log%'
   ORDER BY table_name`,
);
console.log('LOG-ISH TABLES', tables.map((t) => t.table_name));

await pool.end();
