import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/theme';

export type EButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type EButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: EButtonVariant;
  size?: EButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Readonly<Record<EButtonVariant, string>> = {
  primary:
    'bg-primary-500/90 hover:bg-primary-500 text-white border-primary-400/50 shadow-lg shadow-primary-500/20',
  secondary:
    'bg-white/10 hover:bg-white/20 text-neutral-900 dark:text-neutral-50 border-white/20 backdrop-blur-md',
  ghost:
    'bg-transparent hover:bg-white/10 text-neutral-700 dark:text-neutral-200 border-transparent',
  danger:
    'bg-red-500/90 hover:bg-red-500 text-white border-red-400/50 shadow-lg shadow-red-500/20',
};

const SIZE_CLASSES: Readonly<Record<EButtonSize, string>> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border font-medium',
        'transition-all duration-200 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'active:scale-[0.98]',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
