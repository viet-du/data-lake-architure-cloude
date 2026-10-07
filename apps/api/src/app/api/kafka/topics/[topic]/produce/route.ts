import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { KafkaTopicController } from '@/modules/kafka/controllers';
import { TopicNameParamSchema, ProduceMessageBodySchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ topic: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TopicNameParamSchema);
  const body = await req.json();
  const data = await KafkaTopicController.produce(params, ProduceMessageBodySchema.parse(body));
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/kafka/topics/{topic}/produce:
 *   post:
 *     tags: [Kafka]
 *     summary: Produce a single Kafka message
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
 *             required: [value]
 *             properties:
 *               key: { type: string }
 *               value: { type: string }
 *               headers: { type: object, additionalProperties: { type: string } }
 *               partition: { type: integer }
 *     responses:
 *       201: { description: Message produced }
 */
