import { DashboardService } from '../services/dashboard.service';
import type {
  DashboardActivity,
  DashboardServiceHealth,
  DashboardSummary,
} from '../types';
import type {
  TDashboardActivityQuery,
  TDashboardSummaryQuery,
} from '../schemas';

/**
 * The dashboard controller.
 *
 * The controller is intentionally thin: it adapts the HTTP query into the
 * service call and returns the read model unchanged. Every semantic rule
 * (what a metric means, when it is unknown, how a partial failure is
 * reported) lives in the service, so the UI and any other consumer see the
 * same contract.
 */
export const DashboardController = {
  /**
   * `GET /api/dashboard/summary`
   *
   * The response is always HTTP 200 with a `partial` flag — a dashboard
   * that fails because one provider is down is less useful than a dashboard
   * that says "Kafka is unavailable" next to the metrics it could read.
   */
  async summary(query: TDashboardSummaryQuery): Promise<DashboardSummary> {
    return DashboardService.summary(query);
  },

  /**
   * `GET /api/dashboard/activity`
   *
   * The feed is cursor-paged over the merged operation registry and audit
   * ledger. An empty feed means "nothing happened yet".
   */
  async activity(query: TDashboardActivityQuery): Promise<DashboardActivity> {
    return DashboardService.activity({
      limit: query.limit,
      cursor: query.cursor ?? null,
      kind: query.kind ?? null,
      status: query.status ?? null,
      datasetId: query.datasetId ?? null,
    });
  },

  /**
   * `GET /api/dashboard/dependencies`
   *
   * The capability-aware dependency view. Each entry states whether the
   * dependency is reachable *and* whether it is relevant to the current
   * deployment — a local-only deployment does not report Databricks as
   * "down" when it was never asked for it.
   */
  async dependencies(): Promise<{
    asOf: string;
    scope: string;
    services: DashboardServiceHealth[];
    partial: boolean;
  }> {
    const summary = await DashboardService.summary({});
    return {
      asOf: summary.asOf,
      scope: summary.scope,
      services: summary.serviceHealth,
      partial: summary.partial,
    };
  },
};
