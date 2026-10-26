import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Operation } from '@/modules/operations/types';

/**
 * The operation reconciler's behaviour for an operation that has no
 * correlation anchor.
 *
 * R4 / DATA-001: an Airflow trigger whose `correlation.jobId` was never
 * recorded used to stay `running` forever, so Home claimed
 * "Running Jobs = 1" for a DAG run that had failed a day earlier. The
 * reconciler now locates the run from the DAG id and the dispatch instant.
 */

const update = vi.fn();
const appendEvent = vi.fn(async (..._args: unknown[]) => undefined);
const listRuns = vi.fn();
const detailRun = vi.fn();

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/modules/operations/repositories/operation.repository', () => ({
  OperationRepository: {
    update: (...args: unknown[]) => update(...args),
    list: vi.fn(),
    listStaleOperations: vi.fn(),
  },
}));

vi.mock('@/modules/operations/services/operation.service', () => ({
  OperationService: { appendEvent: (...args: unknown[]) => appendEvent(...args) },
}));

vi.mock('@/modules/airflow/repositories', () => ({
  AirflowRunRepository: { list: (...args: unknown[]) => listRuns(...args) },
}));

vi.mock('@/modules/airflow/services', () => ({
  AirflowRunService: { detail: (...args: unknown[]) => detailRun(...args) },
}));

const DISPATCHED_AT = '2026-10-25T05:12:20.265Z';

function operation(overrides: Partial<Operation> = {}): Operation {
  return {
    operationId: 'op_test',
    kind: 'airflow.dag_trigger',
    status: 'running',
    createdAt: '2026-10-25T05:12:19.892Z',
    startedAt: DISPATCHED_AT,
    correlation: { jobId: null },
    metrics: { dagId: 'retail_elt_dag', state: 'queued' },
    ...overrides,
  } as unknown as Operation;
}

function run(runId: string, executionDate: string) {
  return { runId, executionDate };
}

async function loadReconciler() {
  const mod = await import('@/modules/operations/services/operation-reconciler');
  return mod.OperationReconciler;
}

describe('OperationReconciler — operation without a correlation anchor', () => {
  beforeEach(() => {
    vi.resetModules();
    update.mockReset();
    appendEvent.mockClear();
    listRuns.mockReset();
    detailRun.mockReset();
    update.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
      ...operation(),
      ...patch,
    }));
  });

  it('moves a stuck running trigger to failed when its DAG run failed', async () => {
    listRuns.mockResolvedValue({
      items: [run('manual__a', '2026-10-25T05:12:21.000Z')],
    });
    detailRun.mockResolvedValue({
      runId: 'manual__a',
      state: 'failed',
      endDate: '2026-10-25T05:19:56.592Z',
    });
    const reconciler = await loadReconciler();

    const updated = await reconciler.reconcile(operation());

    expect(updated).not.toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch.status).toBe('failed');
    expect(patch.errorMessage).toContain('manual__a');
    expect(patch.finishedAt).toBe('2026-10-25T05:19:56.592Z');
  });

  it('moves a trigger to succeeded when Airflow reports `success`', async () => {
    listRuns.mockResolvedValue({ items: [run('manual__b', DISPATCHED_AT)] });
    detailRun.mockResolvedValue({
      runId: 'manual__b',
      state: 'success',
      endDate: '2026-10-25T05:15:00.000Z',
    });
    const reconciler = await loadReconciler();

    await reconciler.reconcile(operation());

    const patch = update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch.status).toBe('succeeded');
  });

  it('picks the newest run inside the match window', async () => {
    listRuns.mockResolvedValue({
      items: [
        run('older', '2026-10-25T05:11:00.000Z'),
        run('newest', '2026-10-25T05:12:25.000Z'),
      ],
    });
    detailRun.mockResolvedValue({ runId: 'newest', state: 'failed' });
    const reconciler = await loadReconciler();

    await reconciler.reconcile(operation());

    expect(detailRun).toHaveBeenCalledWith('retail_elt_dag', 'newest');
  });

  it('ignores runs outside the match window and leaves the operation untouched', async () => {
    listRuns.mockResolvedValue({
      items: [run('unrelated', '2026-10-24T01:00:00.000Z')],
    });
    const reconciler = await loadReconciler();

    const updated = await reconciler.reconcile(operation());

    expect(updated).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps the operation running while the matched run is still running', async () => {
    listRuns.mockResolvedValue({ items: [run('live', DISPATCHED_AT)] });
    detailRun.mockResolvedValue({ runId: 'live', state: 'running' });
    const reconciler = await loadReconciler();

    const updated = await reconciler.reconcile(operation());

    expect(updated).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not use the fallback for a non-Airflow operation', async () => {
    const reconciler = await loadReconciler();

    const updated = await reconciler.reconcile(operation({ kind: 'bronze.ingest' }));

    expect(updated).toBeNull();
    expect(listRuns).not.toHaveBeenCalled();
  });

  it('does not use the fallback when the DAG id is unknown', async () => {
    const reconciler = await loadReconciler();

    const updated = await reconciler.reconcile(operation({ metrics: {} }));

    expect(updated).toBeNull();
    expect(listRuns).not.toHaveBeenCalled();
  });

  it('survives an Airflow outage without throwing or inventing a state', async () => {
    listRuns.mockRejectedValue(new Error('airflow down'));
    const reconciler = await loadReconciler();

    await expect(reconciler.reconcile(operation())).resolves.toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('never touches an operation that is already terminal', async () => {
    const reconciler = await loadReconciler();

    const updated = await reconciler.reconcile(operation({ status: 'failed' }));

    expect(updated).toBeNull();
    expect(listRuns).not.toHaveBeenCalled();
  });
});
