import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, noContent, unwrapParams } from '@/lib/http';
import { GoldJobController } from '@/modules/gold/controllers';
import { JobIdParamsSchema } from '@/modules/gold/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ jobId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, JobIdParamsSchema);
  const data = await GoldJobController.get(params);
  return ok(data);
};

const handleDelete: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, JobIdParamsSchema);
  await GoldJobController.delete(params);
  return noContent();
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/gold/jobs/{jobId}:
 *   get:
 *     tags: [Gold]
 *     summary: Get one Gold job status
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job status }
 *   delete:
 *     tags: [Gold]
 *     summary: Cancel + delete a Gold job
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Job removed }
 */