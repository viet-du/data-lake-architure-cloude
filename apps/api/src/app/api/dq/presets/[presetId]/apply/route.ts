import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { DqPresetController } from '@/modules/dq/controllers';
import { PresetApplyBodySchema, PresetIdParamSchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ presetId: string }> };

/**
 * `POST /api/dq/presets/{presetId}/apply` — create the preset rule.
 *
 * MASTER PLAN DQ-009: the application is **idempotent** — the identity tag
 * `preset:{presetId}|{layer}|{table}|{column}` makes a repeated apply
 * return the existing rule instead of creating a duplicate. No unrelated
 * rule of the catalogue is ever created.
 *
 * The rule is created **disabled** by default (draft mode, §06.6): the
 * owner reviews and enables it explicitly.
 */
const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, PresetIdParamSchema);
  const body = PresetApplyBodySchema.parse(await req.json());
  return ok(
    await DqPresetController.apply(params, body.target, {
      ...(body.severity !== undefined ? { severity: body.severity } : {}),
      enabled: body.enabled,
    }),
  );
};

export const POST = withSecurity(handlePost);

/**
 * @openapi
 * /api/dq/presets/{presetId}/apply:
 *   post:
 *     tags: [DQ]
 *     summary: Apply a DQ preset to a dataset column (idempotent)
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
 *               severity: { type: string, enum: [low, medium, high, critical] }
 *               enabled: { type: boolean, default: false }
 *     responses:
 *       200: { description: The created (or existing) rule }
 *       404: { description: Preset not found }
 *       422: { description: The preset does not apply to this dataset }
 */
