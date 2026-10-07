import { useCallback } from 'react';
import { useToastStore } from '@/store';

export type { EToastVariant, ToastMessage } from '@/store';

export function useToast() {
  const push = useToastStore((s) => s.push);
  const dismiss = useToastStore((s) => s.dismiss);
  const clear = useToastStore((s) => s.clear);

  const success = useCallback(
    (title: string, description?: string) =>
      push(description === undefined ? { variant: 'success', title } : { variant: 'success', title, description }),
    [push],
  );
  const error = useCallback(
    (title: string, description?: string) =>
      push(description === undefined ? { variant: 'error', title } : { variant: 'error', title, description }),
    [push],
  );
  const warning = useCallback(
    (title: string, description?: string) =>
      push(description === undefined ? { variant: 'warning', title } : { variant: 'warning', title, description }),
    [push],
  );
  const info = useCallback(
    (title: string, description?: string) =>
      push(description === undefined ? { variant: 'info', title } : { variant: 'info', title, description }),
    [push],
  );

  return { success, error, warning, info, dismiss, clear };
}
