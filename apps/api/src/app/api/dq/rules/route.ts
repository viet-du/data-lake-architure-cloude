import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, created } from '@/lib/http';
import { DqRuleController } from '@/modules/dq/controllers';
import { RuleListQuerySchema, CreateRuleBodySchema } from '@/modules/dq/schemas';

export const runtime = 'nodejs';

const handleGet: RouteHandler = async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = RuleListQuerySchema.parse({
    layer: url.searchParams.get('layer') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    enabled: url.searchParams.get('enabled') ?? undefined,
    severity: url.searchParams.get('severity') ?? undefined,
    table: url.searchParams.get('table') ?? undefined,
    tag: url.searchParams.get('tag') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  const data = await DqRuleController.list(query);
  return ok(data);
};

const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = await req.json();
  const data = await DqRuleController.create(CreateRuleBodySchema.parse(body));
  return created(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));
export const POST = withRequestId(withErrorHandler(handlePost));

/**
 * @openapi
 * /api/dq/rules:
 *   get:
 *     tags: [DQ]
 *     summary: List all DQ rules
 *     parameters:
 *       - in: query
 *         name: layer
 *         schema: { type: string, enum: [bronze, silver, gold] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [null_check, range_check, in_set, unique, regex, custom_sql] }
 *       - in: query
 *         name: enabled
 *         schema: { type: boolean }
 *     responses:
 *       200: { description: List of rules }
 *   post:
 *     tags: [DQ]
 *     summary: Create a new DQ rule
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, layer, table]
 *     responses:
 *       201: { description: Rule created }
 */
