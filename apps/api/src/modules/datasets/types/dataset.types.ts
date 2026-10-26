/**
 * Canonical, provider-aware dataset identity.
 *
 * MASTER PLAN §02.2 (Single-Owner Principle) and §05.1 (DatasetResolver)
 * require exactly one place that knows how a dataset maps to its physical
 * location and which operations that dataset supports. Before this module the
 * path was hard-coded in five different repositories (bronze/silver/gold/
 * catalog/dq), each with its own bucket assumption — and the Python lakehouse
 * wrote to a completely different layout than the TypeScript control plane
 * read from.
 *
 * The canonical layout is now:
 *
 *   s3://lakehouse/{layer}/{database}/{table}
 *
 * where `database` is the source-system / domain segment (`crm`, `erp`,
 * `retail`, `clickstream`, `ecommerce`). The Python side resolves the exact
 * same layout through `lakehouse.core.paths.LakePaths`.
 */

import { env } from '@/config';
import { AppError } from '@/errors';

export const DATASET_PROVIDERS = [
  'local_delta_minio',
  'databricks_uc',
  'kafka_topic',
  'uploaded_fixture',
] as const;
export type DatasetProvider = (typeof DATASET_PROVIDERS)[number];

export const DATASET_LAYERS = ['bronze', 'silver', 'gold'] as const;
export type DatasetLayer = (typeof DATASET_LAYERS)[number];

/** Canonical storage bucket for the local Delta lakehouse. */
export const LAKEHOUSE_BUCKET = env.LAKEHOUSE_BUCKET;

/**
 * Canonical table → database mapping.
 *
 * Mirrors `lakehouse.core.datasets.TABLE_DATABASE` on the Python side so a
 * bare table name resolves to exactly one dataset on both sides of the
 * control plane. Without it, `orders` would be ambiguous between the Bronze
 * source (`erp.orders`) and the Gold aggregate (`retail.…`).
 */
export const TABLE_DATABASE: Readonly<Record<string, string>> = Object.freeze({
  // Bronze / Silver source datasets
  customers: 'crm',
  products: 'erp',
  orders: 'erp',
  // Streaming datasets
  events: 'clickstream',
  unique_metrics_5min: 'clickstream',
  crawler_records: 'crawler',
  crawler_records_delta: 'crawler',
  crawler_source_metrics_delta: 'crawler',
  // Gold aggregates
  fact_orders: 'retail',
  dim_customers: 'retail',
  dim_products: 'retail',
  daily_revenue: 'retail',
});

/**
 * Canonical Silver sources of each Gold aggregate.
 *
 * A Gold dataset lives in the `retail` database segment, but the Silver
 * datasets it aggregates live in *their own* segments (`erp/orders`,
 * `crm/customers`). Resolving a Gold source with the Gold database segment
 * would point Spark at a path that does not exist.
 *
 * Mirrors `lakehouse.core.datasets.GOLD_AGGREGATE_SOURCES` on the Python
 * side — the two halves must agree or the control plane would ask for a
 * dataset that the pipeline never reads.
 */
export const GOLD_AGGREGATE_SOURCES: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    fact_orders: Object.freeze(['orders', 'customers', 'products']),
    dim_customers: Object.freeze(['customers', 'orders']),
    dim_products: Object.freeze(['products', 'orders']),
    daily_revenue: Object.freeze(['orders']),
  });

/**
 * Resolve a Gold source table name to its canonical `(database, table)`.
 *
 * Accepts the bare form (`orders`), the slash form (`erp/orders`) and the
 * dotted form (`erp.orders`). Returns `null` for an unknown table, so an
 * unrelated name is never silently substituted.
 */
export function resolveGoldSource(
  table: string,
): { database: string; table: string } | null {
  const raw = (table ?? '').trim().toLowerCase();
  if (!raw) return null;
  let database: string;
  let name: string;
  if (raw.includes('/')) {
    const [db, ...rest] = raw.split('/');
    database = db ?? '';
    name = rest.join('/');
  } else if (raw.includes('.')) {
    const [db, ...rest] = raw.split('.');
    database = db ?? '';
    name = rest.join('.');
  } else {
    database = defaultDatabaseFor(raw);
    name = raw;
  }
  const known = Object.prototype.hasOwnProperty.call(TABLE_DATABASE, name);
  if (!known || !IDENTIFIER_RE.test(name) || !IDENTIFIER_RE.test(database)) {
    return null;
  }
  return { database, table: name };
}

