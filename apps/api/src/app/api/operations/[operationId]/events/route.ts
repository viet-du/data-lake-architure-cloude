import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { OperationController } from '@/modules/operations/controllers';
import { OperationEventsQuerySchema, OperationIdParamSchema } from '@/modules/operations/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ operationId: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, OperationIdParamSchema);
  const url = new URL(req.url);
  const query = OperationEventsQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await OperationController.events(params, query));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/operations/{operationId}/events:
 *   get:
 *     tags: [Operations]
 *     summary: List the ordered lifecycle events of an operation
 *     parameters:
 *       - in: path
 *         name: operationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Operation events }
 *       404: { description: Operation not found }
 */
