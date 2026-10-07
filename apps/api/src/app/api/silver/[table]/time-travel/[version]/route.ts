import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { SilverTableController } from '@/modules/silver/controllers';
import { TimeTravelParamsSchema, TimeTravelQuerySchema } from '@/modules/silver/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string; version: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TimeTravelParamsSchema);
  const url = new URL(req.url);
  const query = TimeTravelQuerySchema.parse({
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await SilverTableController.timeTravel(params, query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/silver/{table}/time-travel/{version}:
 *   get:
 *     tags: [Silver]
 *     summary: Read data at a specific Delta version
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: version
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 1000 }
 *     responses:
 *       200: { description: Time-travel data snapshot }
 */