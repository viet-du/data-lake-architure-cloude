import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, noContent, unwrapParams } from '@/lib/http';
import { BronzeJobController } from '@/modules/bronze/controllers';
import { JobIdParamsSchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ jobId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, JobIdParamsSchema);
  const data = await BronzeJobController.get(params);
  return ok(data);
};

const handleDelete: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, JobIdParamsSchema);
  await BronzeJobController.delete(params);
  return noContent();
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/bronze/jobs/{jobId}:
 *   get:
 *     tags: [Bronze]
 *     summary: Get one Bronze job status
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job status }
 *   delete:
 *     tags: [Bronze]
 *     summary: Cancel + delete a Bronze job
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Job removed }
 */