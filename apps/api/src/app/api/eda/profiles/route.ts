import type { NextRequest } from 'next/server';
import { withSecurity, type RouteHandler } from '@/middlewares';
import { accepted, ok } from '@/lib/http';
import { EdaController } from '@/modules/eda/controllers';
import { CreateProfileBodySchema, ProfileListQuerySchema } from '@/modules/eda/schemas';

export const runtime = 'nodejs';

/**
 * `POST /api/eda/profiles` — compute a dataset profile.
 *
 * MASTER PLAN §09.4: the response is `202 Accepted` with the profile id.
 * The profiling work is bounded and synchronous inside the request here
 * (the engine is read-only and the scan is budgeted), so the profile is
 * returned in the `succeeded` state when it completed. A profile that
 * could not be computed is returned as a `failed` profile — the endpoint
 * never answers "success" with an empty result.
 */
const handlePost: RouteHandler = async (req: NextRequest) => {
  const body = CreateProfileBodySchema.parse(await req.json());
  const profile = await EdaController.create(body);
  return accepted({
    profileId: profile.profileId,
    status: profile.status,
    fingerprint: profile.fingerprint,
    datasetId: profile.dataset.datasetId,
    links: { self: `/api/eda/profiles/${profile.profileId}` },
  });
};

export const POST = withSecurity(handlePost);

export const GET = withSecurity((async (req: NextRequest) => {
  const url = new URL(req.url);
  const query = ProfileListQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
  return ok(await EdaController.list(query));
}) satisfies RouteHandler);

/**
 * @openapi
 * /api/eda/profiles:
 *   post:
 *     tags: [EDA]
 *     summary: Compute a dataset profile
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataset]
 *             properties:
 *               dataset:
 *                 type: object
 *                 properties:
 *                   datasetId: { type: string }
 *                   provider: { type: string, enum: [local_delta_minio, databricks_uc] }
 *                   layer: { type: string, enum: [bronze, silver, gold] }
 *                   database: { type: string }
 *                   table: { type: string }
 *               version: { type: integer }
 *               columns: { type: array, items: { type: string } }
 *               analyses:
 *                 type: array
 *                 items: { type: string, enum: [structure, univariate, categorical, correlation, temporal] }
 *               includeCorrelation: { type: boolean }
 *               samplePolicy: { type: string, enum: [full, sample, stratified] }
 *               sampleSize: { type: integer }
 *               seed: { type: integer }
 *               filters: { type: object }
 *     responses:
 *       202: { description: Profile accepted }
 *       400: { description: Invalid request }
 *       404: { description: Dataset not found }
 *   get:
 *     tags: [EDA]
 *     summary: List profiles
 *     responses:
 *       200: { description: Profiles page }
 */
