import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { SilverTableController } from '@/modules/silver/controllers';
import { TableListQuerySchema } from '@/modules/silver/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = TableListQuerySchema.parse({
    database: url.searchParams.get('database') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  const data = await SilverTableController.list(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/silver:
 *   get:
 *     tags: [Silver]
 *     summary: List all Silver tables
 *     parameters:
 *       - in: query
 *         name: database
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: List of silver tables }
 */