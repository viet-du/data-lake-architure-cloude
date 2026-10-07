import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { KafkaTopicController } from '@/modules/kafka/controllers';
import { TopicNameParamSchema, SampleMessagesQuerySchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ topic: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, TopicNameParamSchema);
  const url = new URL(req.url);
  const query = SampleMessagesQuerySchema.parse({
    partition: url.searchParams.get('partition') ?? undefined,
    fromOffset: url.searchParams.get('fromOffset') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    timeoutMs: url.searchParams.get('timeoutMs') ?? undefined,
  });
  const data = await KafkaTopicController.sample(params, query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/kafka/topics/{topic}/messages:
 *   get:
 *     tags: [Kafka]
 *     summary: Peek N messages from topic (default latest 10)
 *     parameters:
 *       - in: path
 *         name: topic
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: partition
 *         schema: { type: integer }
 *       - in: query
 *         name: fromOffset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - in: query
 *         name: timeoutMs
 *         schema: { type: integer, default: 5000 }
 *     responses:
 *       200: { description: Messages sample }
 */
