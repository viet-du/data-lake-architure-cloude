import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { AirflowDagController } from '@/modules/airflow/controllers';
import { DagIdParamSchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ dagId: string }> };

/**
 * The typed conf specification for a DAG.
 *
 * The trigger wizard renders a form from this. It never asks the operator
 * to type raw JSON, and the keys are exactly the ones the allowlist
 * accepts — so the form and the server can never disagree.
 */
const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, DagIdParamSchema);
  const data = await AirflowDagController.confSpec(params);
  return ok(data);
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/airflow/dags/{dagId}/conf-spec:
 *   get:
 *     tags: [Airflow]
 *     summary: The typed conf specification of a DAG
 *     parameters:
 *       - in: path
 *         name: dagId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Conf keys, types, options and affected datasets }
 *       404: { description: DAG not found }
 */
