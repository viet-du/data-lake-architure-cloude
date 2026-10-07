import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { CrawlerConfigController } from '@/modules/crawler/controllers';
import { CrawlerNameParamSchema, CrawlerConfigBodySchema } from '@/modules/crawler/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ name: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, CrawlerNameParamSchema);
  const data = await CrawlerConfigController.get(params);
  return ok(data);
};

const handlePut: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, CrawlerNameParamSchema);
  const body = CrawlerConfigBodySchema.parse(await req.json().catch(() => ({})));
  const data = await CrawlerConfigController.update(params, body);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const PUT = withRequestId(withErrorHandler(handlePut));

/**
 * @openapi
 * /api/crawler/{name}/config:
 *   get:
 *     tags: [Crawler]
 *     summary: Get crawler config (rate limit, timeout, workers, kafka topic)
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string, enum: [tiki, github, crypto, weather, hackernews] }
 *     responses:
 *       200: { description: Config }
 *   put:
 *     tags: [Crawler]
 *     summary: Update crawler config
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
 *               rateLimit: { type: number, minimum: 0.1, maximum: 60 }
 *               maxRetries: { type: integer, minimum: 0, maximum: 10 }
 *               timeout: { type: integer, minimum: 5, maximum: 300 }
 *               maxWorkers: { type: integer, minimum: 1, maximum: 32 }
 *               kafkaTopic: { type: string, nullable: true }
 *               userAgent: { type: string }
 *     responses:
 *       200: { description: Updated config }
 */