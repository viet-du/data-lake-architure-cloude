import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { GoldJobController } from '@/modules/gold/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await GoldJobController.stats();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/gold/jobs/stats:
 *   get:
 *     tags: [Gold]
 *     summary: Aggregate stats over Gold aggregate jobs
 *     responses:
 *       200: { description: Job stats }
 */