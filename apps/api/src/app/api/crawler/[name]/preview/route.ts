import type { NextRequest } from 'next/server';
import { withErrorHandler, withRequestId, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { CrawlerRunController } from '@/modules/crawler/controllers';
import { CrawlerNameParamSchema, CrawlerPreviewQuerySchema } from '@/modules/crawler/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ name: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, CrawlerNameParamSchema);
  const url = new URL(req.url);
  const query = CrawlerPreviewQuerySchema.parse({
    category: url.searchParams.get('category') ?? undefined,
    language: url.searchParams.get('language') ?? undefined,
    maxItems: url.searchParams.get('maxItems') ?? undefined,
  });
  const data = await CrawlerRunController.preview(params, query);
  return ok(data);
};

export const GET = withRequestId(withErrorHandler(handleGet));

/**
 * @openapi
 * /api/crawler/{name}/preview:
 *   get:
 *     tags: [Crawler]
 *     summary: Dry-run preview (first N items)
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string, enum: [tiki, github, crypto, weather, hackernews] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: language
 *         schema: { type: string }
 *       - in: query
 *         name: maxItems
 *         schema: { type: integer, default: 3, maximum: 20 }
 *     responses:
 *       200: { description: Preview items }
 */