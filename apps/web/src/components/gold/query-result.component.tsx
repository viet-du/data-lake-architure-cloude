import { Tag, EmptyState, ScreenLoading, ScreenError } from '@/components';

export interface QueryResultProps {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  totalRows: number;
  executionMs?: number | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  maxRows?: number;
}

export function QueryResult({
  columns,
  rows,
  totalRows,
  executionMs,
  isLoading,
  isError,
  error,
  onRetry,
  maxRows = 50,
}: QueryResultProps) {
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  if (columns.length === 0 || rows.length === 0) {
    return <EmptyState compact title="No rows" />;
  }
  const shown = rows.slice(0, maxRows);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[10px] text-neutral-500">
        <Tag size="sm" variant="info">
          {totalRows} rows
        </Tag>
        {executionMs !== undefined ? (
          <Tag size="sm" variant="neutral">
            {executionMs} ms
          </Tag>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/5">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="whitespace-nowrap px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, idx) => (
                <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="whitespace-nowrap px-3 py-1.5 font-mono text-neutral-700 dark:text-neutral-300"
                    >
                      {String(row[col] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}