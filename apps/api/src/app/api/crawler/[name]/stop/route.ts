import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { CrawlerRunController } from '@/modules/crawler/controllers';
import { CrawlerRunIdParamSchema } from '@/modules/crawler/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ name: string; runId: string }> };

const handlePost: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, CrawlerRunIdParamSchema);
  const data = await CrawlerRunController.stop(params);
  return ok(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/crawler/{name}/stop:
 *   post:
 *     tags: [Crawler]
 *     summary: Cancel a running crawl by runId
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string, enum: [tiki, github, crypto, weather, hackernews] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               runId: { type: string }
 *     responses:
 *       200: { description: Stop signal sent }
 */