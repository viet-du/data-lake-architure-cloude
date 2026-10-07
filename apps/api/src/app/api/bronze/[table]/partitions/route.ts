import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { BronzeTableController } from '@/modules/bronze/controllers';
import { TableParamsSchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const data = await BronzeTableController.partitions(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/bronze/{table}/partitions:
 *   get:
 *     tags: [Bronze]
 *     summary: List partition dates of a Bronze table
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Partition list }
 */