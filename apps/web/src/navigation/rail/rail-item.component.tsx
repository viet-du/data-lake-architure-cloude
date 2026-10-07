import { useTranslation } from 'react-i18next';
import { cn } from '@/theme';
import { Icon } from '@/components';
import { Tooltip } from '@/components';
import type { RailItemProps } from '@/navigation';

export function RailItem({ iconName, labelKey, active, onClick }: RailItemProps) {
  const { t } = useTranslation();
  const label = t(labelKey, { defaultValue: iconName });

  return (
    <Tooltip content={label} placement="right" delay={150}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex h-12 w-12 items-center justify-center rounded-xl',
          'transition-all duration-300',
          active
            ? 'bg-white/15 text-white shadow-lg shadow-primary-500/20'
            : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-100',
        )}
      >
        {active ? (
          <span
            className={cn(
              'absolute -left-2 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full',
              'bg-primary-500 shadow-md shadow-primary-500/50',
            )}
          />
        ) : null}
        <Icon
          name={iconName}
          size={24}
          tone={active ? 'colored' : 'mono'}
          className={cn(
            'transition-transform duration-300',
            active ? 'scale-110 drop-shadow-[0_0_6px_rgba(99,102,241,0.6)]' : 'group-hover:scale-110',
          )}
        />
        <span
          className={cn(
            'pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md',
            'bg-neutral-900/95 px-2.5 py-1 text-xs font-medium text-white',
            'opacity-0 -translate-x-1 transition-all duration-200',
            'group-hover:opacity-100 group-hover:translate-x-0',
            'lg:hidden',
          )}
        >
          {label}
        </span>
      </button>
    </Tooltip>
  );
}
