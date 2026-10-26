import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { accepted, unwrapParams } from '@/lib/http';
import { OperationController } from '@/modules/operations/controllers';
import { OperationIdParamSchema } from '@/modules/operations/schemas';
import { syntheticPrincipal } from '@/modules/security/services';
import type { Principal } from '@/modules/security/types';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ operationId: string }> };

function resolveOwner(ctx: unknown): { principalId: string; principalKind: string } {
  const principal = (ctx as { principal?: Principal } | undefined)?.principal;
  if (!principal) {
    const synthetic = syntheticPrincipal();
    return { principalId: synthetic.principalId, principalKind: synthetic.kind };
  }
  return { principalId: principal.principalId, principalKind: principal.kind };
}

const handlePost: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, OperationIdParamSchema);
  const operation = await OperationController.cancel(params, resolveOwner(ctx));
  return accepted({
    operationId: operation.operationId,
    status: operation.status,
    cancellable: operation.cancellable,
  });
};

export const POST = withSecurity(handlePost);

/**
 * @openapi
 * /api/operations/{operationId}/cancel:
 *   post:
 *     tags: [Operations]
 *     summary: Request cancellation of an operation
 *     parameters:
 *       - in: path
 *         name: operationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       202: { description: Cancellation accepted }
 *       409: { description: Operation already terminal or not cancellable }
 *       404: { description: Operation not found }
 */
