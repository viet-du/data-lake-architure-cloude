import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { GoldTableController } from '@/modules/gold/controllers';
import { TableParamsSchema, SampleQuerySchema } from '@/modules/gold/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const url = new URL(req.url);
  const query = SampleQuerySchema.parse({
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await GoldTableController.sample(params, query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold/{table}/sample:
 *   get:
 *     tags: [Gold]
 *     summary: Preview 100 rows of a Gold table
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 1000 }
 *     responses:
 *       200: { description: Sample rows }
 */