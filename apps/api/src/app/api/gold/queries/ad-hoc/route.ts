import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { GoldQueriesController } from '@/modules/gold-queries/controllers';
import { AdHocQuerySchema } from '@/modules/gold-queries/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = AdHocQuerySchema.parse({
    sql: url.searchParams.get('sql') ?? '',
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await GoldQueriesController.adHoc(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold/queries/ad-hoc:
 *   get:
 *     tags: [Gold Queries]
 *     summary: Run custom SELECT SQL (sandbox: no writes, single statement, max 10000 rows)
 *     parameters:
 *       - in: query
 *         name: sql
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 1000, maximum: 10000 }
 *     responses:
 *       200: { description: Query result }
 *       400: { description: Invalid SQL (forbidden keyword, multi-statement, etc.) }
 */