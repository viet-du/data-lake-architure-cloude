import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { GoldTableController } from '@/modules/gold/controllers';
import { TableParamsSchema } from '@/modules/gold/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const data = await GoldTableController.history(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold/{table}/history:
 *   get:
 *     tags: [Gold]
 *     summary: Delta log history audit for a Gold table
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: History list }
 */