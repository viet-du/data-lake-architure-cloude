import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { TableController } from '@/modules/catalog';
import { TableIdParamsSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, TableIdParamsSchema);
  const data = await TableController.getSchema(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/tables/{tableId}/schema:
 *   get:
 *     tags: [Catalog]
 *     summary: Get table schema (columns + types)
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Table schema }
 *       404: { description: Table not found }
 */