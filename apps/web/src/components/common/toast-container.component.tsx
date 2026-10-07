import { AnimatePresence } from 'framer-motion';
import { cn } from '@/theme';
import { useToastStore } from '@/store';
import { ToastItem } from './toast-item.component';

export interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

export function ToastContainer({ position = 'top-right', className }: ToastContainerProps) {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'pointer-events-none fixed z-50 flex flex-col gap-2',
        position === 'top-right' && 'right-4 top-4',
        position === 'top-left' && 'left-4 top-4',
        position === 'bottom-right' && 'bottom-4 right-4',
        position === 'bottom-left' && 'bottom-4 left-4',
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}