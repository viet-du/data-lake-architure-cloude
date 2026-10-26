import { AppError } from '@/errors';
import { AirflowDagRepository, AirflowRunRepository } from '../repositories';
import { dagConfSpec, filterConf, validateConfValues } from '../types/dag-conf';
import type { PreflightCheck, PreflightResult } from '../types';

/**
 * The DAG preflight.
 *
 * MASTER PLAN §09.1: "air-flow typed preflight; trigger wizard with `conf`
 * allowlist". The preflight is a **read-only** evaluation of whether a
 * trigger would succeed and what it would touch.
 *
 * Rules that the preflight must never break:
 *
 *   * it never triggers, pauses or otherwise mutates the DAG;
 *   * it never invents a check it could not actually evaluate — a check
 *     that could not be evaluated is reported as `warning`, not as
 *     `error`, so an unreachable scheduler cannot block a manual run;
 *   * the `canTrigger` verdict is derived from the checks, so the UI and
 *     the trigger route can never disagree about whether a run is allowed.
 */

/** The conf keys a DAG accepts, for the wizard to render a form. */
export function describeConfSpec(dagId: string): {
  dagId: string;
  keys: string[];
  types: Record<string, 'string' | 'number' | 'boolean' | 'enum'>;
  options: Record<string, string[]>;
  descriptions: Record<string, string>;
  datasets: Array<{ layer: string; database: string; table: string }>;
} {
  const spec = dagConfSpec(dagId);
  return {
    dagId,
    keys: spec ? [...spec.keys] : [],
    types: spec ? { ...spec.types } : {},
    options: spec?.options ? Object.fromEntries(Object.entries(spec.options).map(([k, v]) => [k, [...v]])) : {},
    descriptions: spec?.descriptions ? { ...spec.descriptions } : {},
    datasets: spec?.datasets ? spec.datasets.map((d) => ({ ...d })) : [],
  };
}

/**
 * Evaluate the preflight for a DAG.
 *
 * @param dagId   the DAG to evaluate
 * @param conf    the conf the caller intends to send
 */
