import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { BronzeTableController } from '@/modules/bronze/controllers';
import { PartitionDateParamsSchema } from '@/modules/bronze/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ table: string; date: string }> };

const handleDelete: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, PartitionDateParamsSchema);
  const data = await BronzeTableController.deletePartition(params);
  return ok(data);
};

export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/bronze/{table}/partitions/{date}:
 *   delete:
 *     tags: [Bronze]
 *     summary: Delete one partition from a Bronze table
 *     parameters:
 *       - in: path
 *         name: table
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: date
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Partition deleted }
 */