import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { OperationController } from '@/modules/operations/controllers';
import { OperationIdParamSchema } from '@/modules/operations/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ operationId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, OperationIdParamSchema);
  return ok(await OperationController.get(params));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/operations/{operationId}:
 *   get:
 *     tags: [Operations]
 *     summary: Get one operation
 *     parameters:
 *       - in: path
 *         name: operationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Operation }
 *       404: { description: Operation not found }
 */
