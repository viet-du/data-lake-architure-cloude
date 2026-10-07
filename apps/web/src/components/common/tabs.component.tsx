import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/theme';

type TabsValue = string;

interface TabsContextValue {
  value: TabsValue;
  onValueChange: (v: TabsValue) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (ctx === null) {
    throw new Error('Tabs subcomponents must be used inside TabsRoot');
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
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('flex flex-col gap-3', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
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
  const ctx = useTabsContext();
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
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
  const ctx = useTabsContext();
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={cn('flex flex-col gap-2', className)}>
      {children}
    </div>
  );
}
