import { useEffect, useRef, useState } from 'react';

export function useTranslation<T = Record<string, unknown>>(
  loader: () => Promise<T>,
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (mountedRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [loader]);

  return { data, loading, error };
}
