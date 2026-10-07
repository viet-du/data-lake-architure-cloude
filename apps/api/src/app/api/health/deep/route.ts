import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { HealthController } from '@/modules/health';

export const runtime = 'nodejs';

const handler: RouteHandler = async () => {
  const data = await HealthController.check(true);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handler));

/**
 * @openapi
 * /api/health/deep:
 *   get:
 *     tags:
 *       - Health
 *     summary: Deep health check (per-service connectivity)
 *     description: |
 *       Performs actual connectivity checks against each downstream service:
 *       MongoDB ping, Redis PING, DuckDB SELECT 1, MinIO HeadBucket,
 *       Kafka listTopics, Airflow /health.
 *     responses:
 *       200:
 *         description: Deep health status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [ok, degraded, down]
 *                     services:
 *                       type: array
 *       500:
 *         description: Internal error
 */