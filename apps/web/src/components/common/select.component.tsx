import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/theme';

export type ESelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  selectSize?: ESelectSize;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string | undefined;
  fullWidth?: boolean | undefined;
}

const SIZE_CLASSES: Readonly<Record<ESelectSize, string>> = {
  sm: 'h-8 pl-3 pr-8 text-xs',
  md: 'h-10 pl-4 pr-10 text-sm',
  lg: 'h-12 pl-5 pr-12 text-base',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    selectSize = 'md',
    options,
    placeholder,
    fullWidth = true,
    className,
    ...rest
  },
  ref,
) {
  return (
    <div className={cn('relative', fullWidth && 'w-full')}>
      <select
        ref={ref}
        className={cn(
          'w-full appearance-none rounded-lg border bg-white/5 backdrop-blur-md text-neutral-900 dark:text-neutral-50',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'border-white/10',
          SIZE_CLASSES[selectSize],
          className,
        )}
        {...rest}
      >
        {placeholder !== undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled ?? false}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 flex items-center text-neutral-400 dark:text-neutral-500',
          selectSize === 'sm' ? 'pr-2.5' : selectSize === 'md' ? 'pr-3' : 'pr-4',
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  );
});
