import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { AirflowDagController } from '@/modules/airflow/controllers';
import { RunIdParamSchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ dagId: string; runId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RunIdParamSchema);
  const data = await AirflowDagController.getRun(params);
  return ok(data);
};

const handleDelete: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RunIdParamSchema);
  const data = await AirflowDagController.deleteRun(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/airflow/dags/{dagId}/runs/{runId}:
 *   get:
 *     tags: [Airflow]
 *     summary: Get DAG run detail
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
 *       200: { description: Run detail }
 *       404: { description: Run not found }
 *   delete:
 *     tags: [Airflow]
 *     summary: Delete a DAG run
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
 *       200: { description: Run deleted }
 *       404: { description: Run not found }
 */
