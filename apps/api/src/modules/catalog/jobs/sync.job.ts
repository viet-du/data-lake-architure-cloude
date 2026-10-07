import { SyncService } from '../services/sync.service';
import { logger } from '@/lib/logger';

let scheduledTimer: ReturnType<typeof setInterval> | null = null;
let runningPromise: Promise<void> | null = null;

const INTERVAL_MS = 5 * 60 * 1000;

export const SyncJob = {
  async runOnce(): Promise<void> {
    if (runningPromise) return runningPromise;
    runningPromise = (async () => {
      try {
        const result = await SyncService.syncAll();
        logger.info(
          { scanned: result.scanned, upserted: result.upserted, failed: result.failed },
          'Catalog sync completed',
        );
      } catch (err) {
        logger.error({ err }, 'Catalog sync failed');
      } finally {
        runningPromise = null;
      }
    })();
    return runningPromise;
  },

  start(intervalMs: number = INTERVAL_MS): void {
    if (scheduledTimer) return;
    scheduledTimer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    logger.info({ intervalMs }, 'Catalog sync job scheduled');
  },

  stop(): void {
    if (scheduledTimer) {
      clearInterval(scheduledTimer);
      scheduledTimer = null;
      logger.info('Catalog sync job stopped');
    }
  },

  isScheduled(): boolean {
    return scheduledTimer !== null;
  },
};