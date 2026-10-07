import { useTranslation } from 'react-i18next';
import { EmptyState, ScreenLoading, ScreenError, Tag } from '@/components';
import type { CrawlerPreviewItem } from '@/types/entities';

export interface CrawlerPreviewListProps {
  items: ReadonlyArray<CrawlerPreviewItem> | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  maxRows?: number;
}

function formatPrice(p: number | undefined): string {
  if (p === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p);
}

export function CrawlerPreviewList({
  items,
  isLoading,
  isError,
  error,
  onRetry,
  maxRows = 20,
}: CrawlerPreviewListProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  if (items === undefined || items.length === 0) {
    return <EmptyState compact title={t('crawler.noPreview')} />;
  }
  const shown = items.slice(0, maxRows);
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Title
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Price
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                SKU
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                Category
              </th>
              <th className="px-3 py-2 text-left font-semibold text-neutral-700 dark:text-neutral-300">
                URL
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it, idx) => (
              <tr key={idx} className="border-t border-white/5 hover:bg-white/5">
                <td className="max-w-[280px] truncate px-3 py-1.5 text-neutral-700 dark:text-neutral-300">
                  {it.title}
                </td>
                <td className="px-3 py-1.5 font-mono text-neutral-700 dark:text-neutral-300">
                  {formatPrice(it.price)}
                </td>
                <td className="px-3 py-1.5 font-mono text-[10px] text-neutral-500">{it.sku ?? '—'}</td>
                <td className="px-3 py-1.5">
                  {it.category !== undefined ? (
                    <Tag size="sm" variant="info">
                      {it.category}
                    </Tag>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="max-w-[200px] truncate px-3 py-1.5 font-mono text-[10px] text-neutral-500">
                  {it.url}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}