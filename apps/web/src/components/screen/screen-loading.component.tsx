import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components';

export interface ScreenLoadingProps {
  rows?: number;
  variant?: 'list' | 'grid';
  className?: string;
}

export function ScreenLoading({ rows = 6, variant = 'list', className }: ScreenLoadingProps) {
  const { t } = useTranslation();
  if (variant === 'grid') {
    return (
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className ?? ''}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} shape="rect" height={120} className="rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('common.loading')}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} shape="rect" height={48} className="rounded-lg" />
      ))}
    </div>
  );
}
