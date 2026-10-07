import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { KafkaConsumerGroupController } from '@/modules/kafka/controllers';
import { ConsumerGroupParamsSchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ groupId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ConsumerGroupParamsSchema);
  const data = await KafkaConsumerGroupController.show(params);
  return ok(data);
};

const handleDelete: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ConsumerGroupParamsSchema);
  const data = await KafkaConsumerGroupController.remove(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/kafka/consumer-groups/{groupId}:
 *   get:
 *     tags: [Kafka]
 *     summary: Get consumer group detail (state, members, lag)
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Group detail }
 *       404: { description: Group not found }
 *   delete:
 *     tags: [Kafka]
 *     summary: Delete a consumer group
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Group deleted }
 */
