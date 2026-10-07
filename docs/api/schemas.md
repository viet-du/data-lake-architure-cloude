# Zod Schemas (`apps/web/src/schemas`)

Zod schemas mirror the entity types and the wire format. They are the single source of truth for runtime validation.

## Location

```
src/schemas/
  commons.schema.ts        ← apiResponseSchema, healthStatusSchema, paginationSchema
  bronze/
  silver/
  gold/
  crawler/
  kafka/
  airflow/
  dq/
  index.ts                 ← barrel re-exports
```

## Conventions

1. **One schema per file** under the domain folder.
2. **Enums are exported first** (`crawlerStatusSchema`, `dagStateSchema`, …) so other schemas can compose them.
3. **Response schemas wrap arrays/objects** with `apiResponseSchema(...)`.
4. **Payload schemas** (create/update/run) are exposed alongside response schemas.
5. **Strict mode** is on by default — unknown fields are rejected.

## Example

```ts
// schemas/crawler/crawler.schema.ts
export const crawlerStatusSchema = z.enum(['idle', 'running', 'paused', 'completed', 'failed']);

export const crawlerJobSchema = z.object({
  name: z.string().min(1),
  source: z.string(),
  category: z.string(),
  status: crawlerStatusSchema,
  ratePerMinute: z.number().nonnegative(),
  maxWorkers: z.number().int().nonnegative(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  pagesScraped: z.number().int().nonnegative(),
  recordsCollected: z.number().int().nonnegative(),
  recordsFailed: z.number().int().nonnegative(),
  kafkaTopic: z.string().optional(),
  errorMessage: z.string().optional(),
  health: healthStatusSchema,
});

export const crawlerJobsResponseSchema = apiResponseSchema(z.array(crawlerJobSchema));
```

## Why Zod

- One schema, two consumers: runtime validation at the service boundary + inferred TS types.
- Plays well with `exactOptionalPropertyTypes: true`.
- Cheap to compose (`.omit`, `.pick`, `.partial`, `.extend`).
- No code generation step.

## Where They Are Used

- **Service layer** could call `.safeParse(...)` for hard guarantees (currently only the loaders do).
- **Forms** use `useFormZod(schema, initial)` (see `components/crawler/crawler-trigger-form.component.tsx`).
- **Tests** import schemas to assert payload shapes (see `apps/web/src/schemas/__tests__`).
