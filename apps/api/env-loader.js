'use strict';

/**
 * Canonical environment loader for every control-plane process.
 *
 * MASTER PLAN §02.2 (Single-Owner Principle) and §10.2 require exactly one
 * canonical configuration. Before this module the API (Next.js), the BullMQ
 * worker, the Python job runner and the test runner each resolved the
 * environment *independently*, and all of them disagreed whenever the
 * ambient shell exported a stale value.
 *
 * Measured facts (verified against the installed Next.js 15.5.28 and the
 * local Node runtime — not inferred from documentation):
 *
 *   $ MINIO_ENDPOINT=127.0.0.1:19000 node --env-file=apps/api/.env.local -e ...
 *   127.0.0.1:19000
 *   $ MINIO_ENDPOINT=127.0.0.1:19000 node -e "loadEnvConfig(dir, false, log, true)"
 *   127.0.0.1:19000
 *
 * Both loaders call dotenv's `populate()`, which only assigns a key when it
 * is **absent** from `process.env`. An ambient shell export therefore always
 * shadows the checked-in file. On this machine the ambient shell pointed at
 * `MINIO_ENDPOINT=127.0.0.1:19000`, `KAFKA_BOOTSTRAP=127.0.0.1:9192`,
 * `MONGO_URI=...:37017` and `REDIS_PORT=16379`, while the running containers
 * serve `9000`, `9092`, `27017` and `6379`. The API and its worker therefore
 * addressed two different object stores — exactly the "provider confusion"
 * MASTER PLAN §02.3 forbids, and it silently makes every write land in the
 * wrong place.
 *
 * Ownership rules
 * ---------------
 * - `file` — the repository file is the source of truth and *wins* over a
 *   stale ambient export. Used on the developer machine, where the
 *   checked-in `.env.local` is the local deployment's declared
 *   configuration.
 * - `ambient` — the ambient environment is the source of truth and the file
 *   only fills keys that are absent. Used inside containers (Compose
 *   injects service names such as `minio:9000`, which a host-side file
 *   cannot know) and in staging/production (the platform injects the
 *   environment).
 *
 * The mode is resolved in this order:
 *
 *   1. `LAKEHOUSE_ENV_PRECEDENCE=file|ambient` — explicit operator choice.
 *   2. inside a container (`/.dockerenv` exists) -> ambient.
 *   3. `ENV=staging|prod` -> ambient (deployed environment).
 *   4. otherwise -> file (developer machine and tests).
 *
 * `NODE_ENV` is deliberately NOT part of the decision. Next.js sets
 * `NODE_ENV=production` while it *builds* the application, so a local
 * `next build` would lose the credentials that live in `.env.local` and the
 * environment schema would reject the configuration. `ENV` is this
 * project's own deployment marker (`local` / `dev` / `staging` / `prod`) and
 * is the honest signal for "who owns the environment".
 *
 * File grammar
 * ------------
 * The parser is a faithful port of the grammar that `@next/env` (Next.js
 * 15.5.28) applies — `dotenv` v16 plus `dotenv-expand` v12. Every rule
 * below was *measured* against that exact package, not assumed:
 *
 *   - keys may contain letters, digits, `_`, `.` and `-`;
 *   - the separator is `=` or `:` followed by optional whitespace;
 *   - values may be single-, double- or backtick-quoted;
 *   - an unquoted value ends at the first `#` (with or without a preceding
 *     space) and a trailing `# …` comment is ignored;
 *   - a line without a separator is not an assignment;
 *   - `$VAR`, `${VAR}` and `${VAR:-default}` are interpolated, and a
 *     backslash-escaped `\$` stays literal.
 *
 * Why this file lives next to `next.config.ts`
 * --------------------------------------------
 * `next.config.ts` is the only hook that runs before *every* Next.js
 * process (dev, build and start). Next.js transpiles it to CommonJS and
 * loads it with `requireFromString(code, path.resolve(cwd,
 * 'next.config.compiled.js'))`, so a `require('./env-loader.js')` inside it
 * resolves against the package root — exactly where this file lives. A
 * plain CommonJS file needs no TypeScript loader at runtime.
 *
 * The Docker runtime image does NOT contain `src/` — it only ships
 * `public/`, `.next/`, `node_modules/`, `package.json` and `next.config.ts`.
 * A loader under `src/` would therefore be missing in the container, so the
 * single implementation sits here, next to `next.config.ts`, and the typed
 * facade in `src/config/load-env.ts` re-exports it.
 *
 * IMPORTANT: this module uses `node:fs` and must never be reachable from the
 * Edge middleware bundle. `@/config` therefore does NOT import it —
 * `src/config/env.ts` only *parses* `process.env`.
 */

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const ENV_FILE_NAME = '.env.local';

/**
 * The dotenv assignment pattern.
 *
 * Ported verbatim from the pattern inside `@next/env` (Next.js 15.5.28),
 * which bundles dotenv v16:
 *
 *   /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm
 *
 * The trailing `(?:$|$)` is load-bearing: without it the `\s*` before it
 * consumes the newline, the `^` anchor of the following line no longer
 * matches, and an indented assignment such as `  INDENTED=value` is
 * silently dropped. That was measured, not guessed.
 */
