import { logger } from '@/lib/logger';
import { OperationRepository } from '../repositories/operation.repository';
import { OperationService } from './operation.service';
import { isTerminalStatus, type Operation } from '../types';

/**
 * The operation reconciler.
 *
 * MASTER PLAN §09.3 requires a reconciler that maps the *authoritative*
 * state of a domain job onto the canonical operation. The worker updates the
 * Bronze/Silver/Gold job record; the reconciler reads that record back and
 * moves the operation to its terminal state.
 *
 * The reconciler is the reason the UI can trust the operation: the
 * operation never *assumes* a success, it mirrors what actually happened.
 *
 * A stale operation (still `queued`/`running` long after its deadline) is
 * reported, not silently failed: the master plan forbids manufacturing a
 * terminal state the backend never reached.
 */

interface DomainJobSnapshot {
  status: string;
  rowCount?: number;
  bytesProcessed?: number;
  deltaVersion?: number;
  datasetId?: string;
  errorMessage?: string;
  finishedAt?: string;
}

async function readDomainJob(
  kind: Operation['kind'],
  jobId: string,
  dagId?: string,
): Promise<DomainJobSnapshot | null> {
  try {
    switch (kind) {
      case 'bronze.ingest': {
        const { BronzeJobRepository } = await import('@/modules/bronze/repositories');
        const job = await BronzeJobRepository.findByJobId(jobId);
        if (!job) return null;
        return {
          status: job.status,
          rowCount: job.rowCount,
          bytesProcessed: job.bytesProcessed,
          ...(job.deltaVersion !== undefined ? { deltaVersion: job.deltaVersion } : {}),
          ...(job.datasetId ? { datasetId: job.datasetId } : {}),
          ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
          ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
        };
      }
      case 'silver.transform': {
        const { SilverJobRepository } = await import('@/modules/silver/repositories');
        const job = await SilverJobRepository.findByJobId(jobId);
        if (!job) return null;
        return {
          status: job.status,
          rowCount: job.rowCount,
          bytesProcessed: job.bytesProcessed,
          ...(job.deltaVersion !== undefined ? { deltaVersion: job.deltaVersion } : {}),
          ...(job.datasetId ? { datasetId: job.datasetId } : {}),
          ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
          ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
        };
      }
      case 'gold.aggregate': {
        const { GoldJobRepository } = await import('@/modules/gold/repositories');
        const job = await GoldJobRepository.findByJobId(jobId);
        if (!job) return null;
        return {
          status: job.status,
          rowCount: job.rowCount,
          bytesProcessed: job.bytesProcessed,
          ...(job.deltaVersion !== undefined ? { deltaVersion: job.deltaVersion } : {}),
          ...(job.datasetId ? { datasetId: job.datasetId } : {}),
          ...(job.errorMessage ? { errorMessage: job.errorMessage } : {}),
          ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}),
        };
      }
      case 'airflow.dag_trigger': {
        // The Airflow run is the authority for the state of a DAG trigger.
        // The `dagId` is carried in the operation metrics (the dispatcher
        // records it), so the reconciler can read the run back.
        if (!dagId) return null;
        const { AirflowRunService } = await import('@/modules/airflow/services');
        const run = await AirflowRunService.detail(dagId, jobId);
        return {
          status: run.state,
          ...(run.endDate ? { finishedAt: run.endDate } : {}),
          ...(run.state === 'failed' ? { errorMessage: `DAG run ${run.runId} failed.` } : {}),
        };
      }
      default:
        // DQ and Crawler operations complete synchronously inside the
        // dispatch, so they never reach the reconciler.
        return null;
    }
  } catch (error) {
    logger.warn(
      { kind, jobId, error: error instanceof Error ? error.message : String(error) },
      'Reconciler could not read the domain job',
    );
    return null;
  }
}

/**
 * The window in which a dispatched Airflow run may belong to an operation.
 *
 * The run's logical date is assigned by Airflow when the trigger is
 * accepted, which is within a second of the operation's dispatch. A run
 * whose logical date falls outside this window was *not* created by this
 * operation.
 */
const AIRFLOW_RUN_MATCH_WINDOW_MS = 5 * 60 * 1000;

/**
 * Find the Airflow run that an operation triggered, *without* its run id.
 *
 * ## Why this fallback exists
 *
 * An operation records the Airflow run id as its correlation anchor. If
 * that anchor is missing, the reconciler cannot read the run back — and
 * the operation stays `running` **forever**, because nothing else ever
 * moves it to a terminal state.
 *
 * The observable consequence was a Home card claiming "Running Jobs = 1"
 * for a DAG run that had actually failed days earlier. The number was a
 * lie produced by a missing correlation, not by a real running job.
 *
 * ## How the run is found
 *
 * The operation carries the DAG id and the instant it was dispatched. The
 * Airflow run created by that dispatch has a logical date within seconds
 * of that instant. The newest run inside that window is the operation's
 * run.
 *
 * When several candidates match, the **newest** one is chosen: the
 * operation is the most recent trigger of that DAG in that window.
 */
