import { useTranslation } from 'react-i18next';
import {
  BarChart,
  BoxPlotChart,
  ChartFrame,
  CorrelationMatrix,
  HistogramChart,
  type BarDatum,
  type BoxPlotDatum,
  type HistogramBucketDatum,
} from '@/components/charts';
import { cn } from '@/theme';
import type { EProfileChart } from '@/types/entities';
import { formatCount, formatNumber } from './eda.helpers';

/**
 * The chart renderer.
 *
 * It turns one typed `ProfileChart` aggregate into a rendered figure. The
 * chart *type* is the contract — the renderer never guesses: a `histogram`
 * chart is always a histogram, a `box` chart is always a box plot, and a
 * `correlation` chart is always a matrix. A chart type the renderer does not
 * know is reported as unsupported rather than silently drawn as something
 * else.
 */

export interface EdaChartProps {
  chart: EProfileChart;
  className?: string;
  onProposeRule?: (column: string) => void;
  onSelectCell?: (row: string, column: string, value: number | null) => void;
}

function numeric(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function EdaChart({ chart, className, onProposeRule, onSelectCell }: EdaChartProps) {
  const { t } = useTranslation();
  const categories = chart.categories ?? [];
  const values = chart.values ?? [];

  const actions =
    onProposeRule !== undefined && chart.column !== undefined ? (
      <button
        type="button"
        onClick={() => onProposeRule(chart.column as string)}
        className="rounded-md px-2 py-1 text-[10px] font-medium text-primary-600 transition-colors hover:bg-white/10 dark:text-primary-300"
      >
        {t('eda.proposeRule')}
      </button>
    ) : null;

  if (chart.type === 'missing') {
    const data: ReadonlyArray<BarDatum> = categories.map((category, index) => ({
      label: String(category),
      value: numeric(values[index]) ?? 0,
    }));
    return (
      <ChartFrame title={t('eda.chart.missingTitle')} className={className} actions={actions}>
        <BarChart data={data} isRatio tone="amber" max={1} />
      </ChartFrame>
    );
  }

  if (chart.type === 'histogram') {
    const buckets: ReadonlyArray<HistogramBucketDatum> = categories.map((category, index) => ({
      lower: Number(category),
      upper: numeric((chart.meta?.upper as ReadonlyArray<number> | undefined)?.[index]) ?? Number(category),
      count: numeric(values[index]) ?? 0,
    }));
    return (
      <ChartFrame title={chart.title} className={className} actions={actions}>
        <HistogramChart buckets={buckets} />
      </ChartFrame>
    );
  }

  if (chart.type === 'box') {
    const datum: BoxPlotDatum = {
      label: chart.column ?? chart.title,
      min: numeric(values[0]),
      p25: numeric(values[1]),
      median: numeric(values[2]),
      p75: numeric(values[3]),
      max: numeric(values[4]),
    };
    return (
      <ChartFrame
        title={chart.title}
        subtitle={t('eda.chart.boxSubtitle', {
          median: formatNumber(datum.median),
          iqr: formatNumber(numeric(chart.meta?.iqr as number | null | undefined)),
        })}
        className={className}
        actions={actions}
      >
        <BoxPlotChart data={[datum]} />
      </ChartFrame>
    );
  }

  if (chart.type === 'categorical') {
    const data: ReadonlyArray<BarDatum> = categories.map((category, index) => ({
      label: String(category),
      value: numeric(values[index]) ?? 0,
    }));
    return (
      <ChartFrame title={chart.title} className={className} actions={actions}>
        <BarChart data={data} tone="sky" maxCategories={10} />
      </ChartFrame>
    );
  }

  if (chart.type === 'temporal') {
    const min = numeric(values[0]);
    const max = numeric(values[1]);
    return (
      <ChartFrame title={chart.title} className={className} actions={actions}>
        <div className="flex items-center justify-between gap-3 py-4 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              {t('eda.chart.min')}
            </span>
            <span className="font-mono text-neutral-800 dark:text-neutral-100">{formatNumber(min)}</span>
          </div>
          <div className="h-px flex-1 bg-white/10" />
          <div className="flex flex-col text-right">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              {t('eda.chart.max')}
            </span>
            <span className="font-mono text-neutral-800 dark:text-neutral-100">{formatNumber(max)}</span>
          </div>
        </div>
      </ChartFrame>
    );
  }

  if (chart.type === 'correlation') {
    const matrix = (chart.meta?.matrix as ReadonlyArray<ReadonlyArray<number | null>> | undefined) ?? [];
    return (
      <ChartFrame
        title={chart.title}
        subtitle={t('eda.chart.correlationSubtitle', {
          method: String(chart.meta?.method ?? 'pearson'),
        })}
        className={className}
      >
        <CorrelationMatrix
          columns={categories.map((category) => String(category))}
          matrix={matrix}
          onSelect={onSelectCell}
        />
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      title={chart.title}
      className={className}
      empty
      emptyText={t('eda.chart.unsupported', { type: chart.type })}
    >
      <div />
    </ChartFrame>
  );
}

export interface EdaChartGridProps {
  charts: ReadonlyArray<EProfileChart>;
  className?: string;
  onProposeRule?: (column: string) => void;
  onSelectCell?: (row: string, column: string, value: number | null) => void;
}

/** The chart grid of a profile. */
export function EdaChartGrid({
  charts,
  className,
  onProposeRule,
  onSelectCell,
}: EdaChartGridProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2', className)}>
      {charts.map((chart) => (
        <EdaChart
          key={chart.chartId}
          chart={chart}
          onProposeRule={onProposeRule}
          onSelectCell={onSelectCell}
        />
      ))}
    </div>
  );
}

export interface EdaChartExportButtonProps {
  chart: EProfileChart;
  className?: string;
}

/**
 * Export a chart as a CSV snapshot.
 *
 * The export contains the *aggregated* series only — never raw rows. That
 * keeps the export inside the same bounded-data rule the API enforces.
 */
export function EdaChartExportButton({ chart, className }: EdaChartExportButtonProps) {
  const { t } = useTranslation();

  function exportCsv(): void {
    const categories = chart.categories ?? [];
    const values = chart.values ?? [];
    const lines = ['category,value'];
    categories.forEach((category, index) => {
      const value = values[index];
      lines.push(`"${String(category).replace(/"/g, '""')}",${value === null ? '' : String(value)}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${chart.chartId.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      className={cn(
        'rounded-md px-2 py-1 text-[10px] font-medium text-neutral-500 transition-colors hover:bg-white/10 hover:text-neutral-800 dark:hover:text-neutral-100',
        className,
      )}
    >
      {t('eda.chart.export')}
    </button>
  );
}

export { formatCount };
