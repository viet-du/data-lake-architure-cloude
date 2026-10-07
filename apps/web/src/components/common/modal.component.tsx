import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/theme';

export type EModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Readonly<Record<EModalSize, string>> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: EModalSize;
  closeOnBackdrop?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const BACKDROP_INITIAL = { opacity: 0 };
const BACKDROP_ANIMATE = { opacity: 1 };
const BACKDROP_EXIT = { opacity: 0 };
const PANEL_INITIAL = { opacity: 0, scale: 0.96, y: 8 };
const PANEL_ANIMATE = { opacity: 1, scale: 1, y: 0 };
const PANEL_EXIT = { opacity: 0, scale: 0.96, y: 8 };
const TRANSITION = { duration: 0.18, ease: 'easeOut' as const };

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  footer,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={BACKDROP_INITIAL}
          animate={BACKDROP_ANIMATE}
          exit={BACKDROP_EXIT}
          transition={TRANSITION}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (closeOnBackdrop) onClose();
          }}
        >
          <motion.div
            initial={PANEL_INITIAL}
            animate={PANEL_ANIMATE}
            exit={PANEL_EXIT}
            transition={TRANSITION}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className={cn(
              'flex w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/95 shadow-2xl backdrop-blur-2xl',
              'dark:bg-slate-900/95',
              SIZE_MAP[size],
              className,
            )}
          >
            {title !== undefined || description !== undefined ? (
              <div className="flex items-start justify-between border-b border-white/10 p-4">
                <div className="min-w-0 flex-1">
                  {title !== undefined ? (
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                      {title}
                    </h2>
                  ) : null}
                  {description !== undefined ? (
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-2 rounded-md p-1 text-neutral-500 hover:bg-white/10 hover:text-neutral-900 dark:hover:text-neutral-100"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            ) : null}
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
            {footer !== undefined ? (
              <div className="flex items-center justify-end gap-2 border-t border-white/10 p-3">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