/** Database used when a table name has no canonical mapping. */
export const DEFAULT_DATABASE = 'default';

/**
 * Resolve the canonical database of a table name.
 *
 * This mirrors `lakehouse.core.datasets.default_database_for` exactly. The
 * two sides MUST agree: Python owns the Delta writes, so a divergent rule
 * here would make the control plane address a different path than the
 * pipeline that produced the data.
 *
 * Note there is deliberately no layer-based special-casing. Gold has no
 * `orders` table (its aggregates are `fact_orders`, `dim_customers`,
 * `dim_products`, `daily_revenue`), so `orders` always means `erp.orders`.
 */
export function defaultDatabaseFor(table: string, _layer?: DatasetLayer): string {
  const name = (table ?? '').trim().toLowerCase();
  return TABLE_DATABASE[name] ?? DEFAULT_DATABASE;
}

export type DataAccessMode = 'read' | 'read_write';

export interface DatasetCapabilities {
  canRead: boolean;
  canProfile: boolean;
  canDq: boolean;
  canIngest: boolean;
  canTransform: boolean;
  canAggregate: boolean;
  /** Human-readable reason for every denied capability. */
  reasons: Record<string, string>;
}

export interface DatasetRef {
  /** Provider that owns the data. */
  provider: DatasetProvider;
  /** Medallion layer (absent for kafka/uploaded sources). */
  layer?: DatasetLayer;
  /** Source-system / domain segment. */
  database?: string;
  /** Table name within the layer. */
  table?: string;
  /** Stable control-plane identity: `provider/layer.database.table`. */
  datasetId: string;
  /** Fully-qualified name in the owning catalog (Databricks UC). */
  qualifiedName?: string;
  /** Internal storage path (never user-supplied). */
  storagePath?: string;
  /** Access mode the control plane is allowed to use. */
  dataAccessMode: DataAccessMode;
  /** Kafka topic when the provider is `kafka_topic`. */
  kafkaTopic?: string;
  /** Delta snapshot version when known. */
  deltaVersion?: number;
  /** Read/write permission flags. */
  capabilities: DatasetCapabilities;
}

/** Identifiers accepted by the resolver — all validated, never raw paths. */
const IDENTIFIER_RE = /^[a-z0-9][a-z0-9_]*$/;

export function isDatasetLayer(value: unknown): value is DatasetLayer {
  return typeof value === 'string' && (DATASET_LAYERS as readonly string[]).includes(value);
}

export function isDatasetProvider(value: unknown): value is DatasetProvider {
  return typeof value === 'string' && (DATASET_PROVIDERS as readonly string[]).includes(value);
}

function assertIdentifier(value: string, kind: string): string {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!IDENTIFIER_RE.test(normalized)) {
    throw new AppError(
      400,
      'INVALID_DATASET_IDENTIFIER',
      `Invalid ${kind}: ${value}. Expected lowercase alphanumeric with underscores.`,
    );
  }
  return normalized;
}

/**
 * Providers that never accept a mutation from this control plane.
 *
 * Databricks is connected read-only (no Spark write permission), and an
 * uploaded fixture is a sandbox copy that must not overwrite a production
 * dataset. MASTER PLAN §02.3 / risk R-01.
 */
const READ_ONLY_PROVIDERS: ReadonlySet<DatasetProvider> = new Set<DatasetProvider>([
  'databricks_uc',
  'uploaded_fixture',
]);

/**
 * Canonical storage path for a medallion dataset.
 *
 * Mirrors `lakehouse.core.paths.LakePaths.table_path` on the Python side.
 */
export function canonicalStoragePath(
  layer: DatasetLayer,
  database: string,
  table: string,
): string {
  const db = assertIdentifier(database, 'database');
  const name = assertIdentifier(table, 'table');
  return `s3://${LAKEHOUSE_BUCKET}/${layer}/${db}/${name}`;
}

/**
 * Root path of a medallion layer — used for globbing the layer contents.
 *
 * `canonicalStoragePath` validates identifiers, so the wildcard form needed
 * by `glob('...')` has its own helper instead of bypassing the validator.
 */
export function layerRootPath(layer: DatasetLayer): string {
  return `s3://${LAKEHOUSE_BUCKET}/${layer}`;
}

/** Canonical table id used by the catalog: `layer.database.table`. */
export function canonicalTableId(layer: DatasetLayer, database: string, table: string): string {
  return `${layer}.${assertIdentifier(database, 'database')}.${assertIdentifier(table, 'table')}`;
}

