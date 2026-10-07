import { type ReactNode } from 'react';
import { cn } from '@/theme';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
      >
        {label}
        {required === true ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {error !== undefined ? (
        <p className="text-[10px] text-red-500">{error}</p>
      ) : hint !== undefined ? (
        <p className="text-[10px] text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}
