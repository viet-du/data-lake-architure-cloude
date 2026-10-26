import { loadLocalEnv } from './load-env';

/**
 * Side-effect module that applies the canonical configuration.
 *
 * Entry points import this module **first**:
 *
 *   import '@/config/apply-env';
 *
 * ESM evaluates imports in declaration order, so a later `loadLocalEnv()`
 * call would run after the modules that read `process.env` — too late. A
 * side-effect import is therefore the only reliable way to guarantee the
 * configuration is in place before any consumer reads it.
 *
 * The loader implementation lives in `apps/api/env-loader.js` — one
 * implementation shared by the Next.js process, the worker process, the test
 * harness and the operational scripts. See that file for the ownership rules
 * and the measured evidence.
 *
 * The module is Node-only (`node:fs`) and must never be imported from a
 * module reachable by the Edge middleware.
 */
loadLocalEnv();
