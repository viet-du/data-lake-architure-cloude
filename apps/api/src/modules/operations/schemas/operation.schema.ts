import { z } from 'zod';
import { EXECUTION_TARGETS, OPERATION_KINDS, OPERATION_STATUSES } from '../types';

/**
 * The `POST /api/operations` request contract.
 *
 * MASTER PLAN §09.3: a typed operation with a fixed kind allowlist, an
 * execution target and a dataset list. There is no free-form command field:
 * the request cannot express anything the dispatcher does not already know
 * how to execute.
 */

/** A dataset reference supplied by the client. */
export const OperationDatasetInputSchema = z.object({
  layer: z.enum(['bronze', 'silver', 'gold']),
  database: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, 'database must be lowercase alphanumeric'),
  table: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, 'table must be lowercase alphanumeric'),
});

export const CreateOperationBodySchema = z
  .object({
    kind: z.enum(OPERATION_KINDS),
    executionTarget: z.enum(EXECUTION_TARGETS).default('local_delta_minio'),
    datasets: z.array(OperationDatasetInputSchema).min(1).max(20),
    /**
     * The kind-specific parameters. The shape is validated per operation
     * kind by the coordinator; this schema only bounds its size so a
     * request cannot smuggle a payload.
     */
    params: z.record(z.string(), z.unknown()).default({}),
    /**
     * The client-supplied correlation id. It is echoed back and stored, but
     * it never replaces the server-generated `traceId`.
     */
    clientRequestId: z.string().max(120).optional(),
  })
  .strict();

export type TCreateOperationBody = z.infer<typeof CreateOperationBodySchema>;

export const OperationIdParamSchema = z.object({
  operationId: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/, 'invalid operationId'),
});

export type TOperationIdParam = z.infer<typeof OperationIdParamSchema>;

export const OperationListQuerySchema = z.object({
  kind: z.enum(OPERATION_KINDS).optional(),
  status: z.enum(OPERATION_STATUSES).optional(),
  ownerId: z.string().max(120).optional(),
  datasetId: z.string().max(255).optional(),
  jobId: z.string().max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export type TOperationListQuery = z.infer<typeof OperationListQuerySchema>;

export const OperationEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type TOperationEventsQuery = z.infer<typeof OperationEventsQuerySchema>;

export const RetryOperationBodySchema = z
  .object({
    /**
     * Whether the retry is allowed to run even when the original operation
     * did not fail. Defaults to `false`: a retry is a recovery mechanism,
     * not a way to re-run a successful job.
     */
    force: z.boolean().default(false),
  })
  .strict();

export type TRetryOperationBody = z.infer<typeof RetryOperationBodySchema>;
