import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { SilverTransformController } from '@/modules/silver/controllers';
import { TableParamsSchema, TransformBodySchema } from '@/modules/silver/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TableParamsSchema);
  const body = TransformBodySchema.parse(await req.json().catch(() => ({})));
  const data = await SilverTransformController.transformOne(params, body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/silver/{table}/transform:
 *   post:
 *     tags: [Silver]
 *     summary: Trigger transform Bronze -> Silver for one table
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
 *               kind: { type: string, enum: [full, incremental, refresh], default: full }
 *               sourceTable: { type: string }
 *               partition: { type: string, format: date }
 *               qualityChecks: { type: boolean, default: true }
 *     responses:
 *       201: { description: Job created }
 */