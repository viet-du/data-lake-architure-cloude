import { type ReactNode } from 'react';
import { cn } from '@/theme';

export type ETableSize = 'sm' | 'md';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

export interface TableProps<T> {
  columns: ReadonlyArray<TableColumn<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T, index: number) => string;
  size?: ETableSize;
  loading?: boolean;
  emptyText?: string;
  className?: string;
  onRowClick?: (row: T) => void;
}

const SIZE_CLASSES: Readonly<Record<ETableSize, string>> = {
  sm: 'text-xs',
  md: 'text-sm',
};

const CELL_PADDING: Readonly<Record<ETableSize, string>> = {
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
};

const ALIGN_CLASSES: Readonly<Record<'left' | 'center' | 'right', string>> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Table<T>({
  columns,
  rows,
  rowKey,
  size = 'md',
  loading = false,
  emptyText = 'No data',
  className,
  onRowClick,
}: TableProps<T>) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-xl',
        'border border-white/10 bg-white/5 backdrop-blur-md',
        className,
      )}
    >
      <div className="w-full overflow-x-auto">
        <table className={cn('w-full border-collapse', SIZE_CLASSES[size])}>
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width !== undefined ? { width: col.width } : undefined}
                  className={cn(
                    'font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400',
                    CELL_PADDING[size],
                    ALIGN_CLASSES[col.align ?? 'left'],
                    size === 'sm' ? 'text-[10px]' : 'text-[11px]',
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className={cn('text-center text-neutral-400', CELL_PADDING[size])}>
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={cn('text-center text-neutral-400', CELL_PADDING[size])}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-white/5 last:border-b-0',
                    'transition-colors duration-150',
                    'text-neutral-800 dark:text-neutral-200',
                    onRowClick && 'cursor-pointer hover:bg-white/5',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        CELL_PADDING[size],
                        ALIGN_CLASSES[col.align ?? 'left'],
                      )}
                    >
                      {col.cell(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
