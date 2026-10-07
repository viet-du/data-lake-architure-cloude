import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created } from '@/lib/http';
import { BronzeIngestController } from '@/modules/bronze/controllers';
import { IngestJsonBodySchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = IngestJsonBodySchema.parse(await req.json());
  const data = await BronzeIngestController.ingestJson(body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/bronze/ingest/json:
 *   post:
 *     tags: [Bronze]
 *     summary: Trigger JSON/JSONL ingest into a Bronze table
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [database, table, source]
 *             properties:
 *               database: { type: string }
 *               table: { type: string }
 *               source: { type: string }
 *               partition: { type: string, format: date }
 *               options:
 *                 type: object
 *                 properties:
 *                   format: { type: string, enum: [json, jsonl, ndjson], default: jsonl }
 *                   compression: { type: string, enum: [none, gzip, zstd], default: none }
 *     responses:
 *       201: { description: Job created }
 */