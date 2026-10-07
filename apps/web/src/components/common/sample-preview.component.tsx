import { useTranslation } from 'react-i18next';
import { EmptyState, ScreenLoading, ScreenError } from '@/components';

export interface SamplePreviewProps {
  columns: ReadonlyArray<string>;
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  maxRows?: number;
}

export function SamplePreview({
  columns,
  rows,
  isLoading,
  isError,
  error,
  onRetry,
  maxRows = 20,
}: SamplePreviewProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return (
      <ScreenError
        error={error ?? new Error('Unknown error')}
        onRetry={onRetry}
        compact
      />
    );
  }
  if (columns.length === 0 || rows.length === 0) {
    return <EmptyState compact title={t('sample.empty')} />;
  }
  const shown = rows.slice(0, maxRows);

  return (
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
              <tr
                key={idx}
                className="border-t border-white/5 hover:bg-white/5"
              >
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
      {rows.length > maxRows ? (
        <div className="border-t border-white/10 bg-white/5 p-2 text-center text-[10px] text-neutral-500">
          {t('sample.moreRows', { count: rows.length - maxRows })}
        </div>
      ) : null}
    </div>
  );
}
