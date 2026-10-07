import { z } from 'zod';
import { apiResponseSchema, healthStatusSchema } from '../commons.schema';

export const dagStateSchema = z.enum(['success', 'failed', 'running', 'queued']);
export const taskInstanceStateSchema = z.enum([
  'success',
  'failed',
  'running',
  'queued',
  'skipped',
  'upstream_failed',
  'retry',
]);
export const ganttStateSchema = z.enum(['success', 'failed', 'running', 'queued', 'skipped']);
export const triggeredBySchema = z.enum(['manual', 'schedule', 'api', 'webhook']);

export const airflowDAGSchema = z.object({
  dagId: z.string().min(1),
  scheduleInterval: z.string().optional(),
  isActive: z.boolean(),
  isPaused: z.boolean(),
  tags: z.array(z.string()),
  ownerLinks: z.record(z.string()),
  description: z.string().optional(),
  lastRunAt: z.string().optional(),
  lastRunState: dagStateSchema.optional(),
  nextRunAt: z.string().optional(),
  status: healthStatusSchema,
});

export const airflowDAGRunSchema = z.object({
  runId: z.string(),
  dagId: z.string(),
  state: dagStateSchema,
  executionDate: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  triggeredBy: triggeredBySchema,
});

export const airflowTaskInstanceSchema = z.object({
  taskId: z.string(),
  runId: z.string(),
  state: taskInstanceStateSchema,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  tryNumber: z.number().int().nonnegative(),
  operator: z.string(),
  dependencies: z.array(z.string()),
});

export const airflowGanttEntrySchema = z.object({
  taskId: z.string(),
  startOffset: z.number(),
  duration: z.number().nonnegative(),
  state: ganttStateSchema,
});

export const airflowTriggerResultSchema = z.object({
  dagId: z.string(),
  runId: z.string(),
  executionDate: z.string(),
  triggeredAt: z.string(),
});

export const airflowStatsSchema = z.object({
  totalDAGs: z.number().int().nonnegative(),
  activeDAGs: z.number().int().nonnegative(),
  pausedDAGs: z.number().int().nonnegative(),
  totalRuns: z.number().int().nonnegative(),
  runningRuns: z.number().int().nonnegative(),
  failedRuns24h: z.number().int().nonnegative(),
  successRate24h: z.number().min(0).max(1),
});

export const airflowTaskLogsSchema = z.object({
  taskId: z.string(),
  runId: z.string(),
  tryNumber: z.number().int().nonnegative(),
  logs: z.string(),
});

export const triggerDAGPayloadSchema = z.object({
  conf: z.record(z.unknown()).optional(),
  executionDate: z.string().optional(),
});

export const listDAGRunsParamsSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
  state: dagStateSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const airflowDAGsResponseSchema = apiResponseSchema(z.array(airflowDAGSchema));
export const airflowDAGResponseSchema = apiResponseSchema(airflowDAGSchema);
export const airflowDAGRunsResponseSchema = apiResponseSchema(z.array(airflowDAGRunSchema));
export const airflowDAGRunResponseSchema = apiResponseSchema(airflowDAGRunSchema);
export const airflowTaskInstancesResponseSchema = apiResponseSchema(z.array(airflowTaskInstanceSchema));
export const airflowGanttResponseSchema = apiResponseSchema(z.array(airflowGanttEntrySchema));
export const airflowTriggerResultResponseSchema = apiResponseSchema(airflowTriggerResultSchema);
export const airflowStatsResponseSchema = apiResponseSchema(airflowStatsSchema);
export const airflowTaskLogsResponseSchema = apiResponseSchema(airflowTaskLogsSchema);
