import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { CrawlerController } from '@/modules/crawler/controllers';
import { CrawlerNameParamSchema } from '@/modules/crawler/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ name: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, CrawlerNameParamSchema);
  const data = await CrawlerController.getKafkaTopic(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/crawler/{name}/kafka-topic:
 *   get:
 *     tags: [Crawler]
 *     summary: Kafka topic that this crawler pushes items to
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string, enum: [tiki, github, crypto, weather, hackernews] }
 *     responses:
 *       200: { description: Kafka topic info }
 */