export interface DatasetQuery {
  provider?: DatasetProvider;
  layer?: DatasetLayer;
  database?: string;
  table?: string;
  datasetId?: string;
  kafkaTopic?: string;
  deltaVersion?: number;
}

/**
 * Resolve a dataset reference without touching storage.
 *
 * The resolver is pure: it validates and normalizes the identity and derives
 * the capabilities. Existence checks live in the repositories so this stays
 * cheap and testable.
 */
export function resolveDataset(query: DatasetQuery): DatasetRef {
  if (query.datasetId) {
    return resolveFromDatasetId(query.datasetId, query.deltaVersion);
  }

  const provider = query.provider ?? activeProvider();

  if (provider === 'kafka_topic') {
    const topic = (query.kafkaTopic ?? query.table ?? '').trim();
    if (!topic) {
      throw new AppError(400, 'KAFKA_TOPIC_REQUIRED', 'A Kafka dataset requires a topic name');
    }
    return {
      provider,
      datasetId: `kafka_topic/${topic}`,
      kafkaTopic: topic,
      dataAccessMode: 'read',
      capabilities: {
        canRead: true,
        canProfile: true,
        canDq: true,
        canIngest: true,
        canTransform: false,
        canAggregate: false,
        reasons: {
          canTransform: 'Kafka topics are ingested into Bronze; transformation targets a Bronze dataset.',
          canAggregate: 'Kafka topics are ingested into Bronze; aggregation targets a Silver dataset.',
        },
      },
    };
  }

  if (provider === 'uploaded_fixture') {
    const database = assertIdentifier(query.database ?? 'default', 'database');
    const table = assertIdentifier(query.table ?? 'fixture', 'table');
    return {
      provider,
      layer: query.layer ?? 'bronze',
      database,
      table,
      datasetId: `uploaded_fixture/${query.layer ?? 'bronze'}.${database}.${table}`,
      storagePath: canonicalStoragePath(query.layer ?? 'bronze', database, table),
      dataAccessMode: 'read',
      capabilities: {
        canRead: true,
        canProfile: true,
        canDq: true,
        canIngest: false,
        canTransform: false,
        canAggregate: false,
        reasons: {
          canIngest: 'Uploaded fixtures are read-only copies; ingest into a normal Bronze dataset.',
          canTransform: 'Uploaded fixtures are read-only copies; transform a Bronze dataset.',
          canAggregate: 'Uploaded fixtures are read-only copies; aggregate a Silver dataset.',
        },
      },
    };
  }

  if (!query.layer || !query.database || !query.table) {
    throw new AppError(
      400,
      'DATASET_REFERENCE_INCOMPLETE',
      'A dataset reference requires provider, layer, database and table (or a datasetId).',
    );
  }

  const layer = query.layer;
  const database = assertIdentifier(query.database, 'database');
  const table = assertIdentifier(query.table, 'table');

  if (provider === 'databricks_uc') {
    const catalog = env.DATABRICKS_CATALOG;
    const schema = {
      bronze: env.DATABRICKS_BRONZE_SCHEMA,
      silver: env.DATABRICKS_SILVER_SCHEMA,
      gold: env.DATABRICKS_GOLD_SCHEMA,
    }[layer];
    const qualifiedName = `${catalog}.${schema}.${table}`;
    return {
      provider,
      layer,
      database,
      table,
      datasetId: `databricks_uc/${canonicalTableId(layer, database, table)}`,
      qualifiedName,
      dataAccessMode: 'read',
      ...(query.deltaVersion !== undefined ? { deltaVersion: query.deltaVersion } : {}),
      capabilities: {
        canRead: true,
        canProfile: true,
        canDq: true,
        canIngest: false,
        canTransform: false,
        canAggregate: false,
        reasons: {
          canIngest: 'This Databricks connection is read-only; ingest targets the local Delta lakehouse.',
          canTransform: 'This Databricks connection is read-only; transform targets the local Delta lakehouse.',
          canAggregate: 'This Databricks connection is read-only; aggregate targets the local Delta lakehouse.',
        },
      },
    };
  }

  // local_delta_minio
  const storagePath = canonicalStoragePath(layer, database, table);
  return {
    provider,
    layer,
    database,
    table,
    datasetId: `local_delta_minio/${canonicalTableId(layer, database, table)}`,
    storagePath,
    dataAccessMode: 'read_write',
    ...(query.deltaVersion !== undefined ? { deltaVersion: query.deltaVersion } : {}),
    capabilities: {
      canRead: true,
      canProfile: true,
      canDq: true,
      canIngest: true,
      canTransform: true,
      canAggregate: true,
      reasons: {},
    },
  };
}

