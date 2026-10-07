import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { accepted, unwrapParams } from '@/lib/http';
import { CrawlerRunController } from '@/modules/crawler/controllers';
import { CrawlerNameParamSchema, CrawlerRunRequestBodySchema } from '@/modules/crawler/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ name: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, CrawlerNameParamSchema);
  const body = CrawlerRunRequestBodySchema.parse(await req.json().catch(() => ({})));
  const data = await CrawlerRunController.runAsync(params, body);
  return accepted(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/crawler/{name}/run-async:
 *   post:
 *     tags: [Crawler]
 *     summary: Trigger async crawler run (BullMQ)
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string, enum: [tiki, github, crypto, weather, hackernews] }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               category: { type: string }
 *               maxPages: { type: integer, default: 5, maximum: 100 }
 *               language: { type: string }
 *               since: { type: string, enum: [daily, weekly, monthly] }
 *               dryRun: { type: boolean, default: false }
 *     responses:
 *       202: { description: Run enqueued }
 */