export async function evaluatePreflight(
  dagId: string,
  conf: Record<string, unknown> = {},
): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  // ── 1. The DAG must exist and must be active ────────────────────────────
  let scheduleMode: PreflightResult['scheduleMode'] = 'manual_only';
  let allowedConfKeys: string[] = [];
  let affectedDatasets: PreflightResult['affectedDatasets'] = [];

  try {
    const detail = await AirflowDagRepository.detail(dagId);
    allowedConfKeys = describeConfSpec(dagId).keys;
    affectedDatasets = describeConfSpec(dagId).datasets;

    if (!detail.isActive) {
      checks.push({
        id: 'dag.active',
        severity: 'error',
        message: `DAG "${dagId}" is not active and cannot be triggered.`,
        detail: { isActive: detail.isActive },
      });
    } else {
      checks.push({
        id: 'dag.active',
        severity: 'info',
        message: `DAG "${dagId}" is active.`,
        detail: { isActive: true },
      });
    }

    // ── 2. Paused semantics ───────────────────────────────────────────────
    // A paused DAG *can* still be triggered manually in Airflow; the pause
    // only stops the scheduler. The UI must say so, otherwise the operator
    // concludes the button is broken.
    if (detail.isPaused) {
      checks.push({
        id: 'dag.paused',
        severity: 'warning',
        message:
          `DAG "${dagId}" is paused: the scheduler will not start it, but a manual run is still allowed.`,
        detail: { isPaused: true },
      });
    } else {
      checks.push({
        id: 'dag.paused',
        severity: 'info',
        message: `DAG "${dagId}" is unpaused.`,
        detail: { isPaused: false },
      });
    }

    // ── 3. Schedule semantics ─────────────────────────────────────────────
    const scheduled = Boolean(detail.scheduleInterval);
    scheduleMode = scheduled ? 'scheduled' : 'manual_only';
    checks.push({
      id: 'dag.schedule',
      severity: 'info',
      message: scheduled
        ? `DAG "${dagId}" also runs on a schedule (${detail.scheduleInterval}).`
        : `DAG "${dagId}" runs manually only.`,
      detail: { scheduleInterval: detail.scheduleInterval, catchup: detail.catchup },
    });

    // ── 4. Catchup semantics ──────────────────────────────────────────────
    if (detail.catchup && scheduled) {
      checks.push({
        id: 'dag.catchup',
        severity: 'warning',
        message: `DAG "${dagId}" has catchup enabled: the scheduler may start historical runs.`,
        detail: { catchup: true },
      });
    }

    // ── 5. Retry affordances ──────────────────────────────────────────────
    // The plan only allows a retry affordance where the DAG actually
    // supports it. A DAG whose tasks declare zero retries cannot be
    // retried task-by-task.
    const retryableTasks = detail.tasks.filter((task) => task.retries > 0);
    if (retryableTasks.length === 0 && detail.tasks.length > 0) {
      checks.push({
        id: 'dag.retry',
        severity: 'warning',
        message: `No task in "${dagId}" declares a retry, so a failed task cannot be retried in place.`,
        detail: { retryableTasks: 0 },
      });
    } else {
      checks.push({
        id: 'dag.retry',
        severity: 'info',
        message: `${retryableTasks.length} task(s) in "${dagId}" support an in-place retry.`,
        detail: { retryableTasks: retryableTasks.length },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('-> 404')) {
      throw new AppError(404, 'DAG_NOT_FOUND', `DAG not found: ${dagId}`);
    }
    // The DAG could not be read. That is a warning, not an error: the
    // caller may still be able to trigger it, and refusing here would
    // hide a transient scheduler outage behind a misleading 400.
    checks.push({
      id: 'dag.readable',
      severity: 'warning',
      message: `The DAG definition could not be read (${message}); only the conf allowlist was checked.`,
    });
  }

  // ── 6. Conf allowlist ──────────────────────────────────────────────────
  const { rejected } = filterConf(dagId, conf);
  const { errors } = validateConfValues(dagId, conf);

  if (rejected.length > 0) {
    checks.push({
      id: 'conf.allowlist',
      severity: 'error',
      message: `These conf keys are not allowed for "${dagId}": ${rejected.join(', ')}.`,
      detail: { rejected },
    });
  } else if (allowedConfKeys.length > 0) {
    checks.push({
      id: 'conf.allowlist',
      severity: 'info',
      message: `All conf keys are allowed for "${dagId}".`,
      detail: { allowed: allowedConfKeys },
    });
  } else {
    checks.push({
      id: 'conf.allowlist',
      severity: 'info',
      message: `DAG "${dagId}" accepts no conf parameters.`,
    });
  }

  if (errors.length > 0) {
    checks.push({
      id: 'conf.values',
      severity: 'error',
      message: errors.join(' '),
      detail: { errors },
    });
  }

  // ── 7. A concurrent run would be rejected or queued behind the other ───
  try {
    const runs = await AirflowRunRepository.list(dagId, {
      limit: 5,
      offset: 0,
      orderBy: 'execution_date',
    });
    const active = runs.items.filter(
      (run) => run.state === 'running' || run.state === 'queued',
    );
    if (active.length > 0) {
      checks.push({
        id: 'run.concurrent',
        severity: 'warning',
        message: `${active.length} run(s) of "${dagId}" are still active; a new run may be queued behind them.`,
        detail: { activeRuns: active.map((r) => r.runId) },
      });
    }
  } catch {
    // Not being able to list runs is not a reason to block a manual run.
    checks.push({
      id: 'run.concurrent',
      severity: 'info',
      message: 'Recent runs could not be read; concurrent-run state is unknown.',
    });
  }

  const canTrigger = !checks.some((check) => check.severity === 'error');

  return {
    dagId,
    canTrigger,
    allowedConfKeys,
    rejectedConfKeys: rejected,
    affectedDatasets,
    scheduleMode,
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}
