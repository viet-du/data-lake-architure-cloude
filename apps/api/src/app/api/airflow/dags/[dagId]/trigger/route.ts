import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { AirflowDagController } from '@/modules/airflow/controllers';
import { DagIdParamSchema, TriggerDagBodySchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ dagId: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, DagIdParamSchema);
  const body = await req.json();
  const data = await AirflowDagController.trigger(params, TriggerDagBodySchema.parse(body));
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/airflow/dags/{dagId}/trigger:
 *   post:
 *     tags: [Airflow]
 *     summary: Trigger a DAG run
 *     parameters:
 *       - in: path
 *         name: dagId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conf: { type: object, additionalProperties: true, default: {} }
 *               note: { type: string, maxLength: 255 }
 *               logicalDate: { type: string, format: date-time }
 *               runId: { type: string, maxLength: 250 }
 *     responses:
 *       201: { description: DAG run created }
 *       404: { description: DAG not found }
 */
