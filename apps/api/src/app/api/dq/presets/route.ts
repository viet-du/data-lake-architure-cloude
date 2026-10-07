import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { DqSummaryController } from '@/modules/dq/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await DqSummaryController.presets();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/dq/presets:
 *   get:
 *     tags: [DQ]
 *     summary: Preset DQ rule templates (null check, unique, range, regex, ...)
 *     responses:
 *       200: { description: List of presets }
 */