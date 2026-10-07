import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { AirflowDagController } from '@/modules/airflow/controllers';
import { DagListQuerySchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = DagListQuerySchema.parse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
    onlyActive: url.searchParams.get('onlyActive') ?? undefined,
    paused: url.searchParams.get('paused') ?? undefined,
    tags: url.searchParams.get('tags') ?? undefined,
    pattern: url.searchParams.get('pattern') ?? undefined,
  });
  const data = await AirflowDagController.list(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/airflow/dags:
 *   get:
 *     tags: [Airflow]
 *     summary: List all DAGs from Airflow
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: onlyActive
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: paused
 *         schema: { type: boolean }
 *       - in: query
 *         name: tags
 *         schema: { type: string }
 *       - in: query
 *         name: pattern
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of DAGs }
 */
