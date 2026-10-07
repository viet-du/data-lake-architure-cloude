import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { GoldQueriesController } from '@/modules/gold-queries/controllers';
import { ProductPerformanceQuerySchema } from '@/modules/gold-queries/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = ProductPerformanceQuerySchema.parse({
    category: url.searchParams.get('category') ?? undefined,
    days: url.searchParams.get('days') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await GoldQueriesController.productPerformance(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold/queries/product-performance:
 *   get:
 *     tags: [Gold Queries]
 *     summary: Run product performance SQL (category performance + slow movers + best sellers)
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 90, maximum: 365 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 1000 }
 *     responses:
 *       200: { description: Query result }
 */