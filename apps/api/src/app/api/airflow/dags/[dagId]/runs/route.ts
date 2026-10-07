import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { AirflowDagController } from '@/modules/airflow/controllers';
import { DagIdParamSchema, RunsListQuerySchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ dagId: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, DagIdParamSchema);
  const url = new URL(req.url);
  const query = RunsListQuerySchema.parse({
    state: url.searchParams.get('state') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
    startDateGte: url.searchParams.get('startDateGte') ?? undefined,
    startDateLte: url.searchParams.get('startDateLte') ?? undefined,
    orderBy: url.searchParams.get('orderBy') ?? undefined,
  });
  const data = await AirflowDagController.listRuns(params, query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/airflow/dags/{dagId}/runs:
 *   get:
 *     tags: [Airflow]
 *     summary: List DAG runs (filter: state, date)
 *     parameters:
 *       - in: path
 *         name: dagId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string, enum: [success, failed, running, queued, skipped, up_for_retry, upstream_failed, planned, none] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 25 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: List of runs }
 */
