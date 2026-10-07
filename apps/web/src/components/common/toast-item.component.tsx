import { motion } from 'framer-motion';
import { cn } from '@/theme';
import type { EToastVariant, ToastMessage } from '@/store';

const VARIANT_BORDER: Readonly<Record<EToastVariant, string>> = {
  success: 'border-emerald-500/40',
  error: 'border-red-500/40',
  warning: 'border-amber-500/40',
  info: 'border-sky-500/40',
};

const VARIANT_DOT: Readonly<Record<EToastVariant, string>> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

export interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 32, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.96 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-xl border bg-white/90 p-3 shadow-2xl backdrop-blur-2xl',
        'dark:bg-slate-900/90',
        VARIANT_BORDER[toast.variant],
      )}
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
    >
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', VARIANT_DOT[toast.variant])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{toast.title}</p>
        {toast.description !== undefined ? (
          <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        ×
      </button>
    </motion.div>
  );
}