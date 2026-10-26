import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, SearchInput, Tag } from '@/components';
import { cn } from '@/theme';
import type {
  EColumnProfile,
  ELogicalType,
  EProfileListResult,
} from '@/types/entities';
import { EdaColumnCard } from './eda-column-card.component';
import {
  PROFILE_STATUS_LABEL_KEY,
  PROFILE_STATUS_VARIANT,
  formatCount,
  formatTime,
} from './eda.helpers';

/**
 * The profile library.
 *
 * It lists the stored profiles and, for the selected profile, the columns
 * with their measured statistics. The column filter is *client-side* over an
 * already-computed profile — the browser never triggers a new scan.
 */

export interface EdaProfileLibraryProps {
  /** The stored profiles. */
  profiles: EProfileListResult | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  /** The selected profile id. */
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  /** The columns of the selected profile. */
  columns: ReadonlyArray<EColumnProfile> | undefined;
  isColumnsLoading: boolean;
  onProposeRule?: (column: EColumnProfile) => void;
  onCompare?: (profileId: string) => void;
  className?: string;
}

const LOGICAL_FILTERS: ReadonlyArray<ELogicalType | 'all'> = [
  'all',
  'numeric',
  'categorical',
  'datetime',
  'boolean',
  'text',
  'complex',
];

export function EdaProfileLibrary({
  profiles,
  isLoading,
  isError,
  error,
  onRetry,
  selectedProfileId,
  onSelectProfile,
  columns,
  isColumnsLoading,
  onProposeRule,
  onCompare,
  className,
}: EdaProfileLibraryProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [logicalFilter, setLogicalFilter] = useState<ELogicalType | 'all'>('all');

  const items = profiles?.profiles ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (columns ?? []).filter((column) => {
      if (logicalFilter !== 'all' && column.logicalType !== logicalFilter) return false;
      if (needle === '') return true;
      return column.name.toLowerCase().includes(needle);
    });
  }, [columns, search, logicalFilter]);

  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]', className)}>
      <aside className="flex flex-col gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {t('eda.library.title')}
        </p>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-white/5" />
        ) : isError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-500">
            {error?.message ?? t('common.error')}
            {onRetry !== undefined ? (
              <button type="button" onClick={onRetry} className="ml-2 underline">
                {t('common.retry')}
              </button>
            ) : null}
          </div>
        ) : items.length === 0 ? (
          <EmptyState compact title={t('eda.library.empty')} />
        ) : (
          <div className="flex max-h-[28rem] flex-col gap-1.5 overflow-y-auto pr-1">
            {items.map((profile) => {
              const active = profile.profileId === selectedProfileId;
              return (
                <button
                  key={profile.profileId}
                  type="button"
                  onClick={() => onSelectProfile(profile.profileId)}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-2 text-left transition-colors',
                    active
                      ? 'border-primary-500/50 bg-primary-500/10'
                      : 'border-white/5 bg-white/5 hover:bg-white/10',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[10px] text-neutral-700 dark:text-neutral-200">
                      {profile.datasetId}
                    </span>
                    <Tag size="sm" variant={PROFILE_STATUS_VARIANT[profile.status]}>
                      {t(PROFILE_STATUS_LABEL_KEY[profile.status])}
                    </Tag>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-neutral-500">
                    <span>
                      {t('eda.library.rows')}: {formatCount(profile.rowCount)}
                    </span>
                    <span>
                      {t('eda.library.columns')}: {profile.columnCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-neutral-500">
                    <span>{formatTime(profile.computedAt ?? profile.createdAt)}</span>
                    {profile.alerts > 0 ? (
                      <span className="text-amber-500">
                        {t('eda.library.alerts', { count: profile.alerts })}
                      </span>
                    ) : null}
                  </div>
                  {onCompare !== undefined ? (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        onCompare(profile.profileId);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          onCompare(profile.profileId);
                        }
                      }}
                      className="self-start rounded px-1 text-[9px] text-primary-600 hover:bg-white/10 dark:text-primary-300"
                    >
                      {t('eda.compare')}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('eda.library.search')}
            className="w-64"
          />
          <div className="flex flex-wrap gap-1">
            {LOGICAL_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setLogicalFilter(filter)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[9px] font-medium transition-colors',
                  logicalFilter === filter
                    ? 'border-primary-500/40 bg-primary-500/15 text-primary-600 dark:text-primary-300'
                    : 'border-white/10 bg-white/5 text-neutral-500 hover:bg-white/10',
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {isColumnsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-40 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            compact
            title={
              (columns ?? []).length === 0
                ? t('eda.library.noColumns')
                : t('eda.library.noMatch')
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((column) => {
              const total = Number(column.nonNullCount) + Number(column.nullCount);
              const missingRatio = total > 0 ? Number(column.nullCount) / total : 0;
              return (
                <EdaColumnCard
                  key={column.name}
                  column={column}
                  missingRatio={missingRatio}
                  {...(onProposeRule !== undefined
                    ? { onProposeRule: () => onProposeRule(column) }
                    : {})}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
