import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '@/theme';

type TabsValue = string;

interface TabsContextValue {
  value: TabsValue;
  onValueChange: (v: TabsValue) => void;
  /** A stable id prefix used to wire `aria-controls` / `aria-labelledby`. */
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

/**
 * Read the tabs context, or throw a message that names the offending
 * component.
 *
 * The failure mode this guards against is real and already happened: a
 * screen rendered `<TabsList>` **outside** `<TabsRoot>`, so the context was
 * `null`, the hook threw, and the error boundary replaced the whole screen
 * with "Something went wrong". The message therefore names the component
 * that was misplaced and points at the fix.
 *
 * @param component The name of the subcomponent that called this hook.
 * @returns {TabsContextValue}
 */
function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (ctx === null) {
    throw new Error(
      `Tabs subcomponents must be used inside <Tabs>. ` +
        `<${component}> was rendered outside of <TabsRoot>. ` +
        `Move <TabsRoot> so that it wraps the tab bar and the tab panels.`,
    );
  }
  return ctx;
}

export interface TabsRootProps {
  value: TabsValue;
  onValueChange: (v: TabsValue) => void;
  children: ReactNode;
  className?: string;
}

export function TabsRoot({ value, onValueChange, children, className }: TabsRootProps) {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, onValueChange, baseId }}>
      <div className={cn('flex flex-col gap-3', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  // The list is context-aware on purpose: a tab bar rendered outside the
  // provider is the exact mistake that broke the EDA and DQ screens, and
  // it must fail here rather than silently render an inert bar.
  useTabsContext('TabsList');
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps {
  value: TabsValue;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const ctx = useTabsContext('TabsTrigger');
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${value}`}
      aria-selected={active}
      aria-controls={`${ctx.baseId}-panel-${value}`}
      tabIndex={active ? 0 : -1}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-primary-500/20 text-primary-600 dark:text-primary-300'
          : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-900 dark:hover:text-neutral-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps {
  value: TabsValue;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = useTabsContext('TabsContent');
  if (ctx.value !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      className={cn('flex flex-col gap-2', className)}
    >
      {children}
    </div>
  );
}
