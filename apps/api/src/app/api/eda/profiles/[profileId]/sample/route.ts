import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { EdaController } from '@/modules/eda/controllers';
import { ProfileIdParamSchema, ProfileSampleQuerySchema } from '@/modules/eda/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ profileId: string }> };

/**
 * `GET /api/eda/profiles/{profileId}/sample` — a bounded sample.
 *
 * MASTER PLAN §07.4: "No `SELECT *` full table to browser; restrict
 * columns, limit/timeouts". The route therefore caps the sample at 100
 * rows and requires the `dataset:sample` permission, which a `viewer` role
 * does not hold.
 */
const handleGet: RouteHandler = async (req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ProfileIdParamSchema);
  const url = new URL(req.url);
  const query = ProfileSampleQuerySchema.parse(
    Object.fromEntries(url.searchParams.entries()),
  );
  return ok(await EdaController.sample(params.profileId, query));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/eda/profiles/{profileId}/sample:
 *   get:
 *     tags: [EDA]
 *     summary: A bounded, representative sample
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Sample rows }
 *       403: { description: Not permitted }
 *       409: { description: Sample not available for this provider }
 */
