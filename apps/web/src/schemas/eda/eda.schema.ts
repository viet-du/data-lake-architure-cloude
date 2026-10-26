import { z } from 'zod';
import { apiResponseSchema } from '../commons.schema';

/**
 * The EDA request/response contract.
 *
 * Mirrors `apps/api/src/modules/eda/schemas/profile.schema.ts`. The schema
 * exists on the client so a malformed response fails loudly at the boundary
 * instead of silently rendering `undefined` in a chart.
 */

export const profileStatusSchema = z.enum(['queued', 'running', 'succeeded', 'partial', 'failed']);

export const logicalTypeSchema = z.enum([
  'numeric',
  'categorical',
  'boolean',
  'datetime',
  'text',
  'complex',
]);

export const alertSeveritySchema = z.enum(['info', 'warn', 'error']);

export const profileAnalysisSchema = z.enum([
  'structure',
  'univariate',
  'categorical',
  'correlation',
  'temporal',
]);

export const samplePolicySchema = z.enum(['full', 'sample', 'stratified']);

export const chartTypeSchema = z.enum([
  'missing',
  'histogram',
  'box',
  'categorical',
  'temporal',
  'correlation',
  'scatter',
]);

export const profileProviderSchema = z.enum(['local_delta_minio', 'databricks_uc']);

export const profileLayerSchema = z.enum(['bronze', 'silver', 'gold']);

/** A count is a string by contract — it may exceed `Number.MAX_SAFE_INTEGER`. */
const countSchema = z.string();

export const histogramBucketSchema = z.object({
  lower: z.number(),
  upper: z.number(),
  count: countSchema,
});

export const topValueSchema = z.object({
  value: z.string(),
  count: countSchema,
});

export const columnProfileSchema = z.object({
  name: z.string(),
  logicalType: logicalTypeSchema,
  physicalType: z.string().optional(),
  nonNullCount: countSchema,
  nullCount: countSchema,
  distinctCount: countSchema.optional(),
  distinctApprox: z.boolean().optional(),
  min: z.union([z.string(), z.number(), z.null()]).optional(),
  max: z.union([z.string(), z.number(), z.null()]).optional(),
  mean: z.number().nullable().optional(),
  std: z.number().nullable().optional(),
  p25: z.number().nullable().optional(),
  median: z.number().nullable().optional(),
  p75: z.number().nullable().optional(),
  iqr: z.number().nullable().optional(),
  skewness: z.number().nullable().optional(),
  kurtosis: z.number().nullable().optional(),
  histogram: z.array(histogramBucketSchema).optional(),
  topValues: z.array(topValueSchema).optional(),
  cardinalityRatio: z.number().nullable().optional(),
});

export const correlationResultSchema = z.object({
  method: z.enum(['pearson', 'spearman']),
  columns: z.array(z.string()),
  matrix: z.array(z.array(z.number().nullable())),
});

export const profileAlertSchema = z.object({
  kind: z.string(),
  severity: alertSeveritySchema,
  description: z.string(),
  columns: z.array(z.string()).optional(),
});

export const profileProvenanceSchema = z.object({
  engine: z.string(),
  engineVersion: z.string().optional(),
  queryHash: z.string().optional(),
  computedAt: z.string().optional(),
  elapsedMs: z.number().optional(),
  samplePolicy: samplePolicySchema,
  approximate: z.boolean(),
});

export const profileDatasetRefSchema = z.object({
  datasetId: z.string(),
  provider: profileProviderSchema,
  layer: profileLayerSchema.optional(),
  version: z.number().optional(),
  qualifiedName: z.string().optional(),
});

export const profileConfigSchema = z.object({
  columns: z.array(z.string()),
  analyses: z.array(profileAnalysisSchema),
  includeCorrelation: z.boolean(),
  sampleStrategy: samplePolicySchema,
  sampleSize: z.number().optional(),
  seed: z.number().optional(),
});

export const profilePopulationSchema = z.object({
  rowCount: z.string().nullable(),
  estimate: z.boolean(),
  columnCount: z.number(),
  bytesScanned: z.string().optional(),
});

export const profileCoverageSchema = z.object({
  rowsObserved: z.string(),
  ratio: z.number().optional(),
});

export const datasetProfileSchema = z.object({
  profileId: z.string(),
  operationId: z.string().optional(),
  dataset: profileDatasetRefSchema,
  configured: profileConfigSchema,
  population: profilePopulationSchema,
  coverage: profileCoverageSchema,
  columns: z.array(columnProfileSchema),
  relationships: correlationResultSchema.optional(),
  alerts: z.array(profileAlertSchema),
  status: profileStatusSchema,
  provenance: profileProvenanceSchema,
  schemaVersion: z.number(),
  fingerprint: z.string(),
  createdAt: z.string(),
  errorMessage: z.string().optional(),
});

export const profileChartSchema = z.object({
  chartId: z.string(),
  type: chartTypeSchema,
  title: z.string(),
  column: z.string().optional(),
  categories: z.array(z.union([z.string(), z.number()])).optional(),
  values: z.array(z.union([z.number(), z.string(), z.null()])).optional(),
  secondaryValues: z.array(z.union([z.number(), z.string(), z.null()])).optional(),
  meta: z.record(z.unknown()).optional(),
});

export const profileListSchema = z.object({
  profiles: z.array(
    z.object({
      profileId: z.string(),
      datasetId: z.string(),
      status: profileStatusSchema,
      createdAt: z.string(),
      computedAt: z.string().optional(),
      rowCount: z.string().nullable(),
      columnCount: z.number(),
      alerts: z.number(),
    }),
  ),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export const profileAcceptedSchema = z.object({
  profileId: z.string(),
  status: profileStatusSchema,
  fingerprint: z.string(),
  datasetId: z.string(),
  links: z.object({ self: z.string() }).optional(),
});

export const profileSampleSchema = z.object({
  profileId: z.string(),
  datasetId: z.string(),
  limit: z.number(),
  rows: z.array(z.record(z.unknown())),
});

export const profileComparisonSchema = z.object({
  comparisonId: z.string(),
  baseline: z.object({
    profileId: z.string(),
    computedAt: z.string().optional(),
    fingerprint: z.string(),
  }),
  candidate: z.object({
    profileId: z.string(),
    computedAt: z.string().optional(),
    fingerprint: z.string(),
  }),
  comparable: z.boolean(),
  reasons: z.array(z.string()),
  columns: z.array(
    z.object({
      name: z.string(),
      baselineNullRate: z.number().nullable(),
      candidateNullRate: z.number().nullable(),
      nullRateDelta: z.number().nullable(),
      baselineMean: z.number().nullable(),
      candidateMean: z.number().nullable(),
      meanDelta: z.number().nullable(),
      effectSize: z.number().nullable(),
      zScore: z.number().nullable(),
      significant: z.boolean(),
    }),
  ),
});

export const proposedRuleSchema = z.object({
  ruleId: z.string(),
  name: z.string(),
  type: z.string(),
  layer: z.string(),
  table: z.string(),
  column: z.string(),
  params: z.record(z.unknown()),
  enabled: z.boolean(),
  severity: z.string(),
  suggestedThreshold: z.number().nullable(),
  created: z.boolean(),
});

export const createProfilePayloadSchema = z.object({
  dataset: z
    .object({
      datasetId: z.string().optional(),
      provider: profileProviderSchema.optional(),
      layer: profileLayerSchema.optional(),
      database: z.string().optional(),
      table: z.string().optional(),
    })
    .refine((value) => Boolean(value.datasetId) || Boolean(value.table), {
      message: 'A profile request requires a datasetId or a table.',
    }),
  version: z.number().int().min(0).optional(),
  columns: z.array(z.string()),
  analyses: z.array(profileAnalysisSchema).min(1),
  includeCorrelation: z.boolean(),
  samplePolicy: samplePolicySchema,
  sampleSize: z.number().int().min(100).max(5_000_000).optional(),
  seed: z.number().int().min(0).max(2_147_483_647).optional(),
});

export const proposeRulePayloadSchema = z.object({
  profileId: z.string().min(1),
  column: z.string().min(1),
  type: z.enum(['null_check', 'range_check', 'in_set', 'unique', 'regex']),
  threshold: z.number().min(0).max(100).optional(),
  name: z.string().min(1).optional(),
  enabled: z.boolean(),
});

export const compareProfilesPayloadSchema = z
  .object({
    profileId: z.string().min(1),
    baselineProfileId: z.string().min(1),
  })
  .refine((value) => value.profileId !== value.baselineProfileId, {
    message: 'A comparison requires two different profiles.',
  });

export const profileColumnsResponseSchema = apiResponseSchema(
  z.object({
    profileId: z.string(),
    total: z.number(),
    columns: z.array(columnProfileSchema),
  }),
);

export const datasetProfileResponseSchema = apiResponseSchema(datasetProfileSchema);
export const profileListResponseSchema = apiResponseSchema(profileListSchema);
export const profileAcceptedResponseSchema = apiResponseSchema(profileAcceptedSchema);
export const profileSampleResponseSchema = apiResponseSchema(profileSampleSchema);
export const profileComparisonResponseSchema = apiResponseSchema(profileComparisonSchema);
export const proposedRuleResponseSchema = apiResponseSchema(proposedRuleSchema);
export const profileChartsResponseSchema = apiResponseSchema(
  z.object({ charts: z.array(profileChartSchema) }),
);
export const profileChartResponseSchema = apiResponseSchema(profileChartSchema);
