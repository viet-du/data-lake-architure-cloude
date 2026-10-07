import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { HealthController } from '@/modules/health';

export const runtime = 'nodejs';

const handler: RouteHandler = async () => {
  const data = await HealthController.check(false);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handler));

export async function HEAD(_req: NextRequest) {
  return new NextResponse(null, { status: 200 });
}

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Overall service health (lightweight)
 *     description: |
 *       Returns the overall status of the API control plane and per-service statuses.
 *       This is a lightweight check (no deep queries to downstream services).
 *     responses:
 *       200:
 *         description: Health status retrieved
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
 *                     timestamp:
 *                       type: string
 *                     uptime:
 *                       type: number
 *                     services:
 *                       type: array
 *                       items:
 *                         type: object
 *       500:
 *         description: Internal error
 */