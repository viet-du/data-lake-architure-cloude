import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { DqRunController } from '@/modules/dq/controllers';
import { RunIdParamSchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ runId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RunIdParamSchema);
  const data = await DqRunController.get(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/dq/runs/{runId}:
 *   get:
 *     tags: [DQ]
 *     summary: Get DQ run detail
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Run detail }
 *       404: { description: Run not found }
 */
