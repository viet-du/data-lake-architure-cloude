import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { GoldQueriesController } from '@/modules/gold-queries/controllers';
import { CategoryRevenueQuerySchema } from '@/modules/gold-queries/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = CategoryRevenueQuerySchema.parse({
    parent_category: url.searchParams.get('parent_category') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await GoldQueriesController.categoryRevenue(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold/queries/category-revenue:
 *   get:
 *     tags: [Gold Queries]
 *     summary: Run category revenue SQL (top parent categories + market share + growth rate)
 *     parameters:
 *       - in: query
 *         name: parent_category
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 1000 }
 *     responses:
 *       200: { description: Query result }
 */