import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParamsWithQuery } from '@/lib/http';
import { TableController } from '@/modules/catalog';
import { TableIdParamsSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest, ctx) => {
  const params = await unwrapParamsWithQuery(req, ctx, TableIdParamsSchema);
  const data = await TableController.getSchema(params);
  return ok(data);
};

export const GET = withSecurity(handleGet);

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