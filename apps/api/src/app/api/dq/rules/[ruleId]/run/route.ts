import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { DqRuleController } from '@/modules/dq/controllers';
import { RuleIdParamSchema, RunRuleBodySchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ ruleId: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RuleIdParamSchema);
  const body = await req.json();
  const data = await DqRuleController.run(params, RunRuleBodySchema.parse(body));
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/dq/rules/{ruleId}/run:
 *   post:
 *     tags: [DQ]
 *     summary: Run a single DQ rule
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               partition: { type: string }
 *               limit: { type: integer, default: 1000 }
 *               sampleSize: { type: integer, default: 10 }
 *     responses:
 *       201: { description: Run created }
 *       400: { description: Rule disabled }
 *       404: { description: Rule not found }
 */
