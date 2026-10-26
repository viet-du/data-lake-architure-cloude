import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { accepted, ok } from '@/lib/http';
import { OperationController } from '@/modules/operations/controllers';
import { CreateOperationBodySchema } from '@/modules/operations/schemas';
import { syntheticPrincipal } from '@/modules/security/services';
import type { Principal } from '@/modules/security/types';

export const runtime = 'nodejs';

/**
 * Resolve the calling principal from the authenticated context.
 *
 * `withAuth` always attaches a principal — a synthetic one when
 * authentication is disabled or the route is public — so the operation
 * always has an owner and the run history always has an actor.
 */
function resolveOwner(ctx: unknown): { principalId: string; principalKind: string } {
  const principal = (ctx as { principal?: Principal } | undefined)?.principal;
  if (!principal) {
    const synthetic = syntheticPrincipal();
    return { principalId: synthetic.principalId, principalKind: synthetic.kind };
  }
  return { principalId: principal.principalId, principalKind: principal.kind };
}

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const body = CreateOperationBodySchema.parse(await req.json());
  const idempotencyKey = req.headers.get('idempotency-key') ?? undefined;
  const operation = await OperationController.create(body, resolveOwner(ctx), idempotencyKey);
  return accepted({
    operationId: operation.operationId,
    status: operation.status,
    traceId: operation.traceId,
    links: { self: `/api/operations/${operation.operationId}` },
  });
};

export const POST = withSecurity(handlePost);

export const GET = withSecurity((async (req: NextRequest) => {
  const url = new URL(req.url);
  const { OperationListQuerySchema } = await import('@/modules/operations/schemas');
  const query = OperationListQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await OperationController.list(query));
}) satisfies RouteHandler);

/**
 * @openapi
 * /api/operations:
 *   post:
 *     tags: [Operations]
 *     summary: Create a unified operation
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: false
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [kind, datasets]
 *             properties:
 *               kind: { type: string, enum: [bronze.ingest, silver.transform, gold.aggregate, dq.rule_run, crawler.run, airflow.dag_trigger] }
 *               executionTarget: { type: string, enum: [local_delta_minio, databricks_uc] }
 *               datasets:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [layer, database, table]
 *                   properties:
 *                     layer: { type: string, enum: [bronze, silver, gold] }
 *                     database: { type: string }
 *                     table: { type: string }
 *               params: { type: object }
 *               clientRequestId: { type: string }
 *     responses:
 *       202: { description: Operation accepted }
 *       400: { description: Invalid request }
 *       409: { description: Conflicting state }
 *   get:
 *     tags: [Operations]
 *     summary: List operations
 *     responses:
 *       200: { description: Operations page }
 */
