import { useTranslation } from 'react-i18next';
import { QuickStatCard } from './quick-stat-card.component';
import type { HomeQuickStat } from './home.types';

export interface QuickStatsGridProps {
  stats: ReadonlyArray<HomeQuickStat>;
}

export function QuickStatsGrid({ stats }: QuickStatsGridProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-black dark:text-white">
          {t('home.quick_stats')}
        </h3>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {stats.map((stat) => (
          <QuickStatCard key={stat.key} stat={stat} />
        ))}
      </div>
    </div>
  );
}
