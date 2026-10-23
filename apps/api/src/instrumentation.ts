// Next.js calls this file once per server boot (per route-handler runtime).
// We use it to spin up BullMQ workers in-process so async crawler runs make
// progress without needing a separate worker container.
//
// Reference: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register(): Promise<void> {
  // Only attach in Node.js runtime (instrumentation also runs for Edge, where
  // mongoose/ioredis are unavailable).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  if (process.env.WORKERS_ENABLED === 'false') {
    return;
  }

  const startupLogger = {
    info: (obj: unknown, msg?: string) =>
      // eslint-disable-next-line no-console
      console.log(`[instrumentation] ${msg ?? ''}`, JSON.stringify(obj)),
    warn: (obj: unknown, msg?: string) =>
      // eslint-disable-next-line no-console
      console.warn(`[instrumentation] ${msg ?? ''}`, JSON.stringify(obj)),
    error: (obj: unknown, msg?: string) =>
      // eslint-disable-next-line no-console
      console.error(`[instrumentation] ${msg ?? ''}`, JSON.stringify(obj)),
  };

  startupLogger.info('Booting in-process workers…');

  // Lazy import so Edge/light callers never load mongoose/ioredis.
  const { CrawlerWorkerManager } = await import(
    '@/modules/crawler/workers/crawler-worker.manager'
  );

  try {
    CrawlerWorkerManager.startAll();
    startupLogger.info({ crawler: true }, 'Crawler workers started');
  } catch (err) {
    startupLogger.error({ err: String(err) }, 'Failed to start crawler workers');
  }

  // Graceful shutdown — let in-flight jobs finish before close.
  const shutdown = async (signal: string): Promise<void> => {
    startupLogger.info({ signal }, 'Stopping workers…');
    try {
      await CrawlerWorkerManager.stopAll();
    } catch (err) {
      startupLogger.error({ err: String(err) }, 'Error while stopping workers');
    }
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}
