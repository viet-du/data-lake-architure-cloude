import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { GoldAggregateController } from '@/modules/gold/controllers';
import { TableParamsSchema, AggregateBodySchema } from '@/modules/gold/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const body = AggregateBodySchema.parse(await req.json().catch(() => ({})));
  const data = await GoldAggregateController.aggregateOne(params, body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/gold/{table}/aggregate:
 *   post:
 *     tags: [Gold]
 *     summary: Trigger aggregate Silver -> Gold for one table
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
 *               kind: { type: string, enum: [full, incremental, refresh], default: full }
 *               sourceTables:
 *                 type: array
 *                 items: { type: string }
 *               partition: { type: string, format: date }
 *               qualityChecks: { type: boolean, default: true }
 *     responses:
 *       201: { description: Job created }
 */