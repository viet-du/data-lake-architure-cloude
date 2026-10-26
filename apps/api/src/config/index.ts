export { env, type Env } from './env';
export * from './constants';

// NOTE: the environment loader (`./load-env`) is intentionally NOT re-exported
// here. `@/config` is reachable from the Edge middleware
// (`@/middlewares/with-cors` → `@/config`), and the loader uses `node:fs`,
// which the Edge runtime cannot load. Entry points import it directly:
//
//   import { loadLocalEnv } from '@/config/load-env';
//   loadLocalEnv();
