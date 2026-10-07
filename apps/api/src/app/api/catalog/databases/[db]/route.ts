import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, noContent, unwrapParams } from '@/lib/http';
import { DatabaseController } from '@/modules/catalog';
import { DatabaseParamsSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, DatabaseParamsSchema);
  const data = await DatabaseController.get(params);
  return ok(data);
};

const handleDelete: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, DatabaseParamsSchema);
  await DatabaseController.delete(params);
  return noContent();
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/catalog/databases/{db}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get database by name
 *     parameters:
 *       - in: path
 *         name: db
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Database metadata }
 *       404: { description: Database not found }
 *   delete:
 *     tags: [Catalog]
 *     summary: Delete a database
 *     parameters:
 *       - in: path
 *         name: db
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Database deleted }
 *       404: { description: Database not found }
 */