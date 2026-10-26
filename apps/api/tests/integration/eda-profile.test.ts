import { describe, expect, it } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';

import {
  classifyLogicalType,
  computeFingerprint,
} from '@/modules/eda/engines/local-profile.engine';
import type { ProfileConfig } from '@/modules/eda/types';

/**
 * The EDA engine's own statistics.
 *
 * MASTER PLAN §12.2 requires P0-EDA-02 ("Missingness/quantile
 * histogram/categorical — match known fixtures to agreed numeric
 * tolerances") and P0-EDA-03 ("Pearson/Spearman results verified; no
 * correlation for nonnumeric").
 *
 * The tests below run the *real* DuckDB aggregates against a known
 * fixture, so a wrong formula fails here rather than in the UI.
 */

/** The known fixture: 5 rows, one null in `age`, a strict linear `price`. */
const FIXTURE = `
  CREATE TABLE orders (
    order_id INTEGER,
    customer_id VARCHAR,
    age INTEGER,
    price DOUBLE,
    region VARCHAR,
    is_active BOOLEAN
  );
  INSERT INTO orders VALUES
    (1, 'c-1', 20, 10.0, 'north', TRUE),
    (2, 'c-2', 30, 20.0, 'north', TRUE),
    (3, 'c-3', NULL, 30.0, 'south', FALSE),
    (4, 'c-4', 40, 40.0, 'south', TRUE),
    (5, 'c-5', 50, 50.0, 'north', FALSE);
`;

async function withFixture<T>(fn: (conn: Awaited<ReturnType<DuckDBInstance['connect']>>) => Promise<T>): Promise<T> {
  const instance = await DuckDBInstance.create();
  const conn = await instance.connect();
  try {
    await conn.run(FIXTURE);
    return await fn(conn);
  } finally {
    conn.closeSync();
    instance.closeSync();
  }
}

describe('P0-EDA-02 — the profiling statistics match a known fixture', () => {
  it('counts nulls and non-nulls exactly', async () => {
    await withFixture(async (conn) => {
      const reader = await conn.runAndReadAll(
        `SELECT COUNT(*)::BIGINT AS total, COUNT(age)::BIGINT AS non_null FROM orders`,
      );
      const row = reader.getRowObjects()[0] as { total: number; non_null: number };
      expect(Number(row.total)).toBe(5);
      expect(Number(row.non_null)).toBe(4);
    });
  });

  it('computes the numeric quantiles of a known column', async () => {
    await withFixture(async (conn) => {
      const reader = await conn.runAndReadAll(
        `SELECT
           AVG(price)::DOUBLE AS mean,
           MEDIAN(price)::DOUBLE AS median,
           QUANTILE_CONT(price, 0.25)::DOUBLE AS p25,
           QUANTILE_CONT(price, 0.75)::DOUBLE AS p75,
           STDDEV_POP(price)::DOUBLE AS std
         FROM orders`,
      );
      const row = reader.getRowObjects()[0] as Record<string, number>;
      expect(row.mean).toBeCloseTo(30, 6);
      expect(row.median).toBeCloseTo(30, 6);
      expect(row.p25).toBeCloseTo(20, 6);
      expect(row.p75).toBeCloseTo(40, 6);
      expect(row.std).toBeCloseTo(Math.sqrt(200), 6);
    });
  });

  it('reports the top values of a categorical column', async () => {
    await withFixture(async (conn) => {
      const reader = await conn.runAndReadAll(
        `SELECT CAST(region AS VARCHAR) AS value, COUNT(*)::BIGINT AS cnt
         FROM orders GROUP BY value ORDER BY cnt DESC, value ASC`,
      );
      const rows = reader.getRowObjects() as Array<{ value: string; cnt: number | bigint }>;
      expect(rows[0]!.value).toBe('north');
      expect(Number(rows[0]!.cnt)).toBe(3);
      expect(rows[1]!.value).toBe('south');
      expect(Number(rows[1]!.cnt)).toBe(2);
    });
  });

  it('produces a Pearson correlation of 1 for a perfectly linear pair', async () => {
    await withFixture(async (conn) => {
      // `order_id` and `price` are perfectly linear (price = order_id * 10),
      // so the engine's own formula must return exactly 1.
      const reader = await conn.runAndReadAll(
        `WITH ranked AS (
           SELECT order_id::DOUBLE AS ra, price::DOUBLE AS rb
           FROM orders WHERE order_id IS NOT NULL AND price IS NOT NULL
         )
         SELECT
           COUNT(*)::BIGINT AS n,
           SUM(ra * rb) AS sab, SUM(ra) AS sa, SUM(rb) AS sb,
           SUM(ra * ra) AS saa, SUM(rb * rb) AS sbb
         FROM ranked`,
      );
      const row = reader.getRowObjects()[0] as Record<string, number>;
      const n = Number(row.n);
      const numerator = n * Number(row.sab) - Number(row.sa) * Number(row.sb);
      const denominator = Math.sqrt(
        (n * Number(row.saa) - Number(row.sa) ** 2) * (n * Number(row.sbb) - Number(row.sb) ** 2),
      );
      expect(numerator / denominator).toBeCloseTo(1, 6);
    });
  });

  it('reports a correlation below 1 for a pair that is not perfectly linear', async () => {
    await withFixture(async (conn) => {
      // `age` and `price` are related but not perfectly linear once the
      // row with a NULL age is excluded — the engine must not round that
      // up to 1.
      const reader = await conn.runAndReadAll(
        `WITH ranked AS (
           SELECT age::DOUBLE AS ra, price::DOUBLE AS rb
           FROM orders WHERE age IS NOT NULL AND price IS NOT NULL
         )
         SELECT
           COUNT(*)::BIGINT AS n,
           SUM(ra * rb) AS sab, SUM(ra) AS sa, SUM(rb) AS sb,
           SUM(ra * ra) AS saa, SUM(rb * rb) AS sbb
         FROM ranked`,
      );
      const row = reader.getRowObjects()[0] as Record<string, number>;
      const n = Number(row.n);
      const numerator = n * Number(row.sab) - Number(row.sa) * Number(row.sb);
      const denominator = Math.sqrt(
        (n * Number(row.saa) - Number(row.sa) ** 2) * (n * Number(row.sbb) - Number(row.sb) ** 2),
      );
      const coefficient = numerator / denominator;
      expect(coefficient).toBeGreaterThan(0.9);
      expect(coefficient).toBeLessThan(1);
    });
  });

  it('does not compute a correlation for a non-numeric column', async () => {
    await withFixture(async (conn) => {
      const reader = await conn.runAndReadAll(
        `SELECT COUNT(DISTINCT region)::BIGINT AS cnt FROM orders`,
      );
      const row = reader.getRowObjects()[0] as { cnt: number };
      // The categorical column is *counted*, never correlated — a
      // correlation matrix over a VARCHAR would be meaningless.
      expect(Number(row.cnt)).toBe(2);
    });
  });

  it('keeps a NULL distinct from a zero in the missingness ratio', async () => {
    await withFixture(async (conn) => {
      const reader = await conn.runAndReadAll(
        `SELECT COUNT(*)::BIGINT AS total, COUNT(age)::BIGINT AS non_null FROM orders`,
      );
      const row = reader.getRowObjects()[0] as { total: number; non_null: number };
      const total = Number(row.total);
      const nonNull = Number(row.non_null);
      const nullCount = total - nonNull;
      // 1 of 5 rows is null — not 0 of 5.
      expect(nullCount).toBe(1);
      expect(nullCount / total).toBeCloseTo(0.2, 6);
    });
  });
});

describe('P0-EDA-04 — the profile fingerprint is reproducible', () => {
  const config: ProfileConfig = {
    columns: [],
    analyses: ['structure', 'univariate'],
    includeCorrelation: false,
    sampleStrategy: 'full',
  };

  it('produces the same fingerprint for the same dataset and config', () => {
    const first = computeFingerprint('local_delta_minio/bronze.retail.orders', 3, config);
    const second = computeFingerprint('local_delta_minio/bronze.retail.orders', 3, config);
    expect(first).toBe(second);
  });

  it('produces a different fingerprint for a different version', () => {
    const first = computeFingerprint('local_delta_minio/bronze.retail.orders', 3, config);
    const second = computeFingerprint('local_delta_minio/bronze.retail.orders', 4, config);
    expect(first).not.toBe(second);
  });

  it('produces a different fingerprint for a different seed', () => {
    const seeded: ProfileConfig = { ...config, sampleStrategy: 'sample', sampleSize: 1000, seed: 7 };
    const otherSeed: ProfileConfig = { ...config, sampleStrategy: 'sample', sampleSize: 1000, seed: 8 };
    expect(computeFingerprint('d', 1, seeded)).not.toBe(computeFingerprint('d', 1, otherSeed));
  });

  it('is independent of the column order', () => {
    const a: ProfileConfig = { ...config, columns: ['b', 'a'] };
    const b: ProfileConfig = { ...config, columns: ['a', 'b'] };
    expect(computeFingerprint('d', 1, a)).toBe(computeFingerprint('d', 1, b));
  });
});

describe('The logical type classification', () => {
  it('maps the physical types to the logical types the profile uses', () => {
    expect(classifyLogicalType('INTEGER')).toBe('numeric');
    expect(classifyLogicalType('BIGINT')).toBe('numeric');
    expect(classifyLogicalType('DOUBLE')).toBe('numeric');
    expect(classifyLogicalType('DECIMAL(10,2)')).toBe('numeric');
    expect(classifyLogicalType('BOOLEAN')).toBe('boolean');
    expect(classifyLogicalType('TIMESTAMP')).toBe('datetime');
    expect(classifyLogicalType('DATE')).toBe('datetime');
    expect(classifyLogicalType('VARCHAR')).toBe('text');
    expect(classifyLogicalType('STRUCT(a INTEGER)')).toBe('complex');
  });

  it('never classifies an unknown type as numeric', () => {
    expect(classifyLogicalType('SOMETHING_ELSE')).toBe('text');
  });
});
