import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { DashboardController } from '@/modules/dashboard/controllers';

export const runtime = 'nodejs';

/**
 * `GET /api/dashboard/dependencies`
 *
 * The capability-aware dependency view.
 *
 * MASTER PLAN §09.6: each dependency reports whether it is reachable *and*
 * whether it is relevant to the current deployment. A local-only
 * deployment does not report Databricks as "down" when it was never asked
 * for it — the entry simply does not exist.
 */
const handleGet: RouteHandler = async () => {
  return ok(await DashboardController.dependencies());
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/dashboard/dependencies:
 *   get:
 *     tags: [Dashboard]
 *     summary: The dependency health of the current deployment
 *     responses:
 *       200: { description: Dependency health }
 */
