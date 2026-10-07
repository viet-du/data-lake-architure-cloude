import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { HealthController } from '@/modules/health';

export const runtime = 'nodejs';

const handler: RouteHandler = async () => {
  const data = await HealthController.info();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handler));

/**
 * @openapi
 * /api/info:
 *   get:
 *     tags:
 *       - Health
 *     summary: Application info (name, version, env, uptime)
 *     responses:
 *       200:
 *         description: Application info retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     version:
 *                       type: string
 *                     env:
 *                       type: string
 *                     nodeVersion:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *       500:
 *         description: Internal error
 */