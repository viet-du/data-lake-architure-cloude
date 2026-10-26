import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { created } from '@/lib/http';
import { EdaController } from '@/modules/eda/controllers';
import { ProposeRuleBodySchema } from '@/modules/eda/schemas';

export const runtime = 'nodejs';

/**
 * `POST /api/eda/propose-rule` — the EDA → DQ bridge.
 *
 * MASTER PLAN §07.5: "chart offers `[Propose rule]` with prefilled
 * dataset/column, default disabled/draft; user reviews and saves
 * version."
 *
 * The rule is therefore created **disabled** unless the caller explicitly
 * asks for an enabled rule. The response carries the suggested threshold
 * so the reviewer sees what the profile observed.
 */
const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = ProposeRuleBodySchema.parse(await req.json());
  return created(await EdaController.proposeRule(body));
};

export const POST = withSecurity(handlePost);

/**
 * @openapi
 * /api/eda/propose-rule:
 *   post:
 *     tags: [EDA]
 *     summary: Propose a DQ rule from an EDA finding
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [profileId, column]
 *             properties:
 *               profileId: { type: string }
 *               column: { type: string }
 *               type:
 *                 type: string
 *                 enum: [null_check, range_check, in_set, unique, regex]
 *               threshold: { type: number }
 *               name: { type: string }
 *               enabled: { type: boolean, default: false }
 *     responses:
 *       201: { description: The proposed rule (created as a draft) }
 *       404: { description: Profile or column not found }
 *       422: { description: The rule cannot be derived from the profile }
 */
