/**
 * Typed facade over the canonical environment loader.
 *
 * The single implementation lives in `apps/api/env-loader.js` — a plain
 * CommonJS module that sits next to `next.config.ts`. That location is
 * deliberate:
 *
 *   1. `next.config.ts` is the only hook that runs before *every* Next.js
 *      process (`next dev`, `next build`, `next start`), and Next.js
 *      transpiles it to CommonJS and executes it in the Node.js runtime. A
 *      plain `.js` file can therefore be `require()`d without any TypeScript
 *      loader being present.
 *   2. The Docker runtime image does NOT contain `src/` — it only ships
 *      `public/`, `.next/`, `node_modules/`, `package.json` and
 *      `next.config.ts`. A loader under `src/` would simply be missing in the
 *      container, so the implementation must live next to `next.config.ts`.
 *
 * This module exists purely to give the rest of the codebase a typed,
 * ES-module-friendly surface. It contains NO logic of its own — there is
 * exactly one implementation, and the ownership rules are documented there.
 *
 * IMPORTANT: this module (and `env-loader.js`) uses `node:fs` and must never
 * be reachable from the Edge middleware bundle. `@/config` therefore does NOT
 * re-export it — `src/config/env.ts` only *parses* `process.env`.
 * Entry points apply the loader explicitly:
 *
 *   - `apps/api/next.config.ts`          → `next dev` / `next build` / `next start`
 *   - `apps/api/src/workers/main.ts`     → the BullMQ worker process
 *   - `apps/api/tests/setup.ts`          → the test harness
 *   - the operational scripts under `apps/api/src/modules/`
 */

import envLoader from '../../env-loader.js';

/**
 * Which side owns the environment.
 *
 * - `file` — the repository file is the source of truth and *wins* over a
 *   stale ambient export (developer machine).
 * - `ambient` — the ambient environment is the source of truth and the file
 *   only fills keys that are absent (containers, staging, production).
 */
export type EnvPrecedence = 'file' | 'ambient';

export interface LoadEnvResult {
  /** Absolute path of the configuration file that was considered. */
  file: string;
  /** The resolved ownership mode. */
  mode: EnvPrecedence;
  /** The keys that were assigned to `process.env`. */
  applied: string[];
}

/** Absolute path of the canonical local configuration file. */
export function envFilePath(): string {
  return envLoader.envFilePath();
}

/**
 * Parse a dotenv-style file.
 *
 * Supports `KEY=value`, `export KEY=value`, quoted values, `#` comments and
 * blank lines. It never evaluates an expression — the file is configuration,
 * not code.
 */
export function parseEnvFile(contents: string): Record<string, string> {
  return envLoader.parseEnvFile(contents) as Record<string, string>;
}

/** Resolve which side owns the environment. */
export function resolveEnvPrecedence(): EnvPrecedence {
  return envLoader.resolveEnvPrecedence() as EnvPrecedence;
}

/**
 * True when a value is a template placeholder rather than a real setting.
 *
 * The repository ships a root `.env.local` template whose values look like
 * `ENV=.............enter_here=.............`. Loading such a file would
 * replace a valid value with garbage, so any value containing the marker is
 * rejected and the key is left untouched.
 */
export function isPlaceholderValue(value: string): boolean {
  return envLoader.isPlaceholderValue(value) as boolean;
}

/** True when the process runs inside a container. */
export function isContainerised(): boolean {
  return envLoader.isContainerised() as boolean;
}

/**
 * Resolve every value in a parsed file, applying `$VAR` interpolation.
 *
 * The precedence mirrors the ownership mode:
 *
 * - `file` mode — the file's own value wins, then the `:-` fallback, then
 *   the ambient value.
 * - `ambient` mode — the ambient value wins, then the `:-` fallback, then
 *   the file's value.
 */
export function expandEnvValues(
  parsed: Record<string, string>,
  mode: EnvPrecedence,
): Record<string, string> {
  return envLoader.expandEnvValues(parsed, mode) as Record<string, string>;
}

/**
 * Apply one dotenv file to `process.env`.
 *
 * @param filePath Absolute path of the file.
 * @param mode Ownership mode.
 * @returns The keys that were assigned.
 */
export function loadEnvFile(filePath: string, mode: EnvPrecedence): string[] {
  return envLoader.loadEnvFile(filePath, mode) as string[];
}

/**
 * Apply the canonical configuration.
 *
 * Safe to call from every entry point. The file is applied at most once per
 * process and per file, so a deliberate runtime override made after startup
 * is never clobbered.
 */
export function loadLocalEnv(options?: {
  file?: string;
  mode?: EnvPrecedence;
}): LoadEnvResult {
  return envLoader.loadLocalEnv(options) as LoadEnvResult;
}
