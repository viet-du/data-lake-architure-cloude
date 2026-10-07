import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { KafkaTopicController } from '@/modules/kafka/controllers';
import { TopicNameParamSchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ topic: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TopicNameParamSchema);
  const data = await KafkaTopicController.show(params);
  return ok(data);
};

const handleDelete: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TopicNameParamSchema);
  const data = await KafkaTopicController.remove(params);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/kafka/topics/{topic}:
 *   get:
 *     tags: [Kafka]
 *     summary: Get topic detail (partitions, replication, retention)
 *     parameters:
 *       - in: path
 *         name: topic
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Topic detail }
 *       404: { description: Topic not found }
 *   delete:
 *     tags: [Kafka]
 *     summary: Delete a Kafka topic
 *     parameters:
 *       - in: path
 *         name: topic
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Topic deleted }
 */
