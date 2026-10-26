import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { DqRunController } from '@/modules/dq/controllers';
import { RunIdParamSchema, RunSamplesQuerySchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ runId: string }> };

/**
 * `GET /api/dq/runs/{runId}/samples` — the redacted failed samples.
 *
 * MASTER PLAN §06.5 / §13.3: only representative failed rows are returned,
 * the cap is bounded between 1 and 100, and PII is redacted *on the server*
 * before the rows leave the API. Raw sample rows are never returned.
 */
const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RunIdParamSchema);
  const url = new URL(req.url);
  const query = RunSamplesQuerySchema.parse({
    limit: url.searchParams.get('limit') ?? undefined,
  });
  return ok(await DqRunController.samples(params, query.limit));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/dq/runs/{runId}/samples:
 *   get:
 *     tags: [DQ]
 *     summary: Redacted failed samples of a DQ run
 *     parameters:
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200: { description: Redacted sample rows }
 *       404: { description: Run not found }
 */