/**
 * Map a Databricks schema segment back to its medallion layer.
 *
 * The schema names are configurable (`DATABRICKS_BRONZE_SCHEMA` and friends),
 * so the mapping reads the environment instead of assuming `bronze`/`silver`/
 * `gold`. A schema that matches none of them is not a medallion dataset.
 */
function layerFromDatabricksSchema(schema: string): DatasetLayer | null {
  const mapping: ReadonlyArray<[string, DatasetLayer]> = [
    [env.DATABRICKS_BRONZE_SCHEMA, 'bronze'],
    [env.DATABRICKS_SILVER_SCHEMA, 'silver'],
    [env.DATABRICKS_GOLD_SCHEMA, 'gold'],
  ];
  const match = mapping.find(([name]) => name === schema);
  return match ? match[1] : null;
}

/**
 * Parse a `provider/layer.database.table` dataset id back into a reference.
 *
 * The legacy Databricks form `databricks_uc/{catalog}.{schema}.{table}` is
 * still accepted: identifiers persisted before the canonical identity was
 * introduced must keep resolving, and the schema segment still determines
 * the layer unambiguously.
 */
export function resolveFromDatasetId(datasetId: string, deltaVersion?: number): DatasetRef {
  const trimmed = (datasetId ?? '').trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0) {
    throw new AppError(400, 'INVALID_DATASET_ID', `Invalid datasetId: ${datasetId}`);
  }
  const provider = trimmed.slice(0, slash);
  const rest = trimmed.slice(slash + 1);
  if (!isDatasetProvider(provider)) {
    throw new AppError(400, 'INVALID_DATASET_PROVIDER', `Unknown dataset provider: ${provider}`);
  }
  if (provider === 'kafka_topic') {
    return resolveDataset({ provider, kafkaTopic: rest, ...(deltaVersion !== undefined ? { deltaVersion } : {}) });
  }
  const parts = rest.split('.');
  if (parts.length !== 3) {
    throw new AppError(
      400,
      'INVALID_DATASET_ID',
      `Invalid datasetId: ${datasetId}. Expected {provider}/{layer}.{database}.{table}.`,
    );
  }
  const [first, second, third] = parts as [string, string, string];
  if (isDatasetLayer(first)) {
    return resolveDataset({
      provider,
      layer: first,
      database: second,
      table: third,
      ...(deltaVersion !== undefined ? { deltaVersion } : {}),
    });
  }
  if (provider === 'databricks_uc') {
    const layer = layerFromDatabricksSchema(second);
    if (layer) {
      return resolveDataset({
        provider,
        layer,
        database: first,
        table: third,
        ...(deltaVersion !== undefined ? { deltaVersion } : {}),
      });
    }
  }
  throw new AppError(
    400,
    'INVALID_DATASET_ID',
    `Invalid datasetId: ${datasetId}. Expected {provider}/{layer}.{database}.{table}.`,
  );
}

/** The provider the control plane currently writes to. */
export function activeProvider(): DatasetProvider {
  return env.LAKEHOUSE_DATA_SOURCE === 'databricks' ? 'databricks_uc' : 'local_delta_minio';
}

/**
 * Guard a mutation: the target provider must accept writes.
 *
 * This is the single place that prevents the control plane from presenting
 * a Databricks dataset as if a MinIO pipeline were operating on it.
 */
export function assertWritable(ref: DatasetRef, action: string): void {
  if (READ_ONLY_PROVIDERS.has(ref.provider)) {
    throw new AppError(
      409,
      'DATASET_NOT_WRITABLE',
      `${action} is not permitted on provider "${ref.provider}". ` +
        'The local Delta lakehouse (local_delta_minio) is the writable execution target.',
    );
  }
  if (ref.dataAccessMode !== 'read_write') {
    throw new AppError(409, 'DATASET_NOT_WRITABLE', `${action} is not permitted on this dataset.`);
  }
}

/** Guard a read: the dataset must declare read support. */
export function assertReadable(ref: DatasetRef, action: string): void {
  if (!ref.capabilities.canRead) {
    const reason = ref.capabilities.reasons.canRead ?? 'Read access is not available.';
    throw new AppError(403, 'DATASET_NOT_READABLE', `${action} is not permitted. ${reason}`);
  }
}
