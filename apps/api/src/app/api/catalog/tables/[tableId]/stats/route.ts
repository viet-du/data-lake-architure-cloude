import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParamsWithQuery } from '@/lib/http';
import { TableController } from '@/modules/catalog';
import { TableIdParamsSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest, ctx) => {
  const params = await unwrapParamsWithQuery(req, ctx, TableIdParamsSchema);
  const data = await TableController.getStats(params);
  return ok(data);
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/catalog/tables/{tableId}/stats:
 *   get:
 *     tags: [Catalog]
 *     summary: Get table statistics (row count, size, partition count, history version)
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Table stats }
 *       404: { description: Table not found }
 */