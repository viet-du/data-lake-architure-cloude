import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { AirflowTaskController } from '@/modules/airflow/controllers';
import { RunIdParamSchema, TaskListQuerySchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ dagId: string; runId: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RunIdParamSchema);
  const url = new URL(req.url);
  const query = TaskListQuerySchema.parse({
    state: url.searchParams.get('state') ?? undefined,
  });
  const data = await AirflowTaskController.list(params, query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/airflow/dags/{dagId}/runs/{runId}/tasks:
 *   get:
 *     tags: [Airflow]
 *     summary: List task instances in a run
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
 *       200: { description: Task instances }
 */
