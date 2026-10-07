import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/theme';

export type ETooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  content: ReactNode;
  placement?: ETooltipPlacement;
  delay?: number;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
}

const PLACEMENT_CLASSES: Readonly<Record<ETooltipPlacement, string>> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
};

const ARROW_CLASSES: Readonly<Record<ETooltipPlacement, string>> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-neutral-900/95 border-x-transparent border-b-transparent',
  right:
    'right-full top-1/2 -translate-y-1/2 border-r-neutral-900/95 border-y-transparent border-l-transparent',
  bottom:
    'bottom-full left-1/2 -translate-x-1/2 border-b-neutral-900/95 border-x-transparent border-t-transparent',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-neutral-900/95 border-y-transparent border-r-transparent',
};

export function Tooltip({
  content,
  placement = 'top',
  delay = 200,
  className,
  children,
  disabled = false,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = (): void => {
    if (disabled) return;
    if (timer !== null) clearTimeout(timer);
    const t = setTimeout(() => setOpen(true), delay);
    setTimer(t);
  };

  const hide = (): void => {
    if (timer !== null) clearTimeout(timer);
    setOpen(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && !disabled ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-md',
            'bg-neutral-900/95 px-2.5 py-1.5 text-xs font-medium text-white shadow-xl',
            'backdrop-blur-sm',
            'animate-in fade-in zoom-in-95 duration-150',
            PLACEMENT_CLASSES[placement],
            className,
          )}
        >
          {content}
          <span
            className={cn(
              'absolute h-0 w-0 border-4',
              ARROW_CLASSES[placement],
            )}
          />
        </span>
      ) : null}
    </span>
  );
}