async function findAirflowRunForOperation(
  dagId: string,
  dispatchedAt: string,
): Promise<DomainJobSnapshot | null> {
  try {
    const { AirflowRunRepository } = await import('@/modules/airflow/repositories');
    const { AirflowRunService } = await import('@/modules/airflow/services');

    const dispatchedMs = Date.parse(dispatchedAt);
    if (Number.isNaN(dispatchedMs)) return null;

    const page = await AirflowRunRepository.list(dagId, {
      limit: 50,
      offset: 0,
      orderBy: '-execution_date',
    });

    const candidates = page.items
      .map((run) => ({ run, at: Date.parse(run.executionDate) }))
      .filter((entry) => !Number.isNaN(entry.at))
      .filter((entry) => Math.abs(entry.at - dispatchedMs) <= AIRFLOW_RUN_MATCH_WINDOW_MS)
      .sort((a, b) => b.at - a.at);

    const match = candidates[0];
    if (!match) return null;

    // Re-read through the service so the run is described by the same
    // contract the primary path uses.
    const run = await AirflowRunService.detail(dagId, match.run.runId);
    return {
      status: run.state,
      ...(run.endDate ? { finishedAt: run.endDate } : {}),
      ...(run.state === 'failed' ? { errorMessage: `DAG run ${run.runId} failed.` } : {}),
    };
  } catch (error) {
    logger.warn(
      { dagId, dispatchedAt, error: error instanceof Error ? error.message : String(error) },
      'Reconciler could not match an Airflow run to the operation',
    );
    return null;
  }
}

/** Map a domain job status onto the canonical operation status. */
function mapStatus(domainStatus: string): Operation['status'] | null {
  switch (domainStatus) {
    case 'completed':
      return 'succeeded';
    case 'success':
      // Airflow reports a successful run as `success`, not `completed`.
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'running':
      return 'running';
    case 'queued':
      return 'queued';
    // Airflow's `up_for_retry` and `upstream_failed` are both non-terminal
    // failures-in-progress: the run may still reach a terminal state, so
    // the operation stays `running` rather than being failed early.
    case 'up_for_retry':
    case 'upstream_failed':
      return 'running';
    default:
      return null;
  }
}

export const OperationReconciler = {
  /**
   * Reconcile one operation against its domain job.
   *
   * Returns the updated operation, or `null` when nothing changed.
   */
  async reconcile(operation: Operation): Promise<Operation | null> {
    if (isTerminalStatus(operation.status)) return null;
    const jobId = operation.correlation.jobId;
    const dagId =
      typeof operation.metrics?.dagId === 'string' ? operation.metrics.dagId : undefined;

    // The domain job is the authority. The correlation anchor is the
    // primary way to reach it.
    let snapshot = jobId
      ? await readDomainJob(operation.kind, jobId, dagId)
      : null;

    // The anchor is missing.
    //
    // An operation whose `correlation.jobId` is empty can never be
    // reconciled: the primary path needs the id, and without it the
    // operation would stay `running` forever — a permanent, false
    // "Running Jobs" count.
    //
    // For an Airflow trigger the run can still be identified from the DAG
    // id and the dispatch instant, so the operation is reconciled instead
    // of being left to rot.
    if (!snapshot && !jobId && operation.kind === 'airflow.dag_trigger' && dagId) {
      snapshot = await findAirflowRunForOperation(
        dagId,
        operation.startedAt ?? operation.createdAt,
      );
      if (snapshot) {
        logger.info(
          { operationId: operation.operationId, dagId, status: snapshot.status },
          'Operation reconciled without a correlation anchor',
        );
      }
    }

    if (!snapshot) return null;

    const nextStatus = mapStatus(snapshot.status);
    if (!nextStatus || nextStatus === operation.status) return null;

    const isTerminal = isTerminalStatus(nextStatus);
    const metrics: Record<string, unknown> = {
      ...operation.metrics,
      ...(snapshot.rowCount !== undefined ? { rows: snapshot.rowCount } : {}),
      ...(snapshot.bytesProcessed !== undefined ? { bytes: snapshot.bytesProcessed } : {}),
      ...(snapshot.deltaVersion !== undefined ? { deltaVersion: snapshot.deltaVersion } : {}),
      ...(snapshot.datasetId ? { datasetId: snapshot.datasetId } : {}),
    };

    const updated = await OperationRepository.update(
      operation.operationId,
      {
        status: nextStatus,
        ...(isTerminal ? { progress: 100 } : {}),
        metrics,
        ...(snapshot.errorMessage ? { errorMessage: snapshot.errorMessage } : {}),
        ...(snapshot.errorMessage
          ? { errorCode: nextStatus === 'cancelled' ? 'OPERATION_CANCELLED' : 'OPERATION_FAILED' }
          : {}),
        ...(isTerminal
          ? {
              finishedAt: snapshot.finishedAt ?? new Date().toISOString(),
              durationMs: Date.now() - new Date(operation.createdAt).getTime(),
            }
          : {}),
      },
      { onlyIfNotTerminal: true },
    );

    if (!updated) return null;

    await OperationService.appendEvent(
      updated,
      nextStatus === 'succeeded' ? 'succeeded' : nextStatus === 'cancelled' ? 'cancelled' : 'failed',
      `Operation ${nextStatus}`,
      metrics,
    );
    logger.info(
      { operationId: operation.operationId, jobId, from: operation.status, to: nextStatus },
      'Operation reconciled',
    );
    return updated;
  },

  /**
   * Reconcile every non-terminal operation.
   *
   * The worker calls this on a timer and after each job it processes, so a
   * UI that polls the operation endpoint sees the real state without
   * waiting for a separate polling job.
   */
  async reconcileAll(limit = 100): Promise<number> {
    const { operations } = await OperationRepository.list({ limit, offset: 0 });
    let changed = 0;
    for (const operation of operations) {
      if (isTerminalStatus(operation.status)) continue;
      const updated = await this.reconcile(operation);
      if (updated) changed += 1;
    }
    return changed;
  },

  /**
   * Report operations that never reached a terminal state.
   *
   * These are *orphans*: the worker died, or the dispatch was lost. The
   * master plan forbids marking them failed automatically — the operator
   * decides whether to retry or cancel them.
   */
  async listOrphans(olderThanMs = 30 * 60 * 1000): Promise<Operation[]> {
    return OperationRepository.listStaleOperations(olderThanMs);
  },
};
