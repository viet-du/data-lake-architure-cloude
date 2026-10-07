import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { AirflowDagController } from '@/modules/airflow/controllers';
import { DagIdParamSchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ dagId: string }> };

const handlePost: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, DagIdParamSchema);
  const data = await AirflowDagController.pause(params);
  return ok(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/airflow/dags/{dagId}/pause:
 *   post:
 *     tags: [Airflow]
 *     summary: Pause a DAG
 *     parameters:
 *       - in: path
 *         name: dagId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: DAG paused }
 *       404: { description: DAG not found }
 */
