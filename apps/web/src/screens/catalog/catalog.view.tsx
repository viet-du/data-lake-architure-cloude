import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabasesQuery, useCatalogTablesQuery } from '@/services/queries';
import {
  GlassCard,
  Tag,
  Skeleton,
  EmptyState,
  ErrorBoundary,
  ScreenPageHeader,
  ScreenSection,
  ScreenLoading,
  ScreenError,
} from '@/components';
import { useThemeStore } from '@/store';
import { cn } from '@/theme';
import type { DatabaseEntity } from '@/types/entities';

const LAYER_COLOR: Readonly<Record<DatabaseEntity['layer'], { dot: string; labelKey: string }>> = {
  bronze: { dot: 'bg-amber-500', labelKey: 'nav.bronze' },
  silver: { dot: 'bg-slate-400', labelKey: 'nav.silver' },
  gold: { dot: 'bg-yellow-400', labelKey: 'nav.gold' },
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function DatabaseListItem({
  database,
  active,
  onClick,
}: {
  database: DatabaseEntity;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const layerInfo = LAYER_COLOR[database.layer];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full flex-col gap-2 rounded-lg p-3 text-left',
        'border transition-all duration-200',
        active
          ? 'border-primary-500/50 bg-primary-500/10'
          : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', layerInfo.dot)} />
          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {database.name}
          </span>
        </div>
        <Tag size="sm" variant="neutral">
          {t(layerInfo.labelKey)}
        </Tag>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>{database.tableCount} {t('screens.catalog.tables').toLowerCase()}</span>
        <span className="h-1 w-1 rounded-full bg-neutral-400" />
        <span>{formatBytes(database.tableCount * 1_000_000)}</span>
      </div>
    </button>
  );
}

function TableList({ databaseName }: { databaseName: string }) {
  const { t } = useTranslation();
  const tablesQuery = useCatalogTablesQuery({ database: databaseName, pageSize: 50 });

  if (tablesQuery.isLoading) return <ScreenLoading rows={5} />;
  if (tablesQuery.isError) {
    return <ScreenError error={tablesQuery.error} onRetry={() => void tablesQuery.refetch()} compact />;
  }
  const items = (tablesQuery.data as { items?: ReadonlyArray<{ name: string; format: string; sizeBytes: number; rowCount: number; updatedAt: string }> } | undefined)?.items ?? [];

  if (items.length === 0) {
    return <EmptyState compact title={t('common.loading')} />;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="px-3 py-2 font-medium">{t('screens.catalog.table_name')}</th>
            <th className="px-3 py-2 font-medium">{t('screens.catalog.format')}</th>
            <th className="px-3 py-2 font-medium text-right">{t('screens.catalog.size')}</th>
            <th className="px-3 py-2 font-medium text-right">{t('screens.catalog.rows')}</th>
            <th className="px-3 py-2 font-medium">{t('screens.catalog.updated')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((table) => (
            <tr
              key={table.name}
              className="border-b border-white/5 transition-colors hover:bg-white/5"
            >
              <td className="px-3 py-2 font-medium text-neutral-900 dark:text-neutral-50">
                {table.name}
              </td>
              <td className="px-3 py-2">
                <Tag size="sm" variant="primary">
                  {table.format}
                </Tag>
              </td>
              <td className="px-3 py-2 text-right text-neutral-500 dark:text-neutral-400">
                {formatBytes(table.sizeBytes)}
              </td>
              <td className="px-3 py-2 text-right text-neutral-500 dark:text-neutral-400">
                {formatNumber(table.rowCount)}
              </td>
              <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400">
                {new Date(table.updatedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DatabasePanel() {
  const { t } = useTranslation();
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const databasesQuery = useDatabasesQuery();
  const [selected, setSelected] = useState<string | null>(null);
  const isDark = resolvedMode === 'dark';

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-3">
      <ScreenSection
        title={t('screens.catalog.databases')}
        description={`${databasesQuery.data?.length ?? 0} databases`}
        padded={false}
        className="lg:col-span-1"
      >
        <div className="p-3">
          {databasesQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} shape="rect" height={64} className="rounded-lg" />
              ))}
            </div>
          ) : databasesQuery.isError ? (
            <ScreenError error={databasesQuery.error} onRetry={() => void databasesQuery.refetch()} compact />
          ) : (databasesQuery.data?.length ?? 0) === 0 ? (
            <EmptyState compact title="No databases" />
          ) : (
            <div className="flex flex-col gap-2">
              {databasesQuery.data?.map((db) => (
                <DatabaseListItem
                  key={db.id}
                  database={db}
                  active={selected === db.name}
                  onClick={() => setSelected(db.name)}
                />
              ))}
            </div>
          )}
        </div>
      </ScreenSection>

      <ScreenSection
        title={selected !== null ? t('screens.catalog.tables_in', { name: selected }) : t('screens.catalog.tables')}
        description={selected !== null ? `${(databasesQuery.data ?? []).find((d) => d.name === selected)?.tableCount ?? 0} tables` : undefined}
        padded={false}
        className="lg:col-span-2"
      >
        {selected !== null ? (
          <TableList databaseName={selected} />
        ) : (
          <div
            className={cn(
              'flex h-full items-center justify-center p-12 text-center text-sm',
              isDark ? 'text-neutral-500' : 'text-neutral-400',
            )}
          >
            <GlassCard elevation={0} className="max-w-md border-dashed p-8">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Select a database from the left to inspect its tables, schema and sample data.
              </p>
            </GlassCard>
          </div>
        )}
      </ScreenSection>
    </div>
  );
}

export function CatalogView() {
  return (
    <ErrorBoundary>
      <div className="flex h-full flex-col gap-4">
        <ScreenPageHeader
          iconName="HiveMetastore"
          titleKey="screens.catalog.title"
          subtitleKey="screens.catalog.subtitle"
          descriptionKey="screens.catalog.description"
          accent="primary"
        />
        <div className="flex-1 overflow-hidden">
          <DatabasePanel />
        </div>
      </div>
    </ErrorBoundary>
  );
}
