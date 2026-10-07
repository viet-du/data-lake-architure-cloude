import { useEffect } from 'react';

export type HotkeyHandler = (event: KeyboardEvent) => void;

export interface HotkeyOptions {
  cmd?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  key: string;
  preventDefault?: boolean;
}

function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform ?? '';
  return /Mac|iPhone|iPad|iPod/.test(platform);
}

export function useHotkey(options: HotkeyOptions, handler: HotkeyHandler): void {
  const { cmd, ctrl, shift, alt, key, preventDefault = true } = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mac = isMac();
    const targetKey = key.toLowerCase();
    const matches = (e: KeyboardEvent): boolean => {
      if (e.key.toLowerCase() !== targetKey) return false;
      if (cmd !== undefined) {
        const wantsMeta = cmd;
        const hasMeta = mac ? e.metaKey : e.ctrlKey;
        if (hasMeta !== wantsMeta) return false;
      }
      if (ctrl !== undefined && e.ctrlKey !== ctrl) return false;
      if (shift !== undefined && e.shiftKey !== shift) return false;
      if (alt !== undefined && e.altKey !== alt) return false;
      return true;
    };

    const onKey = (e: KeyboardEvent) => {
      if (!matches(e)) return;
      if (preventDefault) e.preventDefault();
      handler(e);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmd, ctrl, shift, alt, key, preventDefault, handler]);
}