import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { created } from '@/lib/http';
import { BronzeIngestController } from '@/modules/bronze/controllers';
import { IngestCsvBodySchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = IngestCsvBodySchema.parse(await req.json());
  const data = await BronzeIngestController.ingestCsv(body);
  return created(data);
};

export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/bronze/ingest/csv:
 *   post:
 *     tags: [Bronze]
 *     summary: Trigger CSV ingest into a Bronze table
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
 *               source: { type: string, description: 'S3 path or HTTP URL to CSV file' }
 *               partition: { type: string, format: date }
 *               options:
 *                 type: object
 *                 properties:
 *                   header: { type: boolean, default: true }
 *                   delimiter: { type: string, default: ',' }
 *                   encoding: { type: string, default: 'utf-8' }
 *     responses:
 *       201: { description: Job created }
 */