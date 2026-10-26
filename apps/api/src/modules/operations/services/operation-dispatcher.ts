import { AppError } from '@/errors';
import { logger } from '@/lib/logger';
import { resolveDataset } from '@/modules/datasets/types';
import { BronzeIngestService } from '@/modules/bronze/services';
import { SilverTransformService } from '@/modules/silver/services';
import { GoldAggregateService } from '@/modules/gold/services';
import { DqExecutionService } from '@/modules/dq/services';
import { CrawlerService } from '@/modules/crawler/services';
import { CRAWLER_NAMES, type CrawlerName } from '@/modules/crawler/types';
import type { OperationDatasetRef, OperationKind } from '../types';

/**
 * The result of a dispatch.
 *
 * `jobId` is the domain job the operation is backed by. It is the
 * correlation anchor: the worker writes the domain job's terminal state, and
 * the reconciler reads it back to move the operation to its terminal state.
 */
export interface DispatchResult {
  /** The domain job id (Bronze/Silver/Gold/DQ/Crawler run id). */
  jobId: string;
  /** Any extra metrics the dispatcher learned while dispatching. */
  metrics?: Record<string, unknown>;
}

/**
 * The per-kind parameter contract.
 *
 * Each kind has its own shape, and the shape is validated *before* the
 * dispatcher runs. A request cannot smuggle an unexpected parameter into a
 * domain service, and a missing one fails with a clear 400 instead of a
 * half-executed job.
 */
interface KindParams {
  source?: string;
  topic?: string;
  kind?: string;
  sourceTable?: string;
  sourceTables?: string[];
  ruleId?: string;
  crawlerName?: string;
  dagId?: string;
  partition?: string;
  conf?: Record<string, unknown>;
  note?: string;
}

function requireString(params: KindParams, key: keyof KindParams, kind: OperationKind): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(
      400,
      'INVALID_OPERATION_PARAMS',
      `Operation kind "${kind}" requires the "${String(key)}" parameter.`,
    );
  }
  return value;
}

/**
 * Resolve the canonical dataset references of an operation.
 *
 * The client sends `{layer, database, table}`; the server resolves them
 * through the shared `DatasetResolver` so the operation stores the *canonical*
 * identity (`provider/layer.database.table`) and never a raw path the
 * browser supplied.
 */
export function resolveOperationDatasets(
  datasets: readonly { layer: string; database: string; table: string }[],
): OperationDatasetRef[] {
  return datasets.map((dataset) => {
    const ref = resolveDataset({
      provider: 'local_delta_minio',
      layer: dataset.layer as 'bronze' | 'silver' | 'gold',
      database: dataset.database,
      table: dataset.table,
    });
    return {
      provider: ref.provider,
      layer: ref.layer ?? dataset.layer,
      database: ref.database ?? dataset.database,
      table: ref.table ?? dataset.table,
      datasetId: ref.datasetId,
    };
  });
}

/**
 * Dispatch an operation to the domain service that owns it.
 *
 * The dispatch is *exactly once*: the domain service creates the job record
 * and enqueues it, and the operation records the resulting `jobId`. A
 * repeated `POST /api/operations` with the same idempotency key never
 * reaches this function twice — the coordinator returns the original
 * operation before dispatching.
 */
