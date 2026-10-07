import { useTranslation } from 'react-i18next';
import { GlassCard, EmptyState } from '@/components';
import { ActivityItem } from './activity-item.component';
import type { HomeActivityItem } from './home.types';

export interface ActivityFeedProps {
  items: ReadonlyArray<HomeActivityItem>;
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  const { t } = useTranslation();
  return (
    <GlassCard elevation={2} className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-black dark:text-white">
          {t('home.activity')}
        </h3>
        <span className="text-[10px] text-black dark:text-white">
          {items.length} {items.length === 1 ? 'event' : 'events'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <EmptyState
            compact
            title={t('home.no_activity')}
            className="h-full"
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            {items.map((item) => (
              <ActivityItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
