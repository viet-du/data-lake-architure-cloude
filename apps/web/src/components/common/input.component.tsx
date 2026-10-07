import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/theme';

export type EInputSize = 'sm' | 'md' | 'lg';
export type EInputVariant = 'default' | 'search';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: EInputSize;
  variant?: EInputVariant;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: boolean;
  fullWidth?: boolean;
}

const SIZE_CLASSES: Readonly<Record<EInputSize, string>> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    inputSize = 'md',
    variant = 'default',
    leftIcon,
    rightIcon,
    error = false,
    fullWidth = true,
    className,
    type = 'text',
    ...rest
  },
  ref,
) {
  const hasLeftIcon = leftIcon !== undefined || variant === 'search';

  return (
    <div className={cn('relative', fullWidth && 'w-full')}>
      {hasLeftIcon ? (
        <span
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 flex items-center text-neutral-400 dark:text-neutral-500',
            inputSize === 'sm' ? 'pl-2.5' : inputSize === 'md' ? 'pl-3' : 'pl-4',
          )}
        >
          {leftIcon}
        </span>
      ) : null}
      <input
        ref={ref}
        type={type}
        className={cn(
          'w-full rounded-lg border bg-white/5 backdrop-blur-md text-neutral-900 dark:text-neutral-50',
          'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary-400/50 focus:border-primary-400/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50'
            : 'border-white/10 dark:border-white/10',
          SIZE_CLASSES[inputSize],
          hasLeftIcon && (inputSize === 'sm' ? 'pl-8' : inputSize === 'md' ? 'pl-10' : 'pl-12'),
          rightIcon && (inputSize === 'sm' ? 'pr-8' : inputSize === 'md' ? 'pr-10' : 'pr-12'),
          className,
        )}
        {...rest}
      />
      {rightIcon ? (
        <span
          className={cn(
            'absolute inset-y-0 right-0 flex items-center text-neutral-400 dark:text-neutral-500',
            inputSize === 'sm' ? 'pr-2.5' : inputSize === 'md' ? 'pr-3' : 'pr-4',
          )}
        >
          {rightIcon}
        </span>
      ) : null}
    </div>
  );
});
