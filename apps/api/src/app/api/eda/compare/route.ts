import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { ok } from '@/lib/http';
import { EdaController } from '@/modules/eda/controllers';
import { CompareProfilesBodySchema } from '@/modules/eda/schemas';

export const runtime = 'nodejs';

/**
 * `POST /api/eda/compare` — compare two verified profiles.
 *
 * Both sides must be *stored* profiles, so the comparison always
 * references a computed result — never a live scan that would produce a
 * different answer on the second read.
 */
const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = CompareProfilesBodySchema.parse(await req.json());
  return ok(await EdaController.compare(body));
};

export const POST = withSecurity(handlePost);

/**
 * @openapi
 * /api/eda/compare:
 *   post:
 *     tags: [EDA]
 *     summary: Compare two profiles
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [profileId, baselineProfileId]
 *             properties:
 *               profileId: { type: string }
 *               baselineProfileId: { type: string }
 *     responses:
 *       200: { description: The comparison }
 *       404: { description: Profile not found }
 */
