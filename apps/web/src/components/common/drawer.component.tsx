import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/theme';

export type EDrawerSide = 'right' | 'left';
export type EDrawerSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_MAP: Readonly<Record<EDrawerSize, string>> = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[28rem]',
  xl: 'w-[40rem]',
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  side?: EDrawerSide;
  size?: EDrawerSize;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const TRANSITION = { duration: 0.22, ease: 'easeOut' as const };

export function Drawer({
  open,
  onClose,
  title,
  side = 'right',
  size = 'md',
  footer,
  children,
  className,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const xInitial = side === 'right' ? '100%' : '-100%';
  const xExit = side === 'right' ? '100%' : '-100%';

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TRANSITION}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: xInitial }}
            animate={{ x: 0 }}
            exit={{ x: xExit }}
            transition={TRANSITION}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className={cn(
              'absolute top-0 flex h-full flex-col border-white/10 bg-white/95 shadow-2xl backdrop-blur-2xl dark:bg-slate-900/95',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              SIZE_MAP[size],
              className,
            )}
          >
            {title !== undefined ? (
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md p-1 text-neutral-500 hover:bg-white/10 hover:text-neutral-900 dark:hover:text-neutral-100"
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
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
