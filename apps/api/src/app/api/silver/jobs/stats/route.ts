import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { SilverJobController } from '@/modules/silver/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await SilverJobController.stats();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/silver/jobs/stats:
 *   get:
 *     tags: [Silver]
 *     summary: Aggregate stats over Silver transform jobs
 *     responses:
 *       200: { description: Job stats }
 */