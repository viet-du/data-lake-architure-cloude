import { useTranslation } from 'react-i18next';
import { GlassCard, Icon, Tag } from '@/components';
import { PIPELINE_NODES } from './schematic.constants';
import type { EPipelineNodeKind, PipelineNode } from './schematic.types';

export interface StorageInspectorProps {
  activeKind: EPipelineNodeKind | null;
  onClose: () => void;
}

export function StorageInspector({ activeKind, onClose }: StorageInspectorProps) {
  const { t } = useTranslation();
  if (activeKind === null) return null;
  const node: PipelineNode | undefined = PIPELINE_NODES.find((n) => n.kind === activeKind);
  if (node === undefined) return null;

  return (
    <GlassCard
      elevation={3}
      className="pointer-events-auto absolute right-4 top-4 w-72 border border-white/10 p-4 backdrop-blur-2xl"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-white/20"
            style={{ backgroundColor: `${node.color}40` }}
          >
            <Icon name={node.iconName} size={20} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-400">{t(node.labelKey)}</p>
            <p className="text-sm font-semibold text-neutral-50">{t(node.descriptionKey)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-neutral-100"
        >
          {t('common.close')}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/5 bg-white/5 p-2">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">{node.recordsLabel}</p>
          <p className="mt-0.5 text-lg font-bold text-neutral-50">{node.recordsValue}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/5 p-2">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">{node.latencyLabel}</p>
          <p className="mt-0.5 text-lg font-bold text-neutral-50">{node.latencyValue}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Tag size="sm" variant="success" dot>
          online
        </Tag>
        <span className="text-[10px] text-neutral-500">stream healthy</span>
      </div>
    </GlassCard>
  );
}
