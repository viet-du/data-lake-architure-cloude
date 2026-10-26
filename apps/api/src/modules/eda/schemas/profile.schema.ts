import { z } from 'zod';
import {
  PROFILE_ANALYSES,
  PROFILE_STATUSES,
  SAMPLE_POLICIES,
} from '../types';

/**
 * The EDA request contract.
 *
 * MASTER PLAN §09.4: `POST /api/eda/profiles` submits a *typed* request.
 * There is no free-form SQL field and no raw path field — the client names
 * a dataset and the server resolves the storage location through the
 * shared `DatasetResolver`.
 */

/** The dataset selector accepted by the profile request. */
export const ProfileDatasetInputSchema = z.object({
  /** The canonical dataset id: `provider/layer.database.table`. */
  datasetId: z.string().min(1).max(255).optional(),
  provider: z.enum(['local_delta_minio', 'databricks_uc']).optional(),
  layer: z.enum(['bronze', 'silver', 'gold']).optional(),
  database: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, 'database must be lowercase alphanumeric').optional(),
  table: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, 'table must be lowercase alphanumeric').optional(),
});

export type TProfileDatasetInput = z.infer<typeof ProfileDatasetInputSchema>;

export const CreateProfileBodySchema = z
  .object({
    dataset: ProfileDatasetInputSchema,
    /** The Delta snapshot version to profile. `null` means "the latest". */
    version: z.number().int().min(0).optional(),
    /** The columns to profile. Empty means "every column". */
    columns: z.array(z.string().min(1).max(120)).max(200).default([]),
    /** The analyses to compute. */
    analyses: z.array(z.enum(PROFILE_ANALYSES)).min(1).max(10).default(['structure', 'univariate']),
    /** Whether to compute the correlation matrix. */
    includeCorrelation: z.boolean().default(false),
    /** The sampling policy. */
    samplePolicy: z.enum(SAMPLE_POLICIES).default('full'),
    /** The sample size — only meaningful for a sampling policy. */
    sampleSize: z.number().int().min(100).max(5_000_000).optional(),
    /** The reproducible sampling seed. */
    seed: z.number().int().min(0).max(2_147_483_647).optional(),
    /** Equality filters — `column` → allowed values. */
    filters: z.record(z.string(), z.array(z.union([z.string(), z.number(), z.boolean()])).max(100)).optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.dataset.datasetId) || Boolean(value.dataset.table),
    { message: 'A profile request requires a datasetId or a table.', path: ['dataset'] },
  )
  .refine(
    (value) => value.samplePolicy === 'full' || (value.sampleSize !== undefined && value.sampleSize > 0),
    { message: 'A sampling policy requires sampleSize.', path: ['sampleSize'] },
  );

export type TCreateProfileBody = z.infer<typeof CreateProfileBodySchema>;

export const ProfileIdParamSchema = z.object({
  profileId: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/, 'invalid profileId'),
});

export type TProfileIdParam = z.infer<typeof ProfileIdParamSchema>;

export const ProfileListQuerySchema = z.object({
  datasetId: z.string().max(255).optional(),
  status: z.enum(PROFILE_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type TProfileListQuery = z.infer<typeof ProfileListQuerySchema>;

export const ProfileColumnsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type TProfileColumnsQuery = z.infer<typeof ProfileColumnsQuerySchema>;

export const ProfileChartParamSchema = z.object({
  profileId: z.string().min(1).max(120),
  chartId: z.string().min(1).max(120),
});

export type TProfileChartParam = z.infer<typeof ProfileChartParamSchema>;

export const ProfileSampleQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TProfileSampleQuery = z.infer<typeof ProfileSampleQuerySchema>;

/**
 * The compare request.
 *
 * MASTER PLAN §09.4: `POST /api/eda/compare` compares two *verified*
 * snapshots or profiles. Both sides must be known profile ids so the
 * comparison always references a computed result — never a live scan.
 */
export const CompareProfilesBodySchema = z
  .object({
    profileId: z.string().min(1).max(120),
    baselineProfileId: z.string().min(1).max(120),
  })
  .strict()
  .refine((value) => value.profileId !== value.baselineProfileId, {
    message: 'A comparison requires two different profiles.',
    path: ['baselineProfileId'],
  });

export type TCompareProfilesBody = z.infer<typeof CompareProfilesBodySchema>;

/**
 * The EDA → DQ bridge request.
 *
 * MASTER PLAN §07.5: an EDA finding *suggests* a DQ rule. The rule is
 * created as a **draft** (disabled) so the domain owner reviews it — the
 * bridge never silently auto-applies a rule.
 */
export const ProposeRuleBodySchema = z
  .object({
    profileId: z.string().min(1).max(120),
    column: z.string().min(1).max(120),
    /** The rule type to propose. Defaults to `null_check`. */
    type: z.enum(['null_check', 'range_check', 'in_set', 'unique', 'regex']).default('null_check'),
    /** The suggested threshold — e.g. the observed null percentage. */
    threshold: z.number().min(0).max(100).optional(),
    /** The rule name. */
    name: z.string().min(1).max(255).optional(),
    /** Whether the rule is created enabled. Defaults to `false` (draft). */
    enabled: z.boolean().default(false),
  })
  .strict();

export type TProposeRuleBody = z.infer<typeof ProposeRuleBodySchema>;
