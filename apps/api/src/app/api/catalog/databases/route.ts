import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, created } from '@/lib/http';
import { DatabaseController } from '@/modules/catalog';
import { CreateDatabaseSchema } from '@/modules/catalog';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async () => {
  const data = await DatabaseController.list();
  return ok(data);
};

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = await req.json();
  const input = CreateDatabaseSchema.parse(body);
  const data = await DatabaseController.create(input);
  return created(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/catalog/databases:
 *   get:
 *     tags: [Catalog]
 *     summary: List all databases (catalog)
 *     responses:
 *       200:
 *         description: List of databases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { type: object }
 *   post:
 *     tags: [Catalog]
 *     summary: Create a new database
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [database]
 *             properties:
 *               database: { type: string }
 *               description: { type: string }
 *               layers:
 *                 type: array
 *                 items: { type: string, enum: [bronze, silver, gold] }
 *     responses:
 *       201:
 *         description: Database created
 *       400:
 *         description: Invalid input
 *       409:
 *         description: Database already exists
 */