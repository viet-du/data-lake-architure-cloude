import { useEffect, useRef, useState } from 'react';
import { cn } from '@/theme';
import { Input } from '@/components';
import type { SearchBoxProps } from '@/navigation';

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search...',
  debounceMs = 200,
  className,
}: SearchBoxProps) {
  const [internal, setInternal] = useState<string>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef<boolean>(true);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(internal);
    }, debounceMs);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [internal, debounceMs, onChange]);

  return (
    <div className={cn('w-full max-w-md', className)}>
      <Input
        value={internal}
        onChange={(e) => setInternal(e.target.value)}
        placeholder={placeholder}
        variant="search"
        inputSize="md"
        fullWidth
        leftIcon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        }
        rightIcon={
          internal.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setInternal('');
                onChange('');
              }}
              className="pointer-events-auto text-neutral-400 transition-colors hover:text-neutral-200"
              aria-label="Clear search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null
        }
      />
    </div>
  );
}