export async function dispatchOperation(
  kind: OperationKind,
  datasets: readonly { layer: string; database: string; table: string }[],
  params: Record<string, unknown>,
): Promise<DispatchResult> {
  const typed = params as KindParams;
  const first = datasets[0];
  if (!first) {
    throw new AppError(400, 'INVALID_OPERATION_DATASETS', 'An operation requires at least one dataset.');
  }

  switch (kind) {
    case 'bronze.ingest': {
      const source = requireString(typed, 'source', kind);
      const ingestKind = typed.kind === 'json' || typed.kind === 'stream' ? typed.kind : 'csv';
      if (ingestKind === 'stream') {
        const job = await BronzeIngestService.ingestStream(
          { topic: requireString(typed, 'topic', kind) },
          {
            database: first.database,
            table: first.table,
            consumerGroup: 'operations-stream',
            maxMessages: 10_000,
            timeoutMs: 60_000,
          },
        );
        return { jobId: job.jobId, metrics: { kind: 'stream' } };
      }
      const job =
        ingestKind === 'json'
          ? await BronzeIngestService.ingestJson({
              database: first.database,
              table: first.table,
              source,
              options: { format: 'jsonl', compression: 'none' },
              ...(typed.partition ? { partition: typed.partition } : {}),
            })
          : await BronzeIngestService.ingestCsv({
              database: first.database,
              table: first.table,
              source,
              options: { header: true, delimiter: ',', encoding: 'utf-8' },
              ...(typed.partition ? { partition: typed.partition } : {}),
            });
      return { jobId: job.jobId, metrics: { kind: ingestKind } };
    }

    case 'silver.transform': {
      const job = await SilverTransformService.transformOne(
        { table: `${first.database}.${first.table}` },
        {
          kind: typed.kind === 'refresh' ? 'refresh' : 'full',
          qualityChecks: true,
          ...(typed.sourceTable ? { sourceTable: typed.sourceTable } : {}),
          ...(typed.partition ? { partition: typed.partition } : {}),
        },
      );
      return { jobId: job.jobId, metrics: { kind: typed.kind ?? 'full' } };
    }

    case 'gold.aggregate': {
      const job = await GoldAggregateService.aggregateOne(
        { table: `${first.database}.${first.table}` },
        {
          kind: typed.kind === 'refresh' ? 'refresh' : 'full',
          qualityChecks: true,
          ...(typed.sourceTables ? { sourceTables: typed.sourceTables } : {}),
          ...(typed.partition ? { partition: typed.partition } : {}),
        },
      );
      return { jobId: job.jobId, metrics: { kind: typed.kind ?? 'full' } };
    }

    case 'dq.rule_run': {
      const ruleId = requireString(typed, 'ruleId', kind);
      const run = await DqExecutionService.runRule(ruleId, { limit: 1000, sampleSize: 10 });
      return {
        jobId: run.runId,
        metrics: {
          status: run.status,
          totalRows: run.totalRows,
          evaluatedRows: run.evaluatedRows,
          failedRows: run.failedRows,
          passRate: run.passRate,
          coverageRate: run.coverageRate,
        },
      };
    }

    case 'crawler.run': {
      const name = requireString(typed, 'crawlerName', kind);
      if (!CRAWLER_NAMES.includes(name as CrawlerName)) {
        throw new AppError(
          400,
          'INVALID_OPERATION_PARAMS',
          `Unknown crawler "${name}". Allowed: ${CRAWLER_NAMES.join(', ')}.`,
        );
      }
      const result = await CrawlerService.runAsync(name as CrawlerName, {
        maxPages: 1,
        dryRun: true,
      });
      return { jobId: result.runId, metrics: { crawler: name } };
    }

    case 'airflow.dag_trigger': {
      // Phase 3: the DAG trigger is dispatched through the same service the
      // Airflow route uses, so the `conf` allowlist is enforced in exactly
      // one place. The `dagId` is the correlation anchor: the Airflow run
      // id is returned as the `jobId` and the reconciler reads the run back.
      const dagId = requireString(typed, 'dagId', kind);
      const conf = (typed.conf ?? {}) as Record<string, unknown>;
      const { AirflowDagService } = await import('@/modules/airflow/services');
      const run = await AirflowDagService.trigger(dagId, {
        conf,
        ...(typed.note !== undefined ? { note: String(typed.note) } : {}),
      });
      // The run id is the operation's **correlation anchor**: it is the only
      // thing that lets the reconciler read the run back and move the
      // operation to a terminal state.
      //
      // A trigger that returns no run id would therefore produce an
      // operation that can never be reconciled — it would stay `running`
      // forever and inflate the "Running Jobs" count with work that is
      // actually long finished. Failing the dispatch is the honest answer:
      // the operation is recorded as failed and the operator sees it.
      if (!run.runId) {
        throw new AppError(
          502,
          'AIRFLOW_RUN_ID_MISSING',
          `Airflow accepted the trigger for "${dagId}" but returned no run id, ` +
            'so the operation could not be correlated with its run.',
        );
      }
      return {
        jobId: run.runId,
        metrics: {
          dagId,
          state: run.state,
          ...(run.startDate ? { startDate: run.startDate } : {}),
        },
      };
    }

    default: {
      const exhaustive: never = kind;
      throw new AppError(
        400,
        'UNSUPPORTED_OPERATION_KIND',
        `Unsupported operation kind: ${String(exhaustive)}`,
      );
    }
  }
}

/**
 * Cancel the domain job behind an operation.
 *
 * The operation is only marked `cancelled` when the *backend* actually
 * stopped the work. MASTER PLAN §09.1: deleting a job record is not
 * cancellation, and a `cancel_requested` state must never be reported as a
 * completed cancellation.
 */
export async function cancelOperationJob(kind: OperationKind, jobId: string): Promise<boolean> {
  switch (kind) {
    case 'bronze.ingest': {
      const { BronzeJobService } = await import('@/modules/bronze/services');
      const result = await BronzeJobService.cancel({ jobId });
      return result.cancelled;
    }
    case 'silver.transform': {
      const { SilverJobService } = await import('@/modules/silver/services');
      const result = await SilverJobService.cancel({ jobId });
      return result.cancelled;
    }
    case 'gold.aggregate': {
      const { GoldJobService } = await import('@/modules/gold/services');
      const result = await GoldJobService.cancel({ jobId });
      return result.cancelled;
    }
    default:
      logger.warn({ kind, jobId }, 'Operation kind does not support cancellation');
      return false;
  }
}
