import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, Tag } from '@/components/common';
import { SearchInput } from '@/components/form';
import { cn } from '@/theme';
import {
  useCatalogTableSchemaQuery,
  useCatalogTablesQuery,
} from '@/services/queries';
import type { EMedallionLayer } from '@/types/entities';

/**
 * The dataset picker.
 *
 * The whole point of this component is that **the user never types an
 * identifier**. The earlier forms asked for a dataset id, a table name or a
 * column name in a free-text field, which meant the user had to already
 * know the exact `database.table` spelling and the exact column names of
 * the dataset before the form could even be filled in. A wrong guess was
 * silently accepted and only failed later, on the server.
 *
 * This picker inverts that: the user picks a *layer*, clicks the dataset
 * they can see, and then clicks the column they want. Every value is
 * resolved from the catalog, so whatever is on screen is exactly what the
 * server will receive.
 *
 * The three levels are deliberately progressive:
 *
 *   layer → dataset → column
 *
 * The column level only appears once a dataset is selected, because the
 * column list is read from *that* dataset's schema.
 */

const LAYERS: ReadonlyArray<EMedallionLayer> = ['bronze', 'silver', 'gold'];

const LAYER_VARIANT: Readonly<Record<EMedallionLayer, 'warning' | 'info' | 'primary'>> = {
  bronze: 'warning',
  silver: 'info',
  gold: 'primary',
};

export interface DatasetPickerValue {
  /** The full dataset id, e.g. `workspace.bronze.customers`. */
  tableId: string;
  /** The database the dataset belongs to. */
  database: string;
  /** The bare table name. */
  table: string;
  /** The medallion layer. */
  layer: EMedallionLayer;
}

export interface DatasetPickerProps {
  /** The selected dataset. `null` when nothing is selected yet. */
  value: DatasetPickerValue | null;
  /** Called whenever the user picks (or unpicks) a dataset. */
  onChange: (value: DatasetPickerValue | null) => void;
  /** Called when a dataset is selected and its columns become known. */
  onColumnsChange?: (columns: ReadonlyArray<{ name: string; type: string }>) => void;
  /**
   * When set, the user also picks a column. The column list is rendered
   * as toggleable chips and the chosen column is reported through
   * `onColumnChange`.
   */
  withColumn?: boolean;
  /** The currently selected column name. */
  column?: string | null;
  /** Called when the selected column changes. */
  onColumnChange?: (column: string | null) => void;
  /** The layer the picker starts on. */
  defaultLayer?: EMedallionLayer;
  /**
   * Called when the user switches the layer. The picker owns the layer
   * state, so a parent that needs the layer (e.g. the DQ preset wizard,
   * which sends it to the server) has to be told about the change.
   */
  onLayerChange?: (layer: EMedallionLayer) => void;
  /** Disable the whole picker. */
  disabled?: boolean;
  className?: string;
}

