import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { DqPresetController } from '@/modules/dq/controllers';
import { PresetCheckBodySchema, PresetIdParamSchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ presetId: string }> };

/**
 * `POST /api/dq/presets/{presetId}/check` — preset applicability.
 *
 * MASTER PLAN DQ-009: the wizard "checks columns/type" before anything is
 * created. The check is read-only: it resolves the dataset schema through
 * the catalog repository and reports whether the preset fits the requested
 * column — and, when it does not, exactly why.
 */
const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, PresetIdParamSchema);
  const body = PresetCheckBodySchema.parse(await req.json());
  return ok(await DqPresetController.check(params, body.target));
};

export const POST = withSecurity(handlePost);

/**
 * @openapi
 * /api/dq/presets/{presetId}/check:
 *   post:
 *     tags: [DQ]
 *     summary: Check whether a DQ preset applies to a dataset column
 *     parameters:
 *       - in: path
 *         name: presetId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [target]
 *             properties:
 *               target:
 *                 type: object
 *                 required: [layer, table]
 *                 properties:
 *                   layer: { type: string, enum: [bronze, silver, gold] }
 *                   table: { type: string }
 *                   column: { type: string }
 *     responses:
 *       200: { description: Applicability report }
 *       404: { description: Preset not found }
 */
