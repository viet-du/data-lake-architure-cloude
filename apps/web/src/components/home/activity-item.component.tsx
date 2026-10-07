import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components';
import { cn } from '@/theme';
import type { HomeActivityItem } from './home.types';

const STATUS_DOT: Readonly<Record<HomeActivityItem['status'], string>> = {
  success: 'bg-emerald-500',
  failed: 'bg-red-500',
  running: 'bg-sky-500 animate-pulse',
  info: 'bg-neutral-400',
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

export interface ActivityItemProps {
  item: HomeActivityItem;
}

export function ActivityItem({ item }: ActivityItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(item.path)}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg p-2 text-left',
        'transition-colors duration-200',
        'hover:bg-white/5',
      )}
    >
      <div className="relative shrink-0">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            'bg-white/10 ring-1 ring-white/10',
          )}
        >
          <Icon name={item.iconName} size={18} />
        </div>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-neutral-950',
            STATUS_DOT[item.status],
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-black dark:text-white">
          {t(item.titleKey)}
        </p>
        <p className="text-[10px] text-black dark:text-white">{t(`nav.${item.moduleKey}`)}</p>
      </div>
      <span className="shrink-0 text-[10px] text-black dark:text-white">
        {formatRelative(item.timestamp)}
      </span>
    </button>
  );
}
