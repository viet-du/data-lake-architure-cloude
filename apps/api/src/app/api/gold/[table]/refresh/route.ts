import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { GoldAggregateController } from '@/modules/gold/controllers';
import { TableParamsSchema, RefreshBodySchema } from '@/modules/gold/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const body = RefreshBodySchema.parse(await req.json().catch(() => ({})));
  const data = await GoldAggregateController.refresh(params, body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/gold/{table}/refresh:
 *   post:
 *     tags: [Gold]
 *     summary: Drop + rebuild a Gold table from Silver
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               partition: { type: string, format: date }
 *               preserveHistory: { type: boolean, default: false }
 *     responses:
 *       201: { description: Refresh job created }
 */