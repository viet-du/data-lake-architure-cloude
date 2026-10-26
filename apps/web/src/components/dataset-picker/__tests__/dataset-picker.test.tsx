import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatasetPicker, type DatasetPickerValue } from '../dataset-picker.component';

/**
 * The dataset picker replaces the free-text "table id" / "column name"
 * fields that used to make the EDA, DQ and ingest forms unusable.
 *
 * These tests pin the behaviour that matters for the user:
 *   - the dataset is *clicked*, never typed;
 *   - the value reported to the caller is the resolved catalog id;
 *   - the column list comes from the selected dataset's schema;
 *   - switching the layer clears a selection that belongs to another layer.
 */

const tables = [
  {
    id: 'lakehouse.bronze.customers',
    databaseId: 'lakehouse',
    databaseName: 'lakehouse',
    name: 'customers',
    format: 'delta',
    layer: 'bronze' as const,
    sizeBytes: 1024,
    rowCount: 10,
    updatedAt: null,
  },
  {
    id: 'lakehouse.silver.customers_clean',
    databaseId: 'lakehouse',
    databaseName: 'lakehouse',
    name: 'customers_clean',
    format: 'delta',
    layer: 'silver' as const,
    sizeBytes: 2048,
    rowCount: 10,
    updatedAt: null,
  },
];

const columns = [
  { name: 'customer_id', type: 'BIGINT', nullable: false },
  { name: 'email', type: 'VARCHAR', nullable: true },
];

const tablesQuery = {
  data: { items: tables, pagination: { page: 1, pageSize: 100, total: tables.length } },
  isLoading: false,
  isError: false,
  error: null,
};

const schemaQuery = {
  data: columns,
  isLoading: false,
  isError: false,
  error: null,
};

vi.mock('@/services/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/queries')>();
  return {
    ...actual,
    useCatalogTablesQuery: vi.fn(),
    useCatalogTableSchemaQuery: vi.fn(),
  };
});

import { useCatalogTablesQuery, useCatalogTableSchemaQuery } from '@/services/queries';

const mockedTables = vi.mocked(useCatalogTablesQuery);
const mockedSchema = vi.mocked(useCatalogTableSchemaQuery);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPicker(props: Partial<React.ComponentProps<typeof DatasetPicker>> = {}) {
  const onChange = vi.fn();
  const onColumnChange = vi.fn();
  const onColumnsChange = vi.fn();
  const onLayerChange = vi.fn();
  const utils = render(
    <DatasetPicker
      value={null}
      onChange={onChange}
      onColumnChange={onColumnChange}
      onColumnsChange={onColumnsChange}
      onLayerChange={onLayerChange}
      {...props}
    />,
  );
  return { onChange, onColumnChange, onColumnsChange, onLayerChange, ...utils };
}

const selectedBronze = {
  tableId: 'lakehouse.bronze.customers',
  database: 'lakehouse',
  table: 'customers',
  layer: 'bronze' as const,
};

describe('DatasetPicker', () => {
  it('lists the datasets of the selected layer', () => {
    mockedTables.mockReturnValue(tablesQuery as never);
    mockedSchema.mockReturnValue(schemaQuery as never);

    renderPicker();

    expect(screen.getByText('customers')).toBeInTheDocument();
    expect(screen.getByText('customers_clean')).toBeInTheDocument();
  });

  it('reports the resolved catalog id when a dataset is clicked', () => {
    mockedTables.mockReturnValue(tablesQuery as never);
    mockedSchema.mockReturnValue(schemaQuery as never);

    const { onChange } = renderPicker();
    fireEvent.click(screen.getByText('customers'));

    const expected: DatasetPickerValue = {
      tableId: 'lakehouse.bronze.customers',
      database: 'lakehouse',
      table: 'customers',
      layer: 'bronze',
    };
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it('clears the previously picked column when another dataset is picked', () => {
    mockedTables.mockReturnValue(tablesQuery as never);
    mockedSchema.mockReturnValue(schemaQuery as never);

    const { onColumnChange } = renderPicker({ value: selectedBronze, withColumn: true, column: 'email' });

    fireEvent.click(screen.getByText('customers_clean'));
    expect(onColumnChange).toHaveBeenCalledWith(null);
  });

  it('shows the columns of the selected dataset and reports the picked one', () => {
    mockedTables.mockReturnValue(tablesQuery as never);
    mockedSchema.mockReturnValue(schemaQuery as never);

    const { onColumnChange } = renderPicker({ value: selectedBronze, withColumn: true });

    fireEvent.click(screen.getByRole('button', { name: /customer_id/ }));
    expect(onColumnChange).toHaveBeenCalledWith('customer_id');
  });

  it('reports the resolved columns to the caller', async () => {
    mockedTables.mockReturnValue(tablesQuery as never);
    mockedSchema.mockReturnValue(schemaQuery as never);

    const { onColumnsChange } = renderPicker({ value: selectedBronze, withColumn: true });

    await waitFor(() => {
      expect(onColumnsChange).toHaveBeenCalledWith(columns);
    });
  });

  it('reports a layer change to the parent', () => {
    mockedTables.mockReturnValue(tablesQuery as never);
    mockedSchema.mockReturnValue(schemaQuery as never);

    const { onLayerChange } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: 'silver' }));

    expect(onLayerChange).toHaveBeenCalledWith('silver');
  });

  it('clears the selection when the layer changes to another one', () => {
    mockedTables.mockReturnValue(tablesQuery as never);
    mockedSchema.mockReturnValue(schemaQuery as never);

    const { onChange } = renderPicker({ value: selectedBronze });

    fireEvent.click(screen.getByRole('button', { name: 'gold' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('surfaces the error instead of silently showing an empty list', () => {
    mockedTables.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('catalog unreachable'),
    } as never);
    mockedSchema.mockReturnValue(schemaQuery as never);

    renderPicker();

    expect(screen.getByText('catalog unreachable')).toBeInTheDocument();
  });
});
