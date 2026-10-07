import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { CatalogHealthController } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await CatalogHealthController.check();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/health:
 *   get:
 *     tags: [Catalog]
 *     summary: Catalog-specific health (Mongo + DuckDB)
 *     responses:
 *       200: { description: Catalog health status }
 */