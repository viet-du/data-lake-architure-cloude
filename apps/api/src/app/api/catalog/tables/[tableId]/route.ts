import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, noContent, unwrapParams } from '@/lib/http';
import { TableController } from '@/modules/catalog';
import { TableIdParamsSchema, UpdateTableMetadataSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, TableIdParamsSchema);
  const data = await TableController.get(params);
  return ok(data);
};

const handlePut: RouteHandler = async (req: NextRequest, ctx) => {
  const params = await unwrapParams(ctx, TableIdParamsSchema);
  const body = await req.json();
  const patch = UpdateTableMetadataSchema.parse(body);
  const data = await TableController.updateMetadata(params, patch);
  return ok(data);
};

const handleDelete: RouteHandler = async (_req, ctx) => {
  const params = await unwrapParams(ctx, TableIdParamsSchema);
  await TableController.delete(params);
  return noContent();
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const PUT = withRequestId(withErrorHandler(handlePut));
export const DELETE = withRequestId(withErrorHandler(handleDelete));

/**
 * @openapi
 * /api/catalog/tables/{tableId}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get table metadata
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string, description: "layer.database.name" }
 *     responses:
 *       200: { description: Table metadata }
 *       404: { description: Table not found }
 *   put:
 *     tags: [Catalog]
 *     summary: Update table metadata (tags, description, owner)
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               owner: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Updated table metadata }
 *       404: { description: Table not found }
 *   delete:
 *     tags: [Catalog]
 *     summary: Delete table metadata (does NOT delete Delta table)
 *     parameters:
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Table metadata deleted }
 *       404: { description: Table not found }
 */