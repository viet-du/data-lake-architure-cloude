import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { DqRuleController } from '@/modules/dq/controllers';
import { RuleIdParamSchema, UpdateRuleBodySchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ ruleId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RuleIdParamSchema);
  const data = await DqRuleController.get(params);
  return ok(data);
};

const handlePut: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RuleIdParamSchema);
  const body = await req.json();
  const data = await DqRuleController.update(params, UpdateRuleBodySchema.parse(body));
  return ok(data);
};

const handleDelete: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, RuleIdParamSchema);
  const data = await DqRuleController.remove(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const PUT = withRequestId(withErrorHandler(handlePut));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/dq/rules/{ruleId}:
 *   get:
 *     tags: [DQ]
 *     summary: Get DQ rule detail
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Rule detail }
 *       404: { description: Rule not found }
 *   put:
 *     tags: [DQ]
 *     summary: Update DQ rule
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Rule updated }
 *   delete:
 *     tags: [DQ]
 *     summary: Delete DQ rule
 *     parameters:
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Rule deleted }
 */
