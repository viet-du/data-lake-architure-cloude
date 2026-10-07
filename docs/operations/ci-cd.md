# CI / CD

The pipeline runs on every push and pull request.

## Stages

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  Lint   │ → │  Type   │ → │  Test   │ → │  Build  │ → │ Docker  │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

## Quality Gates

| Gate | Tool | Rule |
| --- | --- | --- |
| Lint | `oxlint` (web) + `next lint` (api) | 0 errors, 0 warnings |
| Type | `tsc --noEmit` | No errors |
| Unit | `vitest run` | All green |
| Pytest | `pytest --cov=lakehouse` | Coverage ≥ 70% |
| Build | `vite build` + `next build` | Both succeed |

## Caching

- `pnpm` store cached via `pnpm/action-setup`.
- Docker layers cached via BuildKit (`cache-from: type=gha`).

## Deploy

| Branch | Target |
| --- | --- |
| `main` | Production |
| `feat/*` | Preview environment (auto-deleted after 7 days) |
| `hotfix/*` | Production (after review) |

## Release Tagging

```bash
git tag -a v2.0.0 -m "Lakehouse v2.0.0"
git push origin v2.0.0
```

The release workflow builds and pushes Docker images with the tag as version.
