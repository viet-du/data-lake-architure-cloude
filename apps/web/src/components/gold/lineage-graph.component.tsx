import { useTranslation } from 'react-i18next';
import { Tag, EmptyState, ScreenLoading, ScreenError } from '@/components';
import { cn } from '@/theme';

export interface LineageNode {
  table: string;
  layer: 'silver' | 'bronze';
  edgeType: string;
}

export interface LineageData {
  table: string;
  upstream: ReadonlyArray<LineageNode>;
  downstream: ReadonlyArray<LineageNode>;
}

export interface LineageGraphProps {
  data: LineageData | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const LAYER_COLOR: Readonly<Record<'silver' | 'bronze' | 'gold', string>> = {
  gold: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  silver: 'border-slate-400/40 bg-slate-400/10 text-slate-300',
  bronze: 'border-orange-400/40 bg-orange-400/10 text-orange-300',
};

function NodeCard({ label, layer, edgeType }: { label: string; layer: 'gold' | 'silver' | 'bronze'; edgeType?: string }) {
  return (
    <div
      className={cn(
        'flex min-w-[140px] flex-col items-center gap-1 rounded-lg border p-2 text-center',
        LAYER_COLOR[layer],
      )}
    >
      <p className="truncate text-xs font-semibold">{label}</p>
      {edgeType !== undefined ? (
        <p className="text-[9px] opacity-70">{edgeType}</p>
      ) : null}
    </div>
  );
}

function Column({ title, nodes, layer, emptyHint }: { title: string; nodes: ReadonlyArray<LineageNode>; layer: 'silver' | 'bronze'; emptyHint: string }) {
  return (
    <div className="flex min-w-[180px] flex-col gap-2">
      <p className="text-[10px] uppercase tracking-wider text-neutral-500">{title}</p>
      {nodes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-2 text-center text-[10px] text-neutral-500">
          {emptyHint}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {nodes.map((n) => (
            <NodeCard key={`${layer}-${n.table}`} label={n.table} layer={layer} edgeType={n.edgeType} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LineageGraph({ data, isLoading, isError, error, onRetry }: LineageGraphProps) {
  const { t } = useTranslation();
  if (isLoading) return <ScreenLoading rows={3} />;
  if (isError) {
    return <ScreenError error={error ?? new Error('Unknown error')} onRetry={onRetry} compact />;
  }
  if (data === undefined) {
    return <EmptyState compact title={t('lineage.empty')} />;
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Column
        title={t('lineage.upstream')}
        nodes={data.upstream}
        layer={data.upstream[0]?.layer ?? 'silver'}
        emptyHint={t('lineage.noUpstream')}
      />
      <div className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <NodeCard label={data.table} layer="gold" edgeType="current" />
          <Tag size="sm" variant="warning">
            {t('lineage.current')}
          </Tag>
        </div>
      </div>
      <Column
        title={t('lineage.downstream')}
        nodes={data.downstream}
        layer={data.downstream[0]?.layer ?? 'silver'}
        emptyHint={t('lineage.noDownstream')}
      />
    </div>
  );
}