import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { EdaController } from '@/modules/eda/controllers';
import { ProfileChartParamSchema } from '@/modules/eda/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ profileId: string; chartId: string }> };

/**
 * `GET /api/eda/profiles/{profileId}/charts/{chartId}` — one chart.
 *
 * The chart id is deterministic (`missing`, `histogram:<column>`,
 * `box:<column>`, `categorical:<column>`, `temporal:<column>`,
 * `correlation`), so the UI can request exactly the series it renders.
 */
const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ProfileChartParamSchema);
  return ok(await EdaController.chart(params.profileId, params.chartId));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/eda/profiles/{profileId}/charts/{chartId}:
 *   get:
 *     tags: [EDA]
 *     summary: One bounded chart aggregate
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: chartId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The chart }
 *       404: { description: Profile or chart not found }
 */
