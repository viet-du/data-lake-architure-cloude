import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { CrawlerRunController } from '@/modules/crawler/controllers';
import { CrawlerRunIdParamSchema } from '@/modules/crawler/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ name: string; runId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, CrawlerRunIdParamSchema);
  const data = await CrawlerRunController.getRun(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/crawler/{name}/runs/{runId}:
 *   get:
 *     tags: [Crawler]
 *     summary: Get a run detail (stats + items + errors)
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string, enum: [tiki, github, crypto, weather, hackernews] }
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Run detail }
 */