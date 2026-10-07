import { useCallback, useState } from 'react';
import type { z } from 'zod';

export type FormErrors<T> = Partial<Record<keyof T, string>>;

export interface UseFormZodReturn<T extends object> {
  values: T;
  setField: <K extends keyof T>(key: K, value: T[K]) => void;
  errors: FormErrors<T>;
  validate: () => boolean;
  reset: (next?: T) => void;
}

export function useFormZod<T extends object>(
  schema: z.ZodType<unknown>,
  initial: T,
): UseFormZodReturn<T> {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<FormErrors<T>>({});

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const result = (schema as unknown as z.ZodType<T>).safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: FormErrors<T> = {};
    for (const issue of result.error.issues) {
      const path = issue.path[0];
      if (typeof path === 'string') {
        next[path as keyof T] = issue.message;
      }
    }
    setErrors(next);
    return false;
  }, [schema, values]);

  const reset = useCallback(
    (next?: T) => {
      setValues(next ?? initial);
      setErrors({});
    },
    [initial],
  );

  return { values, setField, errors, validate, reset };
}