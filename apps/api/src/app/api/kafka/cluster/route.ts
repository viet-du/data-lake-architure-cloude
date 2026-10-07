import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { KafkaClusterController } from '@/modules/kafka/controllers';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await KafkaClusterController.info();
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/kafka/cluster:
 *   get:
 *     tags: [Kafka]
 *     summary: Get Kafka cluster info (brokers, controller, clusterId)
 *     responses:
 *       200: { description: Cluster info }
 */
