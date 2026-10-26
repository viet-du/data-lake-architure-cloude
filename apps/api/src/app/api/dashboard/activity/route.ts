import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { DashboardController } from '@/modules/dashboard/controllers';
import { DashboardActivityQuerySchema } from '@/modules/dashboard/schemas';

export const runtime = 'nodejs';

/**
 * `GET /api/dashboard/activity`
 *
 * The activity feed.
 *
 * MASTER PLAN §08.2 requires the Home "Activity" card to show the *last
 * canonical events with actor/run/status/reference*, and forbids a
 * hard-coded list. Every entry here points at a real, persisted record:
 *
 *   * an operation entry links to `/api/operations/{operationId}`;
 *   * an audit entry links to the audited path.
 *
 * Nothing is synthesised: an empty feed means "nothing happened yet", and
 * it is rendered as such rather than as a failure.
 *
 * The feed is cursor-paged. The cursor is opaque and encodes both the
 * timestamp and the id of the last returned event, so the next page starts
 * strictly after it — no event is skipped or repeated across a page
 * boundary.
 */
const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = DashboardActivityQuerySchema.parse(
    Object.fromEntries(url.searchParams.entries()),
  );
  return ok(await DashboardController.activity(query));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/dashboard/activity:
 *   get:
 *     tags: [Dashboard]
 *     summary: The last canonical activity events
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema: { type: string }
 *         description: The opaque cursor of the previous page.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: kind
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: datasetId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Activity feed }
 */
