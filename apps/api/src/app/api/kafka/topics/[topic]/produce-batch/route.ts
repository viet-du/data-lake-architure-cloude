import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { KafkaTopicController } from '@/modules/kafka/controllers';
import { TopicNameParamSchema, ProduceBatchBodySchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ topic: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TopicNameParamSchema);
  const body = await req.json();
  const data = await KafkaTopicController.produceBatch(params, ProduceBatchBodySchema.parse(body));
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/kafka/topics/{topic}/produce-batch:
 *   post:
 *     tags: [Kafka]
 *     summary: Produce multiple Kafka messages
 *     parameters:
 *       - in: path
 *         name: topic
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messages]
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [value]
 *                   properties:
 *                     key: { type: string }
 *                     value: { type: string }
 *                     headers: { type: object, additionalProperties: { type: string } }
 *                     partition: { type: integer }
 *     responses:
 *       201: { description: Messages produced }
 */
