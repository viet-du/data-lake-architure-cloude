import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { TableController } from '@/modules/catalog';
import { TableIdParamsSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, TableIdParamsSchema);
  const data = await TableController.getLineage(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/tables/{tableId}/lineage:
 *   get:
 *     tags: [Catalog]
 *     summary: Get table lineage (upstream + downstream)
 *     description: |
 *       Returns the lineage graph for a table. If the table has no explicit
 *       lineage set in Mongo, the system will auto-infer lineage from naming
 *       conventions across the medallion layers (bronze/silver/gold).
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lineage graph }
 *       404: { description: Table not found }
 */