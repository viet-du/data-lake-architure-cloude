import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created } from '@/lib/http';
import { GoldAggregateController } from '@/modules/gold/controllers';
import { AggregateAllBodySchema } from '@/modules/gold/schemas';

export const runtime = 'nodejs';

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = AggregateAllBodySchema.parse(await req.json().catch(() => ({})));
  const data = await GoldAggregateController.aggregateAll(body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/gold/aggregate/all:
 *   post:
 *     tags: [Gold]
 *     summary: Trigger Gold aggregate for all tables
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kind: { type: string, enum: [full, incremental, refresh], default: full }
 *               parallel: { type: integer, default: 4, maximum: 16 }
 *               qualityChecks: { type: boolean, default: true }
 *     responses:
 *       201: { description: All jobs enqueued }
 */