import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { KafkaConsumerGroupController } from '@/modules/kafka/controllers';
import { ConsumerGroupParamsSchema, ResetOffsetBodySchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ groupId: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ConsumerGroupParamsSchema);
  const body = await req.json();
  const data = await KafkaConsumerGroupController.resetOffset(params, ResetOffsetBodySchema.parse(body));
  return ok(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/kafka/consumer-groups/{groupId}/reset-offset:
 *   post:
 *     tags: [Kafka]
 *     summary: Reset consumer group offset (earliest/latest/specific)
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [topic]
 *             properties:
 *               reset: { type: string, enum: [earliest, latest, specific], default: earliest }
 *               topic: { type: string }
 *               offset: { type: integer }
 *               partitions: { type: array, items: { type: integer } }
 *     responses:
 *       200: { description: Offset reset }
 */