const LINE_PATTERN =
  /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

/**
 * Quote removal — the exact expression dotenv applies after trimming:
 * `/^(['"`])([\s\S]*)\1$/gm` → `"$2"`.
 */
const QUOTE_PATTERN = /^(['"`])([\s\S]*)\1$/gm;

/**
 * Interpolation pattern — the `dotenv-expand` v12 pattern that `@next/env`
 * applies. `$VAR` and `${VAR}` are resolved; `${VAR:-default}` supplies a
 * fallback.
 */
const INTERPOLATION_PATTERN = /((?!(?<=\\))\${?([\w]+)(?:-([^}\\]*))?}?)/;

/**
 * An unescaped `$`. A `\$` is literal and must not start an interpolation.
 */
const DOLLAR_PATTERN = /(?!(?<=\\))\$/g;

/**
 * An escaped `$` is resolved back to a literal `$` after interpolation.
 */
const ESCAPED_DOLLAR_PATTERN = /\\\$/g;

/**
 * Values that are obviously template placeholders.
 *
 * The repository ships a root `.env.local` template whose values look like
 * `ENV=.............enter_here=.............`. Loading such a file would
 * replace a valid value with garbage, so any value containing the marker is
 * rejected and the key is left untouched.
 */
const PLACEHOLDER_MARKER = 'enter_here';

/**
 * Process-wide state.
 *
 * The state lives on `globalThis` so it survives a module-registry reset
 * (`vi.resetModules()` in the test suite). Without it, a test that
 * deliberately mutates `process.env` after startup could have its value
 * clobbered by a second load of the file.
 */
const STATE_KEY = '__lakehouseEnvLoaderState__';
const state =
  globalThis[STATE_KEY] || (globalThis[STATE_KEY] = { loadedFiles: new Set() });

/**
 * True when a value is a template placeholder rather than a real setting.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isPlaceholderValue(value) {
  return String(value).includes(PLACEHOLDER_MARKER);
}

/**
 * Absolute path of the canonical local configuration file.
 *
 * Resolved from the working directory rather than from `__dirname` so the
 * module behaves identically under CommonJS (`next.config.ts`), ESM (`tsx`)
 * and the Vitest module runner. The walk covers every launch posture:
 *
 *   cwd=apps/api          -> apps/api/.env.local
 *   cwd=<repo root>       -> apps/api/.env.local
 *   cwd=/app (container)  -> no file (the platform injects the environment)
 *
 * The package-local file is preferred over a repository-root file, because
 * the repository root also contains a `.env.local` *template* while the
 * package owns the real local configuration.
 *
 * @returns {string}
 */
function envFilePath() {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    for (const candidate of [
      join(dir, 'apps', 'api', ENV_FILE_NAME),
      join(dir, ENV_FILE_NAME),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), ENV_FILE_NAME);
}

/**
 * Parse a dotenv-style file.
 *
 * This is a faithful port of dotenv v16's `parse()` — the exact function
 * `@next/env` (Next.js 15.5.28) calls. The port covers every step of the
 * original:
 *
 *   1. normalise `\r\n` / `\r` to `\n`;
 *   2. for every assignment, take the raw value and `trim()` it;
 *   3. remember the first character, then strip a matching surrounding quote
 *      pair (`'`, `"` or `` ` ``);
 *   4. for a **double**-quoted value only, turn the escape sequences `\n`
 *      and `\r` into real newlines and carriage returns.
 *
 * It never evaluates an expression — the file is configuration, not code.
 *
 * @param {string} contents
 * @returns {Record<string, string>}
 */
function parseEnvFile(contents) {
  /** @type {Record<string, string>} */
  const result = {};
  const normalised = String(contents).replace(/\r\n?/gm, '\n');
  for (const match of normalised.matchAll(LINE_PATTERN)) {
    const key = match[1];
    if (!key) continue;
    let value = (match[2] || '').trim();
    const quote = value[0];
    value = value.replace(QUOTE_PATTERN, '$2');
    if (quote === '"') {
      value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
    }
    result[key] = value;
  }
  return result;
}

/**
 * Index of the last unescaped `$` in a string, or -1 when there is none.
 *
 * @param {string} value
 * @returns {number}
 */
function searchLastDollar(value) {
  const matches = Array.from(value.matchAll(DOLLAR_PATTERN));
  return matches.length > 0 ? matches[matches.length - 1].index : -1;
}

/**
 * Resolve a variable reference.
 *
 * The precedence mirrors the ownership mode:
 *
 *   - `file` mode: the file's own value wins, then the `:-` fallback, then
 *     the ambient value.
 *   - `ambient` mode: the ambient value wins, then the `:-` fallback, then
 *     the file's value.
 *
 * @param {string} name
 * @param {string | undefined} fallback
 * @param {Record<string, string>} parsed
 * @param {'file' | 'ambient'} mode
 * @returns {string}
 */
function resolveReference(name, fallback, parsed, mode) {
  const ambient = process.env[name];
  const fromFile = parsed[name];
  if (mode === 'file') {
    return fromFile || fallback || ambient || '';
  }
  return ambient || fallback || fromFile || '';
}

/**
 * Interpolate `$VAR` / `${VAR}` references.
 *
 * A port of `dotenv-expand` v12: the right-most unescaped `$` is resolved
 * first and the string is then re-scanned, so nested references resolve.
 *
 * @param {string} value
 * @param {Record<string, string>} parsed
 * @param {'file' | 'ambient'} mode
 * @returns {string}
 */
function interpolate(value, parsed, mode) {
  let current = String(value);
  // The bound guards against a self-referential value (`A=$A`) that would
  // otherwise recurse forever.
  for (let round = 0; round < 100; round += 1) {
    const dollarIndex = searchLastDollar(current);
    if (dollarIndex === -1) return current;
    const tail = current.slice(dollarIndex);
    const match = tail.match(INTERPOLATION_PATTERN);
    if (!match) return current;
    const whole = match[1];
    const name = match[2];
    const fallback = match[3];
    if (!whole || !name) return current;
    const replacement = resolveReference(name, fallback, parsed, mode);
    current = current.replace(whole, () => replacement);
  }
  return current;
}

/**
 * Resolve every value in a parsed file, applying interpolation.
 *
 * @param {Record<string, string>} parsed
 * @param {'file' | 'ambient'} mode
 * @returns {Record<string, string>}
 */
function expandEnvValues(parsed, mode) {
  /** @type {Record<string, string>} */
  const resolved = {};
  for (const key of Object.keys(parsed)) {
    const base =
      mode === 'file'
        ? parsed[key]
        : process.env[key] !== undefined
          ? process.env[key]
          : parsed[key];
    resolved[key] = interpolate(base, parsed, mode).replace(
      ESCAPED_DOLLAR_PATTERN,
      '$',
    );
  }
  return resolved;
}

/**
 * True when the process runs inside a container.
 *
 * Docker creates `/.dockerenv` in every container. The marker was verified
 * to exist inside `lake-mongo` and to be absent on the developer machine.
 * Inside a container the ambient environment is authoritative — Compose
 * injects the service names (`minio:9000`, `kafka:29092`) that a host-side
 * file cannot know.
 *
 * @returns {boolean}
 */
function isContainerised() {
  return existsSync('/.dockerenv');
}

/**
 * Resolve which side owns the environment.
 *
 * @returns {'file' | 'ambient'}
 */
function resolveEnvPrecedence() {
  const explicit = String(process.env.LAKEHOUSE_ENV_PRECEDENCE || '')
    .trim()
    .toLowerCase();
  if (explicit === 'file' || explicit === 'ambient') return explicit;

  if (isContainerised()) return 'ambient';

  const environment = String(process.env.ENV || '').trim().toLowerCase();
  if (
    environment === 'staging' ||
    environment === 'prod' ||
    environment === 'production'
  ) {
    return 'ambient';
  }
  return 'file';
}

/**
 * Apply one dotenv file to `process.env`.
 *
 * @param {string} filePath
 * @param {'file' | 'ambient'} mode
 * @returns {string[]} the keys that were assigned
 */
function loadEnvFile(filePath, mode) {
  if (!existsSync(filePath)) return [];
  const parsed = parseEnvFile(readFileSync(filePath, 'utf8'));
  const resolved = expandEnvValues(parsed, mode);
  const applied = [];
  for (const key of Object.keys(resolved)) {
    const value = resolved[key];
    // A template placeholder is never a valid configuration value.
    if (isPlaceholderValue(value)) continue;
    if (mode === 'file' || process.env[key] === undefined) {
      process.env[key] = value;
      applied.push(key);
    }
  }
  return applied;
}

/**
 * Apply the canonical configuration.
 *
 * Safe to call from every entry point. The file is applied at most once per
 * process and per file, so a deliberate runtime override made after startup
 * is never clobbered.
 *
 * @param {{ file?: string, mode?: 'file' | 'ambient' }} [options]
 * @returns {{ file: string, mode: 'file' | 'ambient', applied: string[] }}
 */
function loadLocalEnv(options) {
  const opts = options || {};
  const file = opts.file || envFilePath();
  const mode = opts.mode || resolveEnvPrecedence();
  if (state.loadedFiles.has(file)) return { file, mode, applied: [] };
  state.loadedFiles.add(file);

  let applied = [];
  try {
    applied = loadEnvFile(file, mode);
  } catch (error) {
    // A missing or unreadable configuration file must not take the process
    // down — the ambient environment may still be complete. The message
    // never contains a configuration *value*.
    console.warn(
      '[env-loader] could not apply ' +
        file +
        ': ' +
        (error instanceof Error ? error.message : String(error)),
    );
  }
  return { file, mode, applied };
}

module.exports = {
  envFilePath,
  expandEnvValues,
  interpolate,
  isContainerised,
  isPlaceholderValue,
  loadEnvFile,
  loadLocalEnv,
  parseEnvFile,
  resolveEnvPrecedence,
};
