import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created } from '@/lib/http';
import { SilverTransformController } from '@/modules/silver/controllers';
import { TransformAllBodySchema } from '@/modules/silver/schemas';

export const runtime = 'nodejs';

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = TransformAllBodySchema.parse(await req.json().catch(() => ({})));
  const data = await SilverTransformController.transformAll(body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/silver/transform/all:
 *   post:
 *     tags: [Silver]
 *     summary: Trigger Silver transform for all tables
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kind: { type: string, enum: [full, incremental, refresh], default: full }
 *               parallel: { type: integer, default: 4, maximum: 16 }
 *               qualityChecks: { type: boolean, default: true }
 *     responses:
 *       201: { description: All jobs enqueued }
 */