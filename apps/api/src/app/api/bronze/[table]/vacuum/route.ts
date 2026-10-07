import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { BronzeTableController } from '@/modules/bronze/controllers';
import { TableParamsSchema, VacuumBodySchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const body = VacuumBodySchema.parse(await req.json().catch(() => ({})));
  const data = await BronzeTableController.vacuum(params, body);
  return ok(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/bronze/{table}/vacuum:
 *   post:
 *     tags: [Bronze]
 *     summary: Run Delta VACUUM on a Bronze table
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               retentionDays: { type: integer, default: 7, maximum: 365 }
 *               dryRun: { type: boolean, default: false }
 *     responses:
 *       200: { description: Vacuum result }
 */