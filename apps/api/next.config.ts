import type { NextConfig } from 'next';

/**
 * The canonical environment loader.
 *
 * `next.config.ts` is the only hook that runs before *every* Next.js
 * process — `next dev`, `next build` and `next start` — and Next.js loads it
 * in the Node.js runtime, transpiled to CommonJS. Requiring the loader here
 * therefore guarantees the environment is resolved exactly once, in one
 * place, before any route handler, middleware or build step reads
 * `process.env`.
 *
 * Why `require()` and not `import`:
 *
 *   - Next.js transpiles this file to CommonJS and evaluates it with
 *     `requireFromString(code, path.resolve(cwd, 'next.config.compiled.js'))`.
 *     A relative `require('./env-loader.js')` therefore resolves against the
 *     package root (`apps/api/`), which is exactly where the loader lives.
 *   - `env-loader.js` is plain CommonJS, so it needs no TypeScript loader at
 *     runtime and survives in the Docker runtime image, which ships only
 *     `public/`, `.next/`, `node_modules/`, `package.json` and
 *     `next.config.ts` — there is no `src/` directory in the container.
 *
 * Ordering matters: Next.js calls `@next/env`'s `loadEnvConfig()` *before* it
 * loads this file (verified in `next/dist/server/config.js`), and that loader
 * only fills keys that are **absent** from `process.env`. An ambient stale
 * export would therefore survive Next's own loading and shadow
 * `.env.local`. Calling the canonical loader here — after Next's loader has
 * run — is what makes the local file authoritative on a developer machine.
 *
 * See `env-loader.js` for the full ownership rules and the measured
 * evidence behind them.
 */
const envLoader = require('./env-loader.js') as {
  loadLocalEnv: (options?: {
    file?: string;
    mode?: 'file' | 'ambient';
  }) => { file: string; mode: 'file' | 'ambient'; applied: string[] };
};

envLoader.loadLocalEnv();

const buildCpus = Number.parseInt(process.env.NEXT_BUILD_CPUS ?? '', 10);

const nextConfig: NextConfig = {
  ...(Number.isInteger(buildCpus) && buildCpus > 0 ? { experimental: { cpus: buildCpus } } : {}),
  serverExternalPackages: [
    '@duckdb/node-api',
    '@valkey/valkey-glide',
    'bullmq',
    'ioredis',
    'mongoose',
  ],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
