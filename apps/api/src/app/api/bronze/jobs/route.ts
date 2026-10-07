import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { BronzeJobController } from '@/modules/bronze/controllers';
import { JobListQuerySchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = JobListQuerySchema.parse({
    status: url.searchParams.get('status') ?? undefined,
    kind: url.searchParams.get('kind') ?? undefined,
    database: url.searchParams.get('database') ?? undefined,
    table: url.searchParams.get('table') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  const data = await BronzeJobController.list(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/bronze/jobs:
 *   get:
 *     tags: [Bronze]
 *     summary: List Bronze ingest jobs
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [queued, running, completed, failed, cancelled] }
 *       - in: query
 *         name: kind
 *         schema: { type: string, enum: [csv, json, stream] }
 *       - in: query
 *         name: database
 *         schema: { type: string }
 *       - in: query
 *         name: table
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 500 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Job list }
 */