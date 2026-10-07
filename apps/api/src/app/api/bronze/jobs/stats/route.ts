import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { BronzeJobController } from '@/modules/bronze/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await BronzeJobController.stats();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/bronze/jobs/stats:
 *   get:
 *     tags: [Bronze]
 *     summary: Aggregate stats over Bronze ingest jobs
 *     responses:
 *       200: { description: Job stats }
 */