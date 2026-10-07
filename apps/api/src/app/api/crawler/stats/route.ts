import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { CrawlerController } from '@/modules/crawler/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await CrawlerController.stats();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/crawler/stats:
 *   get:
 *     tags: [Crawler]
 *     summary: Aggregate stats per crawler (total runs, success, failed, items)
 *     responses:
 *       200: { description: Crawler stats array }
 */