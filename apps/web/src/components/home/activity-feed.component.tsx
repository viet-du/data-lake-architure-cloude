import { useTranslation } from 'react-i18next';
import { GlassCard, EmptyState } from '@/components';
import { ActivityItem } from './activity-item.component';
import type { HomeActivityEventItem } from './home.types';

export interface ActivityFeedProps {
  items: ReadonlyArray<HomeActivityEventItem>;
  /** True when the feed could not be read completely. */
  partial?: boolean;
  /** True while the first page is loading. */
  loading?: boolean;
  /** The cursor of the next page, when more events exist. */
  nextCursor?: string | null;
  /** Load the next page of events. */
  onLoadMore?: () => void;
}

export function ActivityFeed({
  items,
  partial = false,
  loading = false,
  nextCursor = null,
  onLoadMore,
}: ActivityFeedProps) {
  const { t } = useTranslation();
  return (
    <GlassCard elevation={2} className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-black dark:text-white">
          {t('home.activity')}
        </h3>
        <span className="text-[10px] text-black dark:text-white">
          {t('home.events', { count: items.length })}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          loading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex h-full items-center justify-center text-xs text-black dark:text-white"
            >
              {t('common.loading')}
            </div>
          ) : (
            <EmptyState compact title={t('home.no_activity')} className="h-full" />
          )
        ) : (
          <div className="flex flex-col gap-0.5">
            {items.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
      {partial ? (
        <p role="status" className="mt-2 px-1 text-[10px] text-amber-600 dark:text-amber-400">
          {t('home.activity_partial')}
        </p>
      ) : null}
      {nextCursor && onLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-black transition-colors hover:bg-white/5 disabled:opacity-50 dark:text-white"
        >
          {loading ? t('common.loading') : t('home.activity_load_more')}
        </button>
      ) : null}
    </GlassCard>
  );
}
