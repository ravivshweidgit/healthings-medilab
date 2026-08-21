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
import { registerBillingRoutes } from './routes/billing.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerAccountBackupRoutes } from './routes/accountBackup.js';
import { registerClinicRoutes } from './routes/clinic.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAiRoutes } from './routes/ai.js';
import { registerLabCatalogRoutes } from './routes/labCatalog.js';
import { registerWithingsRoutes } from './routes/withings.js';
import { processDelinquentRetries } from './services/payments.js';

const VERSION = '0.1.0';
const BILLING_RETRY_SWEEP_MS = 60 * 60 * 1000;

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

  // Allow GET requests that mistakenly send Content-Type: application/json with no body.
  // Keep the raw string on the request for Stripe webhook HMAC verify (be-34).
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    (req as { rawBody?: string }).rawBody = text;
    if (!text || text.length === 0) {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text));
    } catch (err) {
      done(err instanceof Error ? err : new Error(String(err)), undefined);
    }
  });

  app.get('/health', async () => ({ ok: true, version: VERSION }));

  /** Public app chrome — clinic one-tap email. Not a secret; change via env + restart. */
  app.get('/v1/public/app-config', async () => ({
    clinicShareEmail: config.HEALTHINGS_CLINIC_SHARE_EMAIL || null,
  }));

  await registerAuthRoutes(app);
  await registerShareRoutes(app);
  await registerSponsorshipRoutes(app);
  await registerUsageRoutes(app);
  await registerWalletRoutes(app);
  await registerBillingRoutes(app);
  await registerSyncRoutes(app);
  await registerAccountRoutes(app);
  await registerAccountBackupRoutes(app);
  await registerClinicRoutes(app);
  await registerAdminRoutes(app);
  await registerAiRoutes(app);
  await registerLabCatalogRoutes(app);
  await registerWithingsRoutes(app);

  // be-34: retry delinquent cards on an hourly sweep (no-op while BILLING_LIVE=false).
  const retryTimer = setInterval(() => {
    void processDelinquentRetries().catch((err) => {
      app.log.error({ err }, 'billing retry sweep failed');
    });
  }, BILLING_RETRY_SWEEP_MS);
  retryTimer.unref?.();

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'Invalid request', details: err.flatten() });
    }
    const statusCode =
      typeof (err as { statusCode?: number }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;
    if (statusCode < 500) {
      const message = err instanceof Error ? err.message : 'Request failed';
      return reply.code(statusCode).send({ error: message });
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
