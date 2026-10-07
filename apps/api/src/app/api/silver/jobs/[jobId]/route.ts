import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, noContent, unwrapParams } from '@/lib/http';
import { SilverJobController } from '@/modules/silver/controllers';
import { JobIdParamsSchema } from '@/modules/silver/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ jobId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, JobIdParamsSchema);
  const data = await SilverJobController.get(params);
  return ok(data);
};

const handleDelete: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, JobIdParamsSchema);
  await SilverJobController.delete(params);
  return noContent();
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/silver/jobs/{jobId}:
 *   get:
 *     tags: [Silver]
 *     summary: Get one Silver job status
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job status }
 *   delete:
 *     tags: [Silver]
 *     summary: Cancel + delete a Silver job
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Job removed }
 */