import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { SearchController } from '@/modules/catalog';
import { SearchQuerySchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = SearchQuerySchema.parse({
    q: url.searchParams.get('q') ?? '',
    layer: url.searchParams.get('layer') ?? undefined,
    database: url.searchParams.get('database') ?? undefined,
    tag: url.searchParams.get('tag') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  const data = await SearchController.search(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/search:
 *   get:
 *     tags: [Catalog]
 *     summary: Search tables by name, description, owner, tags
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: layer
 *         schema: { type: string, enum: [bronze, silver, gold] }
 *       - in: query
 *         name: database
 *         schema: { type: string }
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Matching tables }
 *       400: { description: Invalid query }
 */