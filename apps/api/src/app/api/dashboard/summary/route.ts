import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { DashboardController } from '@/modules/dashboard/controllers';
import { DashboardSummaryQuerySchema } from '@/modules/dashboard/schemas';

export const runtime = 'nodejs';

/**
 * `GET /api/dashboard/summary`
 *
 * The Home KPI read model.
 *
 * MASTER PLAN §08 defines the metric contract, and this endpoint is its
 * only implementation. Two rules make the response trustworthy:
 *
 *  1. **Every metric is an object.** It carries its value, its provenance
 *     (`source`), its measurement window (`window`) and whether it is
 *     fresh (`status`). An unknown value is `null` — never a guessed `0`.
 *  2. **The record counts are not additive.** `recordsProcessed` is the
 *     unique committed input record count of the *Bronze ingestion stage*
 *     only. Silver and Gold re-process the same rows, so they are reported
 *     separately under `recordsByStage` and never added to it.
 *
 * The response is always HTTP 200 with a `partial` flag: a dependency that
 * is down degrades *one* metric to `unavailable` instead of failing the
 * whole dashboard.
 */
const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = DashboardSummaryQuerySchema.parse(
    Object.fromEntries(url.searchParams.entries()),
  );
  return ok(await DashboardController.summary(query));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: The Home KPI summary
 *     parameters:
 *       - in: query
 *         name: scope
 *         schema: { type: string }
 *       - in: query
 *         name: window
 *         schema: { type: string }
 *     responses:
 *       200: { description: The KPI summary }
 */
