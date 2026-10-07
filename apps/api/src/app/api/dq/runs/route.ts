import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { DqRunController } from '@/modules/dq/controllers';
import { RunsListQuerySchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = RunsListQuerySchema.parse({
    ruleId: url.searchParams.get('ruleId') ?? undefined,
    layer: url.searchParams.get('layer') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    trigger: url.searchParams.get('trigger') ?? undefined,
    suiteRunId: url.searchParams.get('suiteRunId') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  const data = await DqRunController.list(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/dq/runs:
 *   get:
 *     tags: [DQ]
 *     summary: List DQ run history
 *     parameters:
 *       - in: query
 *         name: ruleId
 *         schema: { type: string }
 *       - in: query
 *         name: layer
 *         schema: { type: string, enum: [bronze, silver, gold] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pass, fail, error] }
 *       - in: query
 *         name: suiteRunId
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of runs }
 */
