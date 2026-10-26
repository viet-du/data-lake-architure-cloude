import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { accepted, unwrapParams } from '@/lib/http';
import { OperationController } from '@/modules/operations/controllers';
import { OperationIdParamSchema, RetryOperationBodySchema } from '@/modules/operations/schemas';
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

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, OperationIdParamSchema);
  // An empty body is a valid retry request — the default is "retry only a
  // failed operation".
  const raw = await req.text();
  const body = RetryOperationBodySchema.parse(raw.trim() ? JSON.parse(raw) : {});
  const idempotencyKey = req.headers.get('idempotency-key') ?? undefined;
  const operation = await OperationController.retry(params, body, resolveOwner(ctx), idempotencyKey);
  return accepted({
    operationId: operation.operationId,
    status: operation.status,
    retryOfOperationId: operation.retryOfOperationId,
    attempt: operation.attempt,
  });
};

export const POST = withSecurity(handlePost);

/**
 * @openapi
 * /api/operations/{operationId}/retry:
 *   post:
 *     tags: [Operations]
 *     summary: Retry an operation as a new linked attempt
 *     parameters:
 *       - in: path
 *         name: operationId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force: { type: boolean, default: false }
 *     responses:
 *       202: { description: Retry accepted }
 *       409: { description: Operation not retryable }
 *       404: { description: Operation not found }
 */
