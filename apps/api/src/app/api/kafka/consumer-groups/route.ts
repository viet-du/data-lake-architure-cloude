import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { KafkaConsumerGroupController } from '@/modules/kafka/controllers';
import { ConsumerGroupListQuerySchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = ConsumerGroupListQuerySchema.parse({
    state: url.searchParams.get('state') ?? undefined,
    pattern: url.searchParams.get('pattern') ?? undefined,
  });
  const data = await KafkaConsumerGroupController.list(query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/kafka/consumer-groups:
 *   get:
 *     tags: [Kafka]
 *     summary: List all Kafka consumer groups
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string, enum: [Stable, PreparingRebalance, CompletingRebalance, Empty, Dead] }
 *       - in: query
 *         name: pattern
 *         schema: { type: string }
 *     responses:
 *       200: { description: Consumer groups list }
 */
