import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { GoldQueriesController } from '@/modules/gold-queries/controllers';
import { CustomerAnalyticsQuerySchema } from '@/modules/gold-queries/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = CustomerAnalyticsQuerySchema.parse({
    segment: url.searchParams.get('segment') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await GoldQueriesController.customerAnalytics(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold/queries/customer-analytics:
 *   get:
 *     tags: [Gold Queries]
 *     summary: Run customer analytics SQL (RFM segmentation + cohort + top customers per city)
 *     parameters:
 *       - in: query
 *         name: segment
 *         schema: { type: string, enum: [Champion, Loyal, Active, At Risk, Lost, all], default: all }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 1000 }
 *     responses:
 *       200: { description: Query result }
 */