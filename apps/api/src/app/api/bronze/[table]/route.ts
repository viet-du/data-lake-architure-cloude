import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { BronzeTableController } from '@/modules/bronze/controllers';
import { TableParamsSchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const data = await BronzeTableController.get(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/bronze/{table}:
 *   get:
 *     tags: [Bronze]
 *     summary: Get Bronze table metadata + schema + partitions
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *         description: 'Fully qualified table name in form database.name (e.g. ecommerce.orders)'
 *     responses:
 *       200: { description: Bronze table detail }
 *       404: { description: Not found }
 */