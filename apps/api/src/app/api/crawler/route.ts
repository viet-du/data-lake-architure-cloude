import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { CrawlerController } from '@/modules/crawler/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await CrawlerController.list();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/crawler:
 *   get:
 *     tags: [Crawler]
 *     summary: List all crawlers (tiki, github, crypto, weather, hackernews)
 *     responses:
 *       200: { description: List of crawlers }
 */