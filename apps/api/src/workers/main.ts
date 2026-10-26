/**
 * The canonical environment MUST be applied before any module reads
 * `process.env`.
 *
 * ESM evaluates imported modules in declaration order, so this side-effect
 * import is deliberately the FIRST import of this file: every module below
 * it (`@/lib/infra/queue`, the worker managers, the logger) resolves its
 * configuration while importing, and a later `loadLocalEnv()` call would
 * run too late.
 *
 * The loader itself lives in `apps/api/env-loader.js` — one implementation,
 * shared by the Next.js process, the worker process, the test harness and
 * the operational scripts. See that file for the ownership rules.
 */
import '@/config/apply-env';

import { closeQueueConnection } from '@/lib/infra/queue';
import { logger } from '@/lib/logger';
import { BronzeWorkerManager } from '@/modules/bronze/workers';
import { CrawlerWorkerManager } from '@/modules/crawler/workers';
import { GoldWorkerManager } from '@/modules/gold/workers';
import { SilverWorkerManager } from '@/modules/silver/workers';
import { OperationsWorker } from '@/modules/operations/workers';

let stopping = false;

/**
 * The worker process owns every BullMQ queue consumer.
 *
 * MASTER PLAN §01.1 item 3: the launcher used to start only the crawler
 * worker, so the Bronze/Silver/Gold queues had no consumer at runtime and a
 * submitted job stayed `queued` forever. All four managers are started here.
 */
const managers = [
  { name: 'bronze', start: () => BronzeWorkerManager.startAll(), stop: () => BronzeWorkerManager.stopAll() },
  { name: 'silver', start: () => SilverWorkerManager.startAll(), stop: () => SilverWorkerManager.stopAll() },
  { name: 'gold', start: () => GoldWorkerManager.startAll(), stop: () => GoldWorkerManager.stopAll() },
  { name: 'crawler', start: () => CrawlerWorkerManager.startAll(), stop: () => CrawlerWorkerManager.stopAll() },
] as const;

async function stop(signal: NodeJS.Signals): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'Worker process stopping');
  try {
    // The operations maintenance loop stops first: it must not try to
    // reconcile a job while the queue consumers are already gone.
    await OperationsWorker.stop();
    for (const manager of managers) {
      await manager.stop();
    }
    await closeQueueConnection();
    process.exitCode = 0;
  } catch (error) {
    logger.error({ error }, 'Worker process failed to stop cleanly');
    process.exitCode = 1;
  }
}

async function start(): Promise<void> {
  for (const manager of managers) {
    manager.start();
  }
  // The reconciler and the heartbeat run in the same process as the queue
  // consumers: only a process that can execute work may report that the
  // worker is alive.
  OperationsWorker.start();
  logger.info(
    { workers: managers.map((m) => m.name) },
    'Worker process started',
  );
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));
}

void start().catch((error: Error) => {
  logger.fatal({ error }, 'Worker process failed to start');
  process.exitCode = 1;
});
