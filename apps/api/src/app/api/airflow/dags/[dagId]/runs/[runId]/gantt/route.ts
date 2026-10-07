import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { AirflowTaskController } from '@/modules/airflow/controllers';
import { RunIdParamSchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ dagId: string; runId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RunIdParamSchema);
  const data = await AirflowTaskController.gantt(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/airflow/dags/{dagId}/runs/{runId}/gantt:
 *   get:
 *     tags: [Airflow]
 *     summary: Get Gantt chart data (task timeline)
 *     parameters:
 *       - in: path
 *         name: dagId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Gantt data }
 */
