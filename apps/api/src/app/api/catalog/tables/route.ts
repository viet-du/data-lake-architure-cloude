import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { TableController } from '@/modules/catalog';
import { TableLayerQuerySchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = TableLayerQuerySchema.parse({
    layer: url.searchParams.get('layer') ?? undefined,
    database: url.searchParams.get('database') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  const data = await TableController.list(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/catalog/tables:
 *   get:
 *     tags: [Catalog]
 *     summary: List all tables (optionally filtered)
 *     parameters:
 *       - in: query
 *         name: layer
 *         schema: { type: string, enum: [bronze, silver, gold] }
 *       - in: query
 *         name: database
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: List of tables }
 *       400: { description: Invalid query }
 */