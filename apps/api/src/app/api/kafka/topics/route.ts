import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, created } from '@/lib/http';
import { KafkaTopicController } from '@/modules/kafka/controllers';
import { TopicListQuerySchema, CreateTopicBodySchema } from '@/modules/kafka/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = TopicListQuerySchema.parse({
    internal: url.searchParams.get('internal') ?? undefined,
    pattern: url.searchParams.get('pattern') ?? undefined,
  });
  const data = await KafkaTopicController.list(query);
  return ok(data);
};

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = await req.json();
  const data = await KafkaTopicController.create(CreateTopicBodySchema.parse(body));
  return created(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/kafka/topics:
 *   get:
 *     tags: [Kafka]
 *     summary: List all Kafka topics
 *     parameters:
 *       - in: query
 *         name: internal
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: pattern
 *         schema: { type: string }
 *     responses:
 *       200: { description: Topics list }
 *   post:
 *     tags: [Kafka]
 *     summary: Create a new Kafka topic
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               numPartitions: { type: integer, default: 1 }
 *               replicationFactor: { type: integer, default: 1 }
 *               retentionMs: { type: integer }
 *               cleanupPolicy: { type: string, enum: [delete, compact] }
 *               compressionType: { type: string, enum: [none, gzip, snappy, lz4, zstd] }
 *     responses:
 *       201: { description: Topic created }
 *       409: { description: Topic already exists }
 */
