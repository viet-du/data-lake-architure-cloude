import { z } from 'zod';
import { OPERATION_KINDS, OPERATION_STATUSES } from '@/modules/operations/types';

/**
 * The query contracts of the Home dashboard.
 *
 * MASTER PLAN §09.6: `GET /api/dashboard/summary?scope=&window=` and
 * `GET /api/dashboard/activity?cursor=&limit=&kind=&status=`.
 *
 * Every bound is validated here rather than in the route: a cursor is an
 * opaque base64url token, so it is length-bounded and pattern-checked
 * before it reaches the repository.
 */

export const DashboardSummaryQuerySchema = z
  .object({
    /**
     * The scope the summary was computed for.
     *
     * The value is echoed back so the UI can label the metrics with the
     * scope they belong to. It is *not* a filter that lets a client read a
     * scope the deployment does not expose — the server always computes the
     * scope it is actually connected to.
     */
    scope: z.string().min(1).max(64).optional(),
    /** The measurement window requested by the caller. */
    window: z.string().min(1).max(64).optional(),
  })
  .strict();

export type TDashboardSummaryQuery = z.infer<typeof DashboardSummaryQuerySchema>;

export const DashboardActivityQuerySchema = z
  .object({
    /** The opaque pagination cursor returned by the previous page. */
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    kind: z.enum(OPERATION_KINDS).optional(),
    status: z.enum(OPERATION_STATUSES).optional(),
    datasetId: z.string().min(1).max(255).optional(),
  })
  .strict();

export type TDashboardActivityQuery = z.infer<typeof DashboardActivityQuerySchema>;
