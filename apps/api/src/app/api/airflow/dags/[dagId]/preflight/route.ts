import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { AirflowDagController } from '@/modules/airflow/controllers';
import { DagIdParamSchema, PreflightBodySchema } from '@/modules/airflow/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ dagId: string }> };

/**
 * The typed preflight.
 *
 * This endpoint never triggers anything: it reports whether a trigger
 * *would* be accepted, which conf keys are allowed, which datasets the DAG
 * touches and what the operator should know before pressing the button.
 */
const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, DagIdParamSchema);
  const raw = await req.json().catch(() => ({}));
  const body = PreflightBodySchema.parse(raw ?? {});
  const data = await AirflowDagController.preflight(params, body);
  return ok(data);
};

export const POST = withSecurity(handlePost);

/**
 * @openapi
 * /api/airflow/dags/{dagId}/preflight:
 *   post:
 *     tags: [Airflow]
 *     summary: Evaluate a DAG trigger without triggering it
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
 *     responses:
 *       200: { description: Preflight result with per-check severities }
 *       404: { description: DAG not found }
 */
