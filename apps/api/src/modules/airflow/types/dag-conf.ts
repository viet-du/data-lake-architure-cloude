/**
 * The DAG trigger allowlist.
 *
 * MASTER PLAN §09.1 requires a trigger wizard with a `conf` allowlist, and
 * §13.4 forbids a browser-supplied value from turning into an arbitrary
 * command. A DAG run `conf` is not a shell command, but it *is* an
 * untyped map that ends up in `{{ dag_run.conf }}` inside the DAG — and the
 * legacy DAGs in this repository pass parts of their environment into
 * `BashOperator` commands.
 *
 * The allowlist therefore has two jobs:
 *
 *   1. it names the keys a given DAG accepts, so the wizard can render a
 *      form instead of a free-text JSON blob;
 *   2. it *rejects* everything else, so a caller cannot smuggle an
 *      unvalidated value into a run.
 *
 * The mapping is explicit and per-DAG. An unknown DAG has an empty
 * allowlist, which means "no conf may be sent" — the safe default. A DAG
 * that is not listed can still be triggered, but only with an empty `conf`.
 */
export interface DagConfSpec {
  /** The keys the DAG accepts. */
  keys: readonly string[];
  /** The type of each key, used by the wizard to render the right input. */
  types: Readonly<Record<string, 'string' | 'number' | 'boolean' | 'enum'>>;
  /** For `enum` keys: the permitted values. */
  options?: Readonly<Record<string, readonly string[]>>;
  /** A short description shown next to the field. */
  descriptions?: Readonly<Record<string, string>>;
  /** Datasets the DAG reads/writes, for the "dataset impact" links. */
  datasets?: ReadonlyArray<{ layer: string; database: string; table: string }>;
}

/**
 * The known DAGs.
 *
 * The list is intentionally conservative: a DAG that is not listed can be
 * triggered with an empty `conf` only. Adding a DAG here is a one-line
 * change that makes its parameters reachable from the UI.
 */
export const DAG_CONF_ALLOWLIST: Readonly<Record<string, DagConfSpec>> = {
  retail_elt_dag: {
    keys: ['inputProfile', 'businessDate', 'fullRefresh'],
    types: {
      inputProfile: 'enum',
      businessDate: 'string',
      fullRefresh: 'boolean',
    },
    options: {
      inputProfile: ['verified-retail-fixture-v1', 'retail-fixture-v1'],
    },
    descriptions: {
      inputProfile: 'Which deterministic fixture profile the DAG reads.',
      businessDate: 'Business date partition to process (YYYY-MM-DD).',
      fullRefresh: 'Rebuild every partition instead of the incremental set.',
    },
    datasets: [
      { layer: 'bronze', database: 'erp', table: 'orders' },
      { layer: 'bronze', database: 'crm', table: 'customers' },
      { layer: 'bronze', database: 'erp', table: 'products' },
      { layer: 'silver', database: 'erp', table: 'orders' },
      { layer: 'silver', database: 'crm', table: 'customers' },
      { layer: 'silver', database: 'erp', table: 'products' },
      { layer: 'gold', database: 'retail', table: 'fact_orders' },
      { layer: 'gold', database: 'retail', table: 'dim_customers' },
      { layer: 'gold', database: 'retail', table: 'dim_products' },
      { layer: 'gold', database: 'retail', table: 'daily_revenue' },
    ],
  },
  ecommerce_streaming_dag: {
    keys: ['topic', 'maxRecords'],
    types: {
      topic: 'string',
      maxRecords: 'number',
    },
    descriptions: {
      topic: 'The Kafka topic to consume from.',
      maxRecords: 'Maximum number of records to consume in this run.',
    },
    datasets: [{ layer: 'bronze', database: 'clickstream', table: 'events' }],
  },
  clickstream_streaming_dag: {
    keys: ['topic', 'maxRecords'],
    types: {
      topic: 'string',
      maxRecords: 'number',
    },
    descriptions: {
      topic: 'The Kafka topic to consume from.',
      maxRecords: 'Maximum number of records to consume in this run.',
    },
    datasets: [{ layer: 'bronze', database: 'clickstream', table: 'events' }],
  },
  crawler_dag: {
    keys: ['crawlerName', 'pages'],
    types: {
      crawlerName: 'enum',
      pages: 'number',
    },
    options: {
      crawlerName: ['crypto', 'github', 'hackernews', 'tiki'],
    },
    descriptions: {
      crawlerName: 'Which crawler adapter to run.',
      pages: 'Maximum number of pages to fetch.',
    },
    datasets: [{ layer: 'bronze', database: 'crawler', table: 'crawler_records' }],
  },
};

/** The allowlist entry for a DAG, or `undefined` when the DAG is unknown. */
export function dagConfSpec(dagId: string): DagConfSpec | undefined {
  return DAG_CONF_ALLOWLIST[dagId];
}

/**
 * Filter a caller-supplied `conf` against the allowlist.
 *
 * Returns the accepted subset plus the list of rejected keys. The caller
 * decides whether a rejection is fatal; the trigger route treats it as a
 * 400, because silently dropping a key the user typed is worse than
 * refusing the run.
 */
export function filterConf(
  dagId: string,
  conf: Record<string, unknown>,
): { accepted: Record<string, unknown>; rejected: string[] } {
  const spec = dagConfSpec(dagId);
  if (!spec) {
    // An unknown DAG accepts nothing. Any key is a rejection.
    return { accepted: {}, rejected: Object.keys(conf) };
  }
  const accepted: Record<string, unknown> = {};
  const rejected: string[] = [];
  for (const [key, value] of Object.entries(conf)) {
    if (!spec.keys.includes(key)) {
      rejected.push(key);
      continue;
    }
    accepted[key] = value;
  }
  return { accepted, rejected };
}

/**
 * Validate the *value* of an accepted key against its declared type.
 *
 * The allowlist decides *whether* a key may be sent; this decides whether
 * the value is well-formed. A value of the wrong type is rejected with the
 * same weight as an unknown key.
 */
export function validateConfValues(
  dagId: string,
  conf: Record<string, unknown>,
): { errors: string[] } {
  const spec = dagConfSpec(dagId);
  const errors: string[] = [];
  if (!spec) return { errors };

  for (const [key, value] of Object.entries(conf)) {
    const type = spec.types[key];
    if (!type) continue;

    if (value === null || value === undefined) {
      errors.push(`"${key}" must not be null.`);
      continue;
    }

    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`"${key}" must be a string.`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push(`"${key}" must be a finite number.`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`"${key}" must be a boolean.`);
        }
        break;
      case 'enum': {
        const options = spec.options?.[key] ?? [];
        if (!options.includes(String(value))) {
          errors.push(`"${key}" must be one of: ${options.join(', ')}.`);
        }
        break;
      }
      default:
        break;
    }
  }

  return { errors };
}
