import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  const { ensureLabCatalogSeeded } = await import('../services/labCatalog.js');
  await ensureLabCatalogSeeded();
  const { ensureDietMarkerCatalogSeeded } = await import('../services/treatmentMarkers.js');
  await ensureDietMarkerCatalogSeeded();
  console.log('Migration complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
