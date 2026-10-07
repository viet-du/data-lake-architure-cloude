import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { SchemaController } from '@/modules/catalog';
import { SchemaNameParamsSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, SchemaNameParamsSchema);
  const data = await SchemaController.get(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/schemas/{name}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get a schema definition by name
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Schema definition }
 *       404: { description: Schema not found }
 */