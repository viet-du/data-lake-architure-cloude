import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/theme';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, className, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-y rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-50',
        'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
        'focus:outline-none focus:ring-2 focus:ring-primary-400/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error
          ? 'border-red-400/50'
          : 'border-white/10 dark:border-white/10',
        className,
      )}
      {...rest}
    />
  ),
);

Textarea.displayName = 'Textarea';
