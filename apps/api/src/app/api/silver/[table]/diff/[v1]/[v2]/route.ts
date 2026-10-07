import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { SilverTableController } from '@/modules/silver/controllers';
import { DiffParamsSchema } from '@/modules/silver/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string; v1: string; v2: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, DiffParamsSchema);
  const data = await SilverTableController.diff(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/silver/{table}/diff/{v1}/{v2}:
 *   get:
 *     tags: [Silver]
 *     summary: Diff two Delta versions of a Silver table
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: v1
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: v2
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Diff result }
 */