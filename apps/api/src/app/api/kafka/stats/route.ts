import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { KafkaClusterController } from '@/modules/kafka/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await KafkaClusterController.stats();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/kafka/stats:
 *   get:
 *     tags: [Kafka]
 *     summary: Overall Kafka stats (topics, partitions, groups, lag, throughput)
 *     responses:
 *       200: { description: Kafka stats }
 */
