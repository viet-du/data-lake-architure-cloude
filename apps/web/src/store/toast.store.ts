import { create } from 'zustand';

export type EToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  variant: EToastVariant;
  title: string;
  description?: string | undefined;
  durationMs: number;
}

export interface ToastState {
  toasts: ReadonlyArray<ToastMessage>;
  push: (msg: Omit<ToastMessage, 'id' | 'durationMs'> & { durationMs?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

function nextId(): string {
  counter += 1;
  return `toast-${Date.now()}-${counter}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (msg) => {
    const id = nextId();
    const duration = msg.durationMs ?? 4000;
    const toast: ToastMessage = {
      id,
      variant: msg.variant,
      title: msg.title,
      description: msg.description,
      durationMs: duration,
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    if (duration > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
