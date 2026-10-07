import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { SchemaController } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await SchemaController.list();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/schemas:
 *   get:
 *     tags: [Catalog]
 *     summary: List all schema definitions (managed in Mongo catalog_schemas)
 *     responses:
 *       200: { description: List of schema definitions }
 */