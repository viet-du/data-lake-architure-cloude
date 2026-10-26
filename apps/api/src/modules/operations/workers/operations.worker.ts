import { logger } from '@/lib/logger';
import { OperationReconciler } from '../services';

/**
 * The operations maintenance loop.
 *
 * MASTER PLAN §09.3 asks for a "reconciler" and a "worker heartbeat". Both
 * live here:
 *
 *   * the **reconciler** mirrors the authoritative domain-job state onto the
 *     canonical operation, so the UI never has to guess whether a run
 *     succeeded;
 *   * the **heartbeat** records that the worker process is alive and
 *     connected, so an operator can tell "the queue is idle" from "the
 *     worker is dead".
 *
 * The loop runs inside the worker process — the same process that consumes
 * the queues — so the heartbeat is only written by a process that really
 * can execute work.
 */

/** How often the reconciler sweeps the non-terminal operations. */
const RECONCILE_INTERVAL_MS = 15_000;

/** How often the heartbeat is written. */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * The operations that were left non-terminal for longer than this are
 * reported as orphans. They are *not* marked failed: the master plan
 * forbids inventing a terminal state the backend never reached.
 */
const ORPHAN_AGE_MS = 30 * 60 * 1000;

let reconcileTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

/** The last heartbeat, exposed for the health endpoint. */
let lastHeartbeatAt: string | null = null;

export const OperationsWorker = {
  /**
   * Start the maintenance loop.
   *
   * The first reconcile runs immediately so an operation that was queued
   * while the worker was down is brought to its real state as soon as the
   * worker starts.
   */
  start(): void {
    if (reconcileTimer) return;

    const reconcile = async (): Promise<void> => {
      try {
        const changed = await OperationReconciler.reconcileAll();
        if (changed > 0) {
          logger.info({ changed }, 'Operations reconciled');
        }
        const orphans = await OperationReconciler.listOrphans(ORPHAN_AGE_MS);
        if (orphans.length > 0) {
          // The orphans are surfaced, not repaired: a human decides whether
          // to retry or cancel them.
          logger.warn(
            { count: orphans.length, operationIds: orphans.map((o) => o.operationId) },
            'Operations left in a non-terminal state',
          );
        }
      } catch (error) {
        logger.error(
          { error: error instanceof Error ? error.message : String(error) },
          'Operation reconcile cycle failed',
        );
      }
    };

    const heartbeat = (): void => {
      lastHeartbeatAt = new Date().toISOString();
    };

    heartbeat();
    void reconcile();
    reconcileTimer = setInterval(() => void reconcile(), RECONCILE_INTERVAL_MS);
    heartbeatTimer = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    // The timers must not keep the process alive on their own — the worker
    // is stopped explicitly on SIGTERM.
    reconcileTimer.unref?.();
    heartbeatTimer.unref?.();

    logger.info(
      { reconcileIntervalMs: RECONCILE_INTERVAL_MS, heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS },
      'Operations maintenance loop started',
    );
  },

  async stop(): Promise<void> {
    if (reconcileTimer) {
      clearInterval(reconcileTimer);
      reconcileTimer = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  },

  /** The timestamp of the last heartbeat, or `null` before the first tick. */
  lastHeartbeat(): string | null {
    return lastHeartbeatAt;
  },

  isStarted(): boolean {
    return reconcileTimer !== null;
  },
};
