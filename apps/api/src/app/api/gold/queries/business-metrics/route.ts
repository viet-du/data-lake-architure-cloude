import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { GoldQueriesController } from '@/modules/gold-queries/controllers';
import { BusinessMetricsQuerySchema } from '@/modules/gold-queries/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = BusinessMetricsQuerySchema.parse({
    days: url.searchParams.get('days') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await GoldQueriesController.businessMetrics(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold/queries/business-metrics:
 *   get:
 *     tags: [Gold Queries]
 *     summary: Run business metrics SQL queries (revenue trend, top customers, revenue by city, top products)
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30, maximum: 365 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 1000 }
 *     responses:
 *       200: { description: Query result }
 */