import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { EdaController } from '@/modules/eda/controllers';
import { ProfileIdParamSchema } from '@/modules/eda/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ profileId: string }> };

/**
 * `GET /api/eda/profiles/{profileId}/charts` — every chart of a profile.
 *
 * The heavy artifacts (histograms, top values, the correlation matrix) are
 * served here rather than in the profile summary, so a wide dataset never
 * forces the browser to render hundreds of series at once.
 */
const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ProfileIdParamSchema);
  return ok({ charts: await EdaController.charts(params.profileId) });
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/eda/profiles/{profileId}/charts:
 *   get:
 *     tags: [EDA]
 *     summary: Every chart of a profile
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Charts }
 *       404: { description: Profile not found }
 */
