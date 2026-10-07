import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { SilverTableController } from '@/modules/silver/controllers';
import { TableParamsSchema } from '@/modules/silver/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const data = await SilverTableController.get(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/silver/{table}:
 *   get:
 *     tags: [Silver]
 *     summary: Get Silver table metadata + schema + partitions
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Silver table detail }
 *       404: { description: Not found }
 */