import { z } from 'zod';
import type {
  DashboardActivity,
  DashboardActivityEvent,
  DashboardDependencies,
  DashboardMetric,
  DashboardPartialFailure,
  DashboardServiceHealth,
  DashboardSummary,
  EDashboardMetricStatus,
} from '@/types/entities';

/**
 * The API → UI adapter for the dashboard.
 *
 * MASTER PLAN §08: the adapter's job is to keep the *semantics* of the
 * read model intact. Two rules matter here:
 *
 *  1. **A metric that cannot be read is `null`, not `0`.** The Zod schema
 *     makes `value` nullable, and the adapter never substitutes a number.
 *  2. **The status is preserved.** `not_evaluated` and `unavailable` are
 *     different facts — the first means "no evidence", the second means
 *     "the source failed" — and the UI renders them differently.
 */

const metricStatusSchema = z.enum(['ok', 'stale', 'unavailable', 'not_evaluated']);

const metricSchema = z.object({
  value: z.number().nullable(),
  status: metricStatusSchema,
  source: z.string(),
  window: z.string(),
  asOf: z.string(),
  coverage: z.number().nullable(),
  reason: z.string().optional(),
});

export function decodeMetric(input: unknown): DashboardMetric {
  const value = metricSchema.parse(input);
  return {
    value: value.value,
    status: value.status as EDashboardMetricStatus,
    source: value.source,
    window: value.window,
    asOf: value.asOf,
    coverage: value.coverage,
    ...(value.reason ? { reason: value.reason } : {}),
  };
}

const serviceHealthSchema = z.object({
  name: z.string(),
  status: z.enum(['up', 'down', 'degraded', 'skipped', 'unknown']),
  asOf: z.string(),
  latencyMs: z.number().optional(),
  message: z.string().optional(),
});

export function decodeServiceHealth(input: unknown): DashboardServiceHealth {
  const value = serviceHealthSchema.parse(input);
  return {
    name: value.name,
    status: value.status,
    asOf: value.asOf,
    ...(value.latencyMs !== undefined ? { latencyMs: value.latencyMs } : {}),
    ...(value.message ? { message: value.message } : {}),
  };
}

const partialFailureSchema = z.object({
  metric: z.string(),
  reason: z.string(),
});

export function decodePartialFailure(input: unknown): DashboardPartialFailure {
  return partialFailureSchema.parse(input);
}

const stageStateSchema = z.object({
  stage: z.string(),
  running: z.number(),
  lastOperation: z
    .object({
      id: z.string(),
      kind: z.string(),
      status: z.string(),
      at: z.string(),
      datasetId: z.string().optional(),
    })
    .nullable(),
  quality: z.object({
    passRate: z.number().nullable(),
    asOf: z.string().nullable(),
  }),
});

const summarySchema = z.object({
  asOf: z.string(),
  scope: z.string(),
  metrics: z.object({
    totalTables: metricSchema,
    runningJobs: metricSchema,
    activeTopics: metricSchema,
    activeDAGs: metricSchema,
    recordsProcessed: metricSchema,
    recordsByStage: z.object({
      bronze: metricSchema,
      silver: metricSchema,
      gold: metricSchema,
    }),
    qualityPassRate: metricSchema,
    totalLag: metricSchema,
  }),
  serviceHealth: z.array(serviceHealthSchema),
  stageStates: z.array(stageStateSchema),
  partialFailures: z.array(partialFailureSchema),
  partial: z.boolean(),
  freshnessSeconds: z.number(),
  systemStatus: z.string().nullable(),
  uptimeSeconds: z.number().nullable(),
});

export function decodeSummary(input: unknown): DashboardSummary {
  const value = summarySchema.parse(input);
  return {
    asOf: value.asOf,
    scope: value.scope,
    metrics: {
      totalTables: decodeMetric(value.metrics.totalTables),
      runningJobs: decodeMetric(value.metrics.runningJobs),
      activeTopics: decodeMetric(value.metrics.activeTopics),
      activeDAGs: decodeMetric(value.metrics.activeDAGs),
      recordsProcessed: decodeMetric(value.metrics.recordsProcessed),
      recordsByStage: {
        bronze: decodeMetric(value.metrics.recordsByStage.bronze),
        silver: decodeMetric(value.metrics.recordsByStage.silver),
        gold: decodeMetric(value.metrics.recordsByStage.gold),
      },
      qualityPassRate: decodeMetric(value.metrics.qualityPassRate),
      totalLag: decodeMetric(value.metrics.totalLag),
    },
    serviceHealth: value.serviceHealth.map(decodeServiceHealth),
    stageStates: value.stageStates.map((stage) => ({
      stage: stage.stage,
      running: stage.running,
      lastOperation: stage.lastOperation,
      quality: {
        passRate: stage.quality.passRate,
        asOf: stage.quality.asOf,
      },
    })),
    partialFailures: value.partialFailures.map(decodePartialFailure),
    partial: value.partial,
    freshnessSeconds: value.freshnessSeconds,
    systemStatus: value.systemStatus,
    uptimeSeconds: value.uptimeSeconds,
  };
}

const activityEventSchema = z.object({
  id: z.string(),
  at: z.string(),
  type: z.enum(['operation', 'audit']),
  status: z.string(),
  actor: z.string(),
  title: z.string(),
  reference: z.string(),
  link: z.string(),
  datasetId: z.string().optional(),
});

export function decodeActivityEvent(input: unknown): DashboardActivityEvent {
  return activityEventSchema.parse(input);
}

const activitySchema = z.object({
  activity: z.array(activityEventSchema),
  count: z.number(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  partialFailures: z.array(partialFailureSchema).optional(),
  partial: z.boolean().optional(),
});

export function decodeActivity(input: unknown): DashboardActivity {
  const value = activitySchema.parse(input);
  return {
    activity: value.activity.map(decodeActivityEvent),
    count: value.count,
    hasMore: value.hasMore,
    nextCursor: value.nextCursor,
    ...(value.partialFailures
      ? { partialFailures: value.partialFailures.map(decodePartialFailure) }
      : {}),
    ...(value.partial !== undefined ? { partial: value.partial } : {}),
  };
}

const dependenciesSchema = z.object({
  asOf: z.string(),
  scope: z.string(),
  services: z.array(serviceHealthSchema),
  partial: z.boolean(),
});

export function decodeDependencies(input: unknown): DashboardDependencies {
  const value = dependenciesSchema.parse(input);
  return {
    asOf: value.asOf,
    scope: value.scope,
    services: value.services.map(decodeServiceHealth),
    partial: value.partial,
  };
}
