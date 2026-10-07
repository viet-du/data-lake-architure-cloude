import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { DatabaseController } from '@/modules/catalog';
import { DatabaseParamsSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, DatabaseParamsSchema);
  const data = await DatabaseController.listTables(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/databases/{db}/tables:
 *   get:
 *     tags: [Catalog]
 *     summary: List tables in a database (from Mongo catalog)
 *     parameters:
 *       - in: path
 *         name: db
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of tables in the database }
 *       404: { description: Database not found }
 */