import { useMemo } from 'react';
import { cn } from '@/theme';

/**
 * Chart primitives.
 *
 * The project has no charting dependency (MASTER PLAN gap D-19), and the
 * existing visuals are hand-authored SVG/CSS. These primitives follow that
 * convention rather than introducing a dependency mid-phase.
 *
 * Every primitive obeys the same rule the profile contract states: a missing
 * measurement is `null` and is *not* rendered as `0`. A `null` point is drawn
 * as a gap, never as a zero-height bar.
 */

export interface ChartFrameProps {
  title?: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
}

/** The shared chrome of every chart: a title, an optional legend and a body. */
export function ChartFrame({
  title,
  subtitle,
  className,
  children,
  actions,
  empty = false,
  emptyText,
}: ChartFrameProps) {
  return (
    <figure
      className={cn(
        'flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-4',
        className,
      )}
    >
      {title !== undefined ? (
        <figcaption className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-neutral-800 dark:text-neutral-100">
              {title}
            </p>
            {subtitle !== undefined ? (
              <p className="truncate text-[10px] text-neutral-500">{subtitle}</p>
            ) : null}
          </div>
          {actions !== undefined ? (
            <div className="flex shrink-0 items-center gap-1">{actions}</div>
          ) : null}
        </figcaption>
      ) : null}
      {empty ? (
        <div className="flex h-32 items-center justify-center text-[10px] text-neutral-500">
          {emptyText ?? '—'}
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  /** A missing measurement — rendered as a gap, never as zero. */
  missing?: boolean;
}

export interface BarChartProps {
  data: ReadonlyArray<BarDatum>;
  /** The unit suffix of the value, e.g. `%`. */
  unit?: string;
  /** The maximum value; defaults to the observed maximum. */
  max?: number;
  height?: number;
  /** The colour of the bars. */
  tone?: 'primary' | 'emerald' | 'amber' | 'sky' | 'rose';
  /** The values are ratios in 0–1 and are rendered as percentages. */
  isRatio?: boolean;
  className?: string;
  /** The number of categories rendered before the axis is truncated. */
  maxCategories?: number;
}

const TONE_FILL: Readonly<Record<NonNullable<BarChartProps['tone']>, string>> = {
  primary: 'fill-primary-500/80',
  emerald: 'fill-emerald-500/70',
  amber: 'fill-amber-500/70',
  sky: 'fill-sky-500/70',
  rose: 'fill-rose-500/70',
};

function formatValue(value: number, unit: string | undefined, isRatio: boolean): string {
  if (isRatio) return `${(value * 100).toFixed(1)}%`;
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString()}${unit ?? ''}`;
}

/**
 * A horizontal bar chart.
 *
 * Horizontal bars are used on purpose: a dataset can have dozens of columns
 * and long column names, and a vertical layout would need rotated labels to
 * stay readable on a phone.
 */
export function BarChart({
  data,
  unit,
  max,
  height = 180,
  tone = 'primary',
  isRatio = false,
  className,
  maxCategories = 12,
}: BarChartProps) {
  const items = useMemo(() => data.slice(0, maxCategories), [data, maxCategories]);
  const observedMax = useMemo(
    () => items.reduce((acc, item) => (item.missing === true ? acc : Math.max(acc, item.value)), 0),
    [items],
  );
  const scaleMax = max ?? (observedMax > 0 ? observedMax : 1);

  if (items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[10px] text-neutral-500">
        —
      </div>
    );
  }

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)} style={{ minHeight: height }}>
      {items.map((item) => {
        const missing = item.missing === true || !Number.isFinite(item.value);
        const ratio = missing ? 0 : Math.max(0, Math.min(1, item.value / scaleMax));
        return (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="w-28 shrink-0 truncate text-[10px] text-neutral-500 dark:text-neutral-400"
              title={item.label}
            >
              {item.label}
            </span>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-white/5">
              {missing ? (
                <div className="h-full w-full rounded-full border border-dashed border-white/15" />
              ) : (
                <div
                  className={cn('h-full rounded-full transition-all duration-300', TONE_FILL[tone])}
                  style={{ width: `${ratio * 100}%` }}
                />
              )}
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
              {missing ? '—' : formatValue(item.value, unit, isRatio)}
            </span>
          </div>
        );
      })}
      {data.length > items.length ? (
        <p className="text-[10px] text-neutral-500">+{data.length - items.length} more</p>
      ) : null}
    </div>
  );
}

export interface HistogramBucketDatum {
  lower: number;
  upper: number;
  count: number;
}

export interface HistogramChartProps {
  buckets: ReadonlyArray<HistogramBucketDatum>;
  height?: number;
  className?: string;
  onSelect?: (bucket: HistogramBucketDatum) => void;
}

/** A histogram rendered as an SVG area with an explicit baseline. */
export function HistogramChart({
  buckets,
  height = 180,
  className,
  onSelect,
}: HistogramChartProps) {
  const width = 640;
  const padding = { top: 8, right: 8, bottom: 24, left: 44 };

  const geometry = useMemo(() => {
    if (buckets.length === 0) return null;
    const maxCount = buckets.reduce((acc, bucket) => Math.max(acc, bucket.count), 0);
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const step = innerWidth / buckets.length;
    const barWidth = Math.max(1, step * 0.92);
    const points = buckets.map((bucket, index) => {
      const x = padding.left + index * step + (step - barWidth) / 2;
      const ratio = maxCount > 0 ? bucket.count / maxCount : 0;
      const barHeight = Math.max(bucket.count > 0 ? 1 : 0, ratio * innerHeight);
      return { bucket, x, y: padding.top + innerHeight - barHeight, barHeight };
    });
    return { maxCount, innerWidth, innerHeight, points };
  }, [buckets, height]);

  if (geometry === null) {
    return (
      <div className="flex h-24 items-center justify-center text-[10px] text-neutral-500">
        —
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Histogram"
        preserveAspectRatio="none"
      >
        <line
          x1={padding.left}
          y1={padding.top + geometry.innerHeight}
          x2={width - padding.right}
          y2={padding.top + geometry.innerHeight}
          className="stroke-white/15"
          strokeWidth={1}
        />
        {geometry.points.map((point) => (
          <rect
            key={`${point.bucket.lower}-${point.bucket.upper}`}
            x={point.x}
            y={point.y}
            width={geometry.innerWidth / buckets.length - 2}
            height={point.barHeight}
            className="fill-primary-500/70"
            onClick={onSelect !== undefined ? () => onSelect(point.bucket) : undefined}
          />
        ))}
        <text
          x={padding.left - 6}
          y={padding.top + 8}
          textAnchor="end"
          className="fill-neutral-500 text-[10px]"
        >
          {geometry.maxCount.toLocaleString()}
        </text>
        <text
          x={padding.left - 6}
          y={padding.top + geometry.innerHeight}
          textAnchor="end"
          className="fill-neutral-500 text-[10px]"
        >
          0
        </text>
        <text
          x={padding.left}
          y={height - 6}
          textAnchor="start"
          className="fill-neutral-500 text-[10px]"
        >
          {buckets[0]?.lower ?? ''}
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          textAnchor="end"
          className="fill-neutral-500 text-[10px]"
        >
          {buckets[buckets.length - 1]?.upper ?? ''}
        </text>
      </svg>
    </div>
  );
}

export interface BoxPlotDatum {
  label: string;
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  max: number | null;
}

export interface BoxPlotChartProps {
  data: ReadonlyArray<BoxPlotDatum>;
  height?: number;
  className?: string;
}

/** A box plot. A missing quartile is drawn as an open marker, not as zero. */
export function BoxPlotChart({ data, height = 160, className }: BoxPlotChartProps) {
  const width = 640;
  const padding = { top: 12, right: 12, bottom: 28, left: 48 };

  const geometry = useMemo(() => {
    if (data.length === 0) return null;
    const values = data.flatMap((item) =>
      [item.min, item.p25, item.median, item.p75, item.max].filter(
        (value): value is number => value !== null && Number.isFinite(value),
      ),
    );
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const slot = innerWidth / data.length;
    const boxes = data.map((item, index) => {
      const scale = (value: number): number =>
        padding.top + innerHeight - ((value - min) / span) * innerHeight;
      return {
        item,
        centerX: padding.left + slot * index + slot / 2,
        boxWidth: Math.max(8, slot * 0.4),
        minY: item.min === null ? null : scale(item.min),
        p25Y: item.p25 === null ? null : scale(item.p25),
        medianY: item.median === null ? null : scale(item.median),
        p75Y: item.p75 === null ? null : scale(item.p75),
        maxY: item.max === null ? null : scale(item.max),
      };
    });
    return { min, max, boxes };
  }, [data, height]);

  if (geometry === null) {
    return (
      <div className="flex h-24 items-center justify-center text-[10px] text-neutral-500">
        —
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Box plot">
        {geometry.boxes.map((box) => (
          <g key={box.item.label}>
            {box.minY !== null && box.p25Y !== null ? (
              <line
                x1={box.centerX}
                y1={box.minY}
                x2={box.centerX}
                y2={box.p25Y}
                className="stroke-primary-400"
                strokeWidth={1}
              />
            ) : null}
            {box.p75Y !== null && box.maxY !== null ? (
              <line
                x1={box.centerX}
                y1={box.p75Y}
                x2={box.centerX}
                y2={box.maxY}
                className="stroke-primary-400"
                strokeWidth={1}
              />
            ) : null}
            {box.p25Y !== null && box.p75Y !== null ? (
              <rect
                x={box.centerX - box.boxWidth / 2}
                y={box.p25Y}
                width={box.boxWidth}
                height={Math.max(1, box.p75Y - box.p25Y)}
                className="fill-primary-500/30 stroke-primary-400"
                strokeWidth={1}
              />
            ) : null}
            {box.medianY !== null ? (
              <line
                x1={box.centerX - box.boxWidth / 2}
                y1={box.medianY}
                x2={box.centerX + box.boxWidth / 2}
                y2={box.medianY}
                className="stroke-primary-300"
                strokeWidth={2}
              />
            ) : (
              <circle
                cx={box.centerX}
                cy={padding.top + (height - padding.top - padding.bottom) / 2}
                r={4}
                className="fill-none stroke-neutral-500"
                strokeDasharray="2 2"
              />
            )}
            <text
              x={box.centerX}
              y={height - 8}
              textAnchor="middle"
              className="fill-neutral-500 text-[10px]"
            >
              {box.item.label}
            </text>
          </g>
        ))}
        <text
          x={padding.left - 6}
          y={padding.top + 8}
          textAnchor="end"
          className="fill-neutral-500 text-[10px]"
        >
          {geometry.max.toLocaleString()}
        </text>
        <text
          x={padding.left - 6}
          y={height - padding.bottom}
          textAnchor="end"
          className="fill-neutral-500 text-[10px]"
        >
          {geometry.min.toLocaleString()}
        </text>
      </svg>
    </div>
  );
}

export interface CorrelationMatrixProps {
  columns: ReadonlyArray<string>;
  matrix: ReadonlyArray<ReadonlyArray<number | null>>;
  className?: string;
  onSelect?: (row: string, column: string, value: number | null) => void;
}

/**
 * A correlation heatmap.
 *
 * A `null` cell (an undefined correlation, e.g. a constant column) is drawn
 * as a hatched gap — it is *not* zero, and it must not look like "no
 * correlation".
 */
export function CorrelationMatrix({
  columns,
  matrix,
  className,
  onSelect,
}: CorrelationMatrixProps) {
  const size = Math.min(columns.length, 24);
  if (size === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[10px] text-neutral-500">
        —
      </div>
    );
  }

  const cell = 26;
  const labelWidth = 96;
  const width = labelWidth + size * cell;
  const height = labelWidth + size * cell;

  function colorFor(value: number | null): { fill: string; text: string } {
    if (value === null) return { fill: 'rgba(148,163,184,0.08)', text: 'rgba(148,163,184,0.7)' };
    const magnitude = Math.min(1, Math.abs(value));
    const alpha = 0.12 + magnitude * 0.68;
    const positive = value >= 0;
    return {
      fill: positive ? `rgba(16,185,129,${alpha.toFixed(2)})` : `rgba(239,68,68,${alpha.toFixed(2)})`,
      text: magnitude > 0.55 ? '#fff' : 'rgba(148,163,184,0.9)',
    };
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        style={{ minWidth: `${Math.min(width, 640)}px` }}
        role="img"
        aria-label="Correlation matrix"
      >
        {columns.slice(0, size).map((name, rowIndex) => (
          <text
            key={`row-${name}`}
            x={labelWidth - 6}
            y={labelWidth + rowIndex * cell + cell / 2 + 3}
            textAnchor="end"
            className="fill-neutral-500 text-[9px]"
          >
            {name.length > 12 ? `${name.slice(0, 11)}…` : name}
          </text>
        ))}
        {columns.slice(0, size).map((name, colIndex) => (
          <text
            key={`col-${name}`}
            x={labelWidth + colIndex * cell + cell / 2}
            y={labelWidth - 6}
            textAnchor="middle"
            className="fill-neutral-500 text-[9px]"
            transform={`rotate(-45 ${labelWidth + colIndex * cell + cell / 2} ${labelWidth - 6})`}
          >
            {name.length > 12 ? `${name.slice(0, 11)}…` : name}
          </text>
        ))}
        {columns.slice(0, size).map((rowName, rowIndex) =>
          columns.slice(0, size).map((colName, colIndex) => {
            const value = matrix[rowIndex]?.[colIndex] ?? null;
            const { fill, text } = colorFor(value);
            return (
              <g key={`${rowName}-${colName}`}>
                <rect
                  x={labelWidth + colIndex * cell + 1}
                  y={labelWidth + rowIndex * cell + 1}
                  width={cell - 2}
                  height={cell - 2}
                  rx={3}
                  fill={fill}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                  onClick={
                    onSelect !== undefined ? () => onSelect(rowName, colName, value) : undefined
                  }
                />
                {value !== null ? (
                  <text
                    x={labelWidth + colIndex * cell + cell / 2}
                    y={labelWidth + rowIndex * cell + cell / 2 + 3}
                    textAnchor="middle"
                    style={{ fill: text, fontSize: 8 }}
                  >
                    {value.toFixed(2).replace('0.', '.')}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