export function DatasetPicker({
  value,
  onChange,
  onColumnsChange,
  withColumn = false,
  column = null,
  onColumnChange,
  defaultLayer = 'bronze',
  onLayerChange,
  disabled = false,
  className,
}: DatasetPickerProps) {
  const { t } = useTranslation();
  const [layer, setLayer] = useState<EMedallionLayer>(defaultLayer);
  const [search, setSearch] = useState('');

  const tablesQuery = useCatalogTablesQuery(
    useMemo(() => ({ layer, pageSize: 100, ...(search === '' ? {} : { search }) }), [layer, search]),
  );

  const tables = useMemo(() => tablesQuery.data?.items ?? [], [tablesQuery.data]);

  // The schema is only known for the selected dataset, so the column query
  // is keyed on the selected id. `useCatalogTableSchemaQuery` is disabled
  // for an empty id, which is exactly the "nothing selected" state.
  const schemaQuery = useCatalogTableSchemaQuery(value?.tableId ?? '');

  const columns = useMemo(() => {
    const raw = schemaQuery.data as
      | ReadonlyArray<{ name: string; type: string; nullable?: boolean }>
      | { columns?: ReadonlyArray<{ name: string; type: string; nullable?: boolean }> }
      | undefined;
    // The catalog endpoint answers with `{ tableId, columns }`, but the
    // service layer already unwraps it to the plain column array. Both
    // shapes are accepted here so the picker keeps working whichever one
    // the service returns.
    if (raw === undefined) return [];
    // `Array.isArray` does not narrow a `ReadonlyArray`, so an explicit
    // guard tells the compiler which of the two shapes it is looking at.
    const isColumnList = (
      value: typeof raw,
    ): value is ReadonlyArray<{ name: string; type: string; nullable?: boolean }> =>
      Array.isArray(value);
    return isColumnList(raw) ? raw : (raw.columns ?? []);
  }, [schemaQuery.data]);

  // Report the resolved columns upward so the caller can show them and so
  // it never has to query the schema a second time.
  useEffect(() => {
    if (onColumnsChange === undefined) return;
    onColumnsChange(columns);
  }, [columns, onColumnsChange]);

  // Switching the layer invalidates the current dataset: the selection
  // belongs to a layer and must not survive a layer change.
  useEffect(() => {
    setSearch('');
    if (value !== null && value.layer !== layer) {
      onChange(null);
      onColumnChange?.(null);
    }
    // `value` is intentionally not a dependency: including it would reset
    // the selection on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer]);

  function selectTable(tableId: string): void {
    const table = tables.find((item) => item.id === tableId);
    if (table === undefined) return;
    onChange({
      tableId: table.id,
      database: table.databaseName,
      table: table.name,
      layer,
    });
    // A column of the previous dataset is meaningless for the new one.
    onColumnChange?.(null);
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* ---- Level 1: the layer ---- */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {t('datasetPicker.layer')}
        </span>
        {LAYERS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            disabled={disabled}
            onClick={() => {
              setLayer(candidate);
              onLayerChange?.(candidate);
            }}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors disabled:opacity-50',
              layer === candidate
                ? 'border-primary-500/40 bg-primary-500/15 text-primary-600 dark:text-primary-300'
                : 'border-white/10 bg-white/5 text-neutral-500 hover:bg-white/10',
            )}
          >
            {candidate}
          </button>
        ))}
      </div>

      {/* ---- Level 2: the dataset ---- */}
      <div className="flex flex-col gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('datasetPicker.searchPlaceholder')}
          className="w-full"
        />

        {tablesQuery.isLoading ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : tablesQuery.isError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-500">
            {tablesQuery.error.message}
          </div>
        ) : tables.length === 0 ? (
          <EmptyState compact title={t('datasetPicker.noTables')} />
        ) : (
          <div className="flex max-h-52 flex-col gap-1 overflow-y-auto pr-1">
            {tables.map((table) => {
              const active = value?.tableId === table.id;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectTable(table.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border p-2 text-left transition-colors disabled:opacity-50',
                    active
                      ? 'border-primary-500/50 bg-primary-500/10'
                      : 'border-white/5 bg-white/5 hover:bg-white/10',
                  )}
                >
                  <span className="min-w-0 truncate font-mono text-[11px] text-neutral-800 dark:text-neutral-100">
                    {table.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {table.layer !== null ? (
                      <Tag size="sm" variant={LAYER_VARIANT[table.layer]}>
                        {table.layer}
                      </Tag>
                    ) : null}
                    <span className="text-[9px] text-neutral-500">{table.databaseName}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Level 3: the column ---- */}
      {withColumn && value !== null ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {t('datasetPicker.column')}
          </span>
          {schemaQuery.isLoading ? (
            <div className="h-9 animate-pulse rounded-lg bg-white/5" />
          ) : schemaQuery.isError ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-500">
              {schemaQuery.error.message}
            </div>
          ) : columns.length === 0 ? (
            <EmptyState compact title={t('datasetPicker.noColumns')} />
          ) : (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {columns.map((col) => {
                const active = column === col.name;
                return (
                  <button
                    key={col.name}
                    type="button"
                    disabled={disabled}
                    onClick={() => onColumnChange?.(active ? null : col.name)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors disabled:opacity-50',
                      active
                        ? 'border-primary-500/50 bg-primary-500/15 text-primary-600 dark:text-primary-300'
                        : 'border-white/10 bg-white/5 text-neutral-500 hover:bg-white/10',
                    )}
                  >
                    {col.name}
                    {col.type !== '' ? (
                      <span className="ml-1 text-[9px] opacity-70">{col.type}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
