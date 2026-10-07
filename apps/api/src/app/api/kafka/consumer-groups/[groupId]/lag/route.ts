import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { KafkaConsumerGroupController } from '@/modules/kafka/controllers';
import { ConsumerGroupParamsSchema, ConsumerGroupLagQuerySchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ groupId: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ConsumerGroupParamsSchema);
  const url = new URL(req.url);
  const query = ConsumerGroupLagQuerySchema.parse({
    topic: url.searchParams.get('topic') ?? undefined,
  });
  const data = await KafkaConsumerGroupController.lag(params, query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/kafka/consumer-groups/{groupId}/lag:
 *   get:
 *     tags: [Kafka]
 *     summary: Get consumer group lag (per topic/partition)
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: topic
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lag report }
 */