import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created, unwrapParams } from '@/lib/http';
import { BronzeIngestController } from '@/modules/bronze/controllers';
import { IngestStreamBodySchema, IngestStreamParamsSchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ topic: string }> };

const handlePost: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, IngestStreamParamsSchema);
  const body = IngestStreamBodySchema.parse(await req.json());
  const data = await BronzeIngestController.ingestStream(params, body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/bronze/ingest/stream/{topic}:
 *   post:
 *     tags: [Bronze]
 *     summary: Trigger streaming ingest from a Kafka topic into a Bronze table
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
 *             required: [database, table]
 *             properties:
 *               database: { type: string }
 *               table: { type: string }
 *               consumerGroup: { type: string, default: bronze-ingestor }
 *               maxMessages: { type: integer, default: 10000, maximum: 1000000 }
 *               timeoutMs: { type: integer, default: 60000, maximum: 600000 }
 *     responses:
 *       201: { description: Job created }
 */