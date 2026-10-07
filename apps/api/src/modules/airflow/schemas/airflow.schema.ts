import { z } from 'zod';
import { DAG_RUN_STATE, TASK_INSTANCE_STATE } from '../types';

export const DagIdParamSchema = z.object({
  dagId: z.string().min(1).max(250).regex(/^[a-zA-Z0-9._-]+$/, 'dagId must be alphanumeric with . _ -'),
});

export type TDagIdParam = z.infer<typeof DagIdParamSchema>;

export const DagListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  onlyActive: z.coerce.boolean().default(false),
  paused: z.coerce.boolean().optional(),
  tags: z.string().optional(),
  pattern: z.string().optional(),
});

export type TDagListQuery = z.infer<typeof DagListQuerySchema>;

export const TriggerDagBodySchema = z.object({
  conf: z.record(z.string(), z.unknown()).default({}),
  note: z.string().max(255).optional(),
  logicalDate: z.string().datetime().optional(),
  runId: z.string().min(1).max(250).optional(),
});

export type TTriggerDagBody = z.infer<typeof TriggerDagBodySchema>;

export const RunIdParamSchema = z.object({
  dagId: z
    .string()
    .min(1)
    .max(250)
    .regex(/^[a-zA-Z0-9._-]+$/),
  runId: z.string().min(1).max(250),
});

export type TRunIdParam = z.infer<typeof RunIdParamSchema>;

export const RunsListQuerySchema = z.object({
  state: z.enum(DAG_RUN_STATE).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  startDateGte: z.string().datetime().optional(),
  startDateLte: z.string().datetime().optional(),
  orderBy: z.enum(['execution_date', 'start_date', 'end_date', 'state']).default('execution_date'),
});

export type TRunsListQuery = z.infer<typeof RunsListQuerySchema>;

export const TaskIdParamSchema = z.object({
  dagId: z.string().min(1).max(250),
  runId: z.string().min(1).max(250),
  taskId: z.string().min(1).max(250),
});

export type TTaskIdParam = z.infer<typeof TaskIdParamSchema>;

export const TaskLogQuerySchema = z.object({
  tryNumber: z.coerce.number().int().min(1).default(1),
  fullContent: z.coerce.boolean().default(false),
  mapIndex: z.coerce.number().int().min(0).default(-1),
});

export type TTaskLogQuery = z.infer<typeof TaskLogQuerySchema>;

export const TaskListQuerySchema = z.object({
  state: z.enum(TASK_INSTANCE_STATE).optional(),
});

export type TTaskListQuery = z.infer<typeof TaskListQuerySchema>;