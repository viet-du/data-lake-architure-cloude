import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { GoldTableController } from '@/modules/gold/controllers';
import { TableListQuerySchema } from '@/modules/gold/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = TableListQuerySchema.parse({
    database: url.searchParams.get('database') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    kind: url.searchParams.get('kind') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  const data = await GoldTableController.list(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold:
 *   get:
 *     tags: [Gold]
 *     summary: List all Gold tables (facts + dims + metrics)
 *     parameters:
 *       - in: query
 *         name: database
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: kind
 *         schema: { type: string, enum: [fact, dimension, metric] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: List of gold tables }
 */