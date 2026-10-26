import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { EdaController } from '@/modules/eda/controllers';
import { ProfileColumnsQuerySchema, ProfileIdParamSchema } from '@/modules/eda/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ profileId: string }> };

const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ProfileIdParamSchema);
  const url = new URL(req.url);
  const query = ProfileColumnsQuerySchema.parse(
    Object.fromEntries(url.searchParams.entries()),
  );
  return ok(await EdaController.columns(params.profileId, query));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/eda/profiles/{profileId}/columns:
 *   get:
 *     tags: [EDA]
 *     summary: The paged column profiles
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: Column profiles }
 *       404: { description: Profile not found }
 */
