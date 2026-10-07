import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { DqSummaryController } from '@/modules/dq/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await DqSummaryController.summary();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/dq/summary:
 *   get:
 *     tags: [DQ]
 *     summary: DQ summary dashboard (pass rate, byLayer, topFailedRules, recentRuns)
 *     responses:
 *       200: { description: DQ summary }
 */