import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { TableController } from '@/modules/catalog';
import { TableIdParamsSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handlePost: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, TableIdParamsSchema);
  const data = await TableController.sync(params);
  return ok(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/catalog/tables/{tableId}/sync:
 *   post:
 *     tags: [Catalog]
 *     summary: Sync a single table from Delta → Mongo catalog
 *     description: |
 *       Triggers a sync of the table's metadata (schema, columns, partitions,
 *       row count, delta history version) from the Delta Lake log on MinIO
 *       into the MongoDB catalog. Also auto-infers lineage.
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Sync completed }
 *       500: { description: Sync failed (Delta table missing or DuckDB error) }
 */