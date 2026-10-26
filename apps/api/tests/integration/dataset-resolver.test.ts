import { describe, expect, it } from 'vitest';

import {
  activeProvider,
  assertReadable,
  assertWritable,
  canonicalStoragePath,
  canonicalTableId,
  layerRootPath,
  resolveDataset,
  resolveFromDatasetId,
} from '@/modules/datasets/types';
import { AppError } from '@/errors';

describe('P0-SRC-01 — Databricks catalog vs local MinIO resolver', () => {
  it('gives a local Delta dataset a distinct id and a local storage path', () => {
    const ref = resolveDataset({
      provider: 'local_delta_minio',
      layer: 'bronze',
      database: 'retail',
      table: 'orders',
    });

    expect(ref.provider).toBe('local_delta_minio');
    expect(ref.datasetId).toBe('local_delta_minio/bronze.retail.orders');
    expect(ref.storagePath).toBe('s3://lakehouse/bronze/retail/orders');
    expect(ref.dataAccessMode).toBe('read_write');
    expect(ref.capabilities.canTransform).toBe(true);
    expect(ref.capabilities.canAggregate).toBe(true);
  });

  it('gives a Databricks dataset a distinct id and no local storage path', () => {
    const ref = resolveDataset({
      provider: 'databricks_uc',
      layer: 'bronze',
      database: 'retail',
      table: 'orders',
    });

    expect(ref.provider).toBe('databricks_uc');
    expect(ref.datasetId).toBe('databricks_uc/bronze.retail.orders');
    expect(ref.storagePath).toBeUndefined();
    expect(ref.qualifiedName).toBe('workspace.bronze.orders');
    expect(ref.dataAccessMode).toBe('read');
  });

  it('never resolves a Databricks dataset to a MinIO path', () => {
    const databricks = resolveDataset({
      provider: 'databricks_uc',
      layer: 'silver',
      database: 'retail',
      table: 'customers',
    });
    const local = resolveDataset({
      provider: 'local_delta_minio',
      layer: 'silver',
      database: 'retail',
      table: 'customers',
    });

    expect(databricks.datasetId).not.toBe(local.datasetId);
    expect(databricks.storagePath).toBeUndefined();
    expect(local.storagePath).toBe('s3://lakehouse/silver/retail/customers');
  });

  it('refuses to write to a Databricks dataset (no cross-store accidental write)', () => {
    const ref = resolveDataset({
      provider: 'databricks_uc',
      layer: 'gold',
      database: 'retail',
      table: 'daily_revenue',
    });

    expect(() => assertWritable(ref, 'Aggregate')).toThrowError(AppError);
    try {
      assertWritable(ref, 'Aggregate');
      expect.unreachable('assertWritable must reject a Databricks dataset');
    } catch (error) {
      expect((error as AppError).status).toBe(409);
      expect((error as AppError).code).toBe('DATASET_NOT_WRITABLE');
    }
  });

  it('refuses to write to an uploaded fixture', () => {
    const ref = resolveDataset({
      provider: 'uploaded_fixture',
      layer: 'bronze',
      database: 'qa',
      table: 'orders',
    });

    expect(ref.dataAccessMode).toBe('read');
    expect(() => assertWritable(ref, 'Ingest')).toThrowError(/not permitted/);
  });

  it('allows a write to a local Delta dataset', () => {
    const ref = resolveDataset({
      provider: 'local_delta_minio',
      layer: 'silver',
      database: 'retail',
      table: 'customers',
    });

    expect(() => assertWritable(ref, 'Transform')).not.toThrow();
  });

  it('marks a Kafka topic as ingestable but not directly transformable', () => {
    const ref = resolveDataset({ provider: 'kafka_topic', kafkaTopic: 'orders.events' });

    expect(ref.provider).toBe('kafka_topic');
    expect(ref.datasetId).toBe('kafka_topic/orders.events');
    expect(ref.storagePath).toBeUndefined();
    expect(ref.capabilities.canIngest).toBe(true);
    expect(ref.capabilities.canTransform).toBe(false);
    expect(ref.capabilities.reasons.canTransform).toBeTruthy();
  });

  it('round-trips a dataset id back into the same reference', () => {
    const original = resolveDataset({
      provider: 'local_delta_minio',
      layer: 'gold',
      database: 'retail',
      table: 'daily_revenue',
    });
    const roundTrip = resolveFromDatasetId(original.datasetId);

    expect(roundTrip.datasetId).toBe(original.datasetId);
    expect(roundTrip.storagePath).toBe(original.storagePath);
    expect(roundTrip.provider).toBe(original.provider);
  });

  it('keeps the provider prefix when parsing a dataset id', () => {
    const databricks = resolveFromDatasetId('databricks_uc/workspace.gold.daily_revenue');

    expect(databricks.provider).toBe('databricks_uc');
    expect(databricks.dataAccessMode).toBe('read');
    expect(databricks.storagePath).toBeUndefined();
  });

  it('rejects an unknown provider instead of falling back to the local store', () => {
    expect(() => resolveFromDatasetId('s3_bucket/bronze.retail.orders')).toThrowError(
      /Unknown dataset provider/,
    );
  });

  it('rejects a path-traversal identifier', () => {
    expect(() =>
      resolveDataset({
        provider: 'local_delta_minio',
        layer: 'bronze',
        database: '../etc',
        table: 'orders',
      }),
    ).toThrowError(/Invalid database/);
    expect(() =>
      resolveDataset({
        provider: 'local_delta_minio',
        layer: 'bronze',
        database: 'retail',
        table: 'orders/../../etc',
      }),
    ).toThrowError(/Invalid table/);
  });

  it('rejects an incomplete dataset reference', () => {
    expect(() =>
      resolveDataset({ provider: 'local_delta_minio', layer: 'bronze', database: 'retail' }),
    ).toThrowError(/requires provider, layer, database and table/);
  });

  it('builds the canonical path with the same layout on both sides', () => {
    expect(canonicalStoragePath('bronze', 'retail', 'orders')).toBe(
      's3://lakehouse/bronze/retail/orders',
    );
    expect(canonicalTableId('silver', 'retail', 'customers')).toBe('silver.retail.customers');
    expect(layerRootPath('gold')).toBe('s3://lakehouse/gold');
  });

  it('exposes a deterministic active provider', () => {
    expect(['local_delta_minio', 'databricks_uc']).toContain(activeProvider());
  });

  it('keeps read access available for every provider', () => {
    const providers = [
      resolveDataset({
        provider: 'local_delta_minio',
        layer: 'bronze',
        database: 'retail',
        table: 'orders',
      }),
      resolveDataset({
        provider: 'databricks_uc',
        layer: 'bronze',
        database: 'retail',
        table: 'orders',
      }),
      resolveDataset({ provider: 'kafka_topic', kafkaTopic: 'orders.events' }),
      resolveDataset({
        provider: 'uploaded_fixture',
        layer: 'bronze',
        database: 'qa',
        table: 'orders',
      }),
    ];

    for (const ref of providers) {
      expect(() => assertReadable(ref, 'Read')).not.toThrow();
    }
  });
});
