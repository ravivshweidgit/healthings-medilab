import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerShareRoutes } from './routes/shares.js';
import { registerSponsorshipRoutes } from './routes/sponsorships.js';
import { registerUsageRoutes } from './routes/usage.js';
import { registerWalletRoutes } from './routes/wallet.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerClinicRoutes } from './routes/clinic.js';

const VERSION = '0.1.0';

async function main() {
  const app = Fastify({
    logger: { level: config.isDev ? 'info' : 'warn' },
  });

  await app.register(cors, {
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  app.get('/health', async () => ({ ok: true, version: VERSION }));

  await registerAuthRoutes(app);
  await registerShareRoutes(app);
  await registerSponsorshipRoutes(app);
  await registerUsageRoutes(app);
  await registerWalletRoutes(app);
  await registerSyncRoutes(app);
  await registerClinicRoutes(app);

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'Invalid request', details: err.flatten() });
    }
    app.log.error(err);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  app.log.info(`Healthings API v${VERSION} on :${config.PORT}`);
}

async function shutdown() {
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
