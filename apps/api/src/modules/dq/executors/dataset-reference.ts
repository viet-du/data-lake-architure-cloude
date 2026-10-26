export interface DqDatasetReference {
  database: string | null;
  table: string;
}

const SEPARATORS = ['.', '/'] as const;

export function parseDatasetReference(value: string): DqDatasetReference | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const separator = SEPARATORS.find((candidate) => raw.includes(candidate));
  if (separator === undefined) return { database: null, table: raw };

  const parts = raw.split(separator);
  const [database, table] = parts;
  if (parts.length !== 2 || !database || !table) return null;
  return { database, table };
}
