import { type FC } from 'react';
import { cn } from '@/theme';

export type EProgressVariant = 'primary' | 'bronze' | 'silver' | 'gold' | 'kafka' | 'airflow' | 'dq' | 'crawler' | 'health' | 'success' | 'danger';

export interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: EProgressVariant;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const VARIANT_BAR: Readonly<Record<EProgressVariant, string>> = {
  primary: 'bg-primary-500',
  bronze: 'bg-amber-500',
  silver: 'bg-slate-400',
  gold: 'bg-yellow-400',
  kafka: 'bg-rose-500',
  airflow: 'bg-sky-500',
  dq: 'bg-emerald-500',
  crawler: 'bg-violet-500',
  health: 'bg-green-500',
  success: 'bg-emerald-500',
  danger: 'bg-red-500',
};

const SIZE_TRACK: Readonly<Record<NonNullable<ProgressBarProps['size']>, string>> = {
  sm: 'h-1',
  md: 'h-1.5',
};

const SIZE_LABEL: Readonly<Record<NonNullable<ProgressBarProps['size']>, string>> = {
  sm: 'text-[10px]',
  md: 'text-xs',
};

function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  const ratio = (value / max) * 100;
  if (ratio < 0) return 0;
  if (ratio > 100) return 100;
  return ratio;
}

export const ProgressBar: FC<ProgressBarProps> = ({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel = false,
  className,
}) => {
  const percent = normalize(value, max);

  return (
    <div className={cn('w-full', className)}>
      {showLabel ? (
        <div className={cn('mb-1 flex items-center justify-between font-medium text-neutral-500 dark:text-neutral-400', SIZE_LABEL[size])}>
          <span>Progress</span>
          <span className="tabular-nums">{Math.round(percent)}%</span>
        </div>
      ) : null}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-white/10 dark:bg-white/5',
          SIZE_TRACK[size],
        )}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', VARIANT_BAR[variant])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;