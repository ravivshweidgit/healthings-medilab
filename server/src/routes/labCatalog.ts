import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/authenticate.js';
import {
  ensureLabCatalogSeeded,
  getLabCountryCatalog,
  listLabCountries,
} from '../services/labCatalog.js';

/**
 * App-facing lab PDF catalog (prompt113 / be-43).
 * GET /v1/lab/countries
 * GET /v1/lab/catalog/:countryCode
 */
export async function registerLabCatalogRoutes(app: FastifyInstance) {
  app.get('/v1/lab/countries', { preHandler: authenticate }, async (_request, reply) => {
    await ensureLabCatalogSeeded();
    const countries = await listLabCountries();
    return reply.send({ countries });
  });

  app.get<{ Params: { countryCode: string } }>(
    '/v1/lab/catalog/:countryCode',
    { preHandler: authenticate },
    async (request, reply) => {
      await ensureLabCatalogSeeded();
      const catalog = await getLabCountryCatalog(request.params.countryCode);
      if (!catalog) return reply.code(404).send({ error: 'Unknown lab country' });
      return reply.send(catalog);
    },
  );
}
