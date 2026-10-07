import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { TableController } from '@/modules/catalog';
import { TableIdParamsSchema, SampleQuerySchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest, ctx) => {
  const params = await unwrapParams(ctx, TableIdParamsSchema);
  const url = new URL(req.url);
  const query = SampleQuerySchema.parse({
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await TableController.getSample(params, query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/tables/{tableId}/sample:
 *   get:
 *     tags: [Catalog]
 *     summary: Sample rows from a Delta table (live DuckDB query)
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *     responses:
 *       200: { description: Sample rows }
 *       404: { description: Table not found }
 */