export { dashboardService } from './dashboard.service';
export type {
  DashboardActivityParams,
  DashboardSummaryParams,
} from './dashboard.service';
export {
  decodeActivity,
  decodeActivityEvent,
  decodeDependencies,
  decodeMetric,
  decodePartialFailure,
  decodeServiceHealth,
  decodeSummary,
} from './dashboard.adapter';
