import type { EIconName } from '@/assets';
import type { EHealthStatus } from '@/types/commons';
import type { RoutePath } from '@/navigation/routes';
import type { EDashboardMetricStatus } from '@/types/entities';

export interface HomeModuleItem {
  key: string;
  path: RoutePath;
  iconName: EIconName;
  titleKey: string;
  descriptionKey: string;
  categoryKey: string;
  accent: 'primary' | 'bronze' | 'silver' | 'gold' | 'kafka' | 'airflow' | 'dq' | 'crawler' | 'health';
  status: EHealthStatus;
  metric: string;
  metricLabelKey: string;
  progress?: number;
  sparkline?: ReadonlyArray<number>;
}

export interface HomeQuickStat {
  key: string;
  labelKey: string;
  value: string;
  delta?: number;
  accent: 'primary' | 'bronze' | 'silver' | 'gold' | 'kafka' | 'airflow' | 'dq' | 'crawler' | 'health';
  /**
   * The state of the measurement the value came from.
   *
   * MASTER PLAN §08: `stale`, `unavailable` and `not_evaluated` are three
   * different facts, and the card must not present them as one. A stale
   * number is a real last-known value that is too old to be current; an
   * unavailable metric had its source fail; a not-evaluated metric never
   * had any evidence at all.
   */
  status: EDashboardMetricStatus;
  /** The window the value was measured over, when it is not the default. */
  window?: string;
  /**
   * The next step that lets the user produce the missing evidence.
   *
   * A `not_evaluated` metric is not a fault, but it is also not a dead end:
   * the card points at the screen where the evaluation can be run.
   */
  action?: {
    labelKey: string;
    path: RoutePath;
  };
}

export interface HomeActivityItem {
  id: string;
  titleKey: string;
  moduleKey: string;
  iconName: EIconName;
  status: 'success' | 'failed' | 'running' | 'info';
  timestamp: string;
  path: RoutePath;
}

/**
 * An activity row backed by a *real* execution event.
 *
 * MASTER PLAN §08.2: the Activity card shows the last canonical events
 * with their actor, run, status and reference. `titleKey` is not enough for
 * that — the title is the event's own description, not a translation key.
 * The two shapes are kept apart so the hard-coded demo list can never be
 * mistaken for a live feed.
 */
export interface HomeActivityEventItem {
  id: string;
  /** The event title as reported by the API. */
  title: string;
  /** The module the event belongs to, derived from its kind. */
  moduleKey: string;
  iconName: EIconName;
  status: 'success' | 'failed' | 'running' | 'info';
  timestamp: string;
  /** The in-app route the event links to. */
  path: RoutePath;
  /** The actor that caused the event. */
  actor: string;
  /** The run/job reference of the event. */
  reference: string;
}
