import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created } from '@/lib/http';
import { DqRunController } from '@/modules/dq/controllers';
import { RunSuiteBodySchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = await req.json();
  const data = await DqRunController.runSuite(RunSuiteBodySchema.parse(body));
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/dq/run-suite:
 *   post:
 *     tags: [DQ]
 *     summary: Run a suite of DQ rules
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ruleIds]
 *             properties:
 *               name: { type: string, default: ad-hoc-suite }
 *               ruleIds: { type: array, items: { type: string } }
 *               partition: { type: string }
 *               limit: { type: integer, default: 1000 }
 *               sampleSize: { type: integer, default: 10 }
 *     responses:
 *       201: { description: Suite run created }
 *       400: { description: No enabled rules }
 */
