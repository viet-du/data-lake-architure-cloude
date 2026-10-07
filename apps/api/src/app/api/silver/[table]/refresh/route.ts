import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { SilverTransformController } from '@/modules/silver/controllers';
import { TableParamsSchema, RefreshBodySchema } from '@/modules/silver/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const body = RefreshBodySchema.parse(await req.json().catch(() => ({})));
  const data = await SilverTransformController.refresh(params, body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/silver/{table}/refresh:
 *   post:
 *     tags: [Silver]
 *     summary: Drop + rebuild a Silver table from Bronze
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
 *               partition: { type: string, format: date }
 *               preserveHistory: { type: boolean, default: false }
 *     responses:
 *       201: { description: Refresh job created }
 */