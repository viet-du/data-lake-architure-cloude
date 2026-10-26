import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok, unwrapParams } from '@/lib/http';
import { EdaController } from '@/modules/eda/controllers';
import { ProfileIdParamSchema } from '@/modules/eda/schemas';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ profileId: string }> };

const handleGet: RouteHandler = async (_req: NextRequest, ctx: unknown) => {
  const params = await unwrapParams(ctx as Ctx, ProfileIdParamSchema);
  return ok(await EdaController.get(params.profileId));
};

export const GET = withSecurity(handleGet);

/**
 * @openapi
 * /api/eda/profiles/{profileId}:
 *   get:
 *     tags: [EDA]
 *     summary: Get one profile
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: The profile }
 *       404: { description: Profile not found }
 */
