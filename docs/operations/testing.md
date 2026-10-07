# Testing Guide

## Frontend (apps/web)

Tooling: **Vitest** + **@testing-library/react** + **jsdom**.

### Run

```bash
pnpm --filter @lakehouse/web test         # one-shot
pnpm --filter @lakehouse/web test:watch   # watch mode
```

### What to test

1. **Schemas** (`src/schemas/<domain>/*.test.ts`): parse valid payloads, reject invalid ones.
2. **Services** (`src/services/<domain>/*.test.ts`): mock the API client and assert URL + payload.
3. **Components** (`src/components/<domain>/*.test.tsx`): render with React Testing Library, assert key text.
4. **Hooks** (`src/hooks/*.test.ts`): mount with `@testing-library/react`'s `renderHook`.

### Conventions

- One test file per source file: `foo.ts` ↔ `foo.test.ts`.
- Use `vi.mock('../api')` to stub the API client.
- Use `screen.getByRole(...)` and `screen.getByText(...)` (avoid `getByTestId`).
- No snapshot tests on components — assert semantics instead.

## Backend (apps/api)

Tooling: **Vitest** + **supertest** (or `next-test-api-route-handler` for Route Handlers).

```bash
pnpm --filter @lakehouse/api test
```

### What to test

1. **Modules / use-cases**: pure functions, no I/O.
2. **Route Handlers**: with mocked modules and a fake request.
3. **Adapters** (`infra/`): with mocked SDKs (e.g. `aws-sdk-client-mock`).

## Data (lakehouse)

Tooling: **pytest** + **pytest-mock** + **responses**.

```bash
pytest                                  # all
pytest tests/test_schemas.py            # one file
pytest --cov=lakehouse                  # with coverage
```

### What to test

1. **Schemas** (Pydantic) — accept/reject.
2. **Crawlers** — mocked HTTP, assert parsing.
3. **Transforms** — small DataFrames in/out.
4. **DQ rules** — known-good + known-bad inputs.

## CI Gates

The pipeline (`docs/operations/ci-cd.md`) runs:

- `pnpm lint` — must be 0 errors.
- `pnpm typecheck` — must pass.
- `pnpm test` — must pass.
- `pytest` — must pass with coverage ≥ 70%.
- `pnpm build` — must succeed.
