import { useTranslation } from 'react-i18next';
import { GlassCard, Icon, Tag } from '@/components';
import { PIPELINE_NODES } from './schematic.constants';
import { nodeHealth, type SchematicOverlay } from './schematic.overlay';
import type { EPipelineNodeKind, PipelineNode } from './schematic.types';

export interface StorageInspectorProps {
  activeKind: EPipelineNodeKind | null;
  onClose: () => void;
  /** The live state of the inspected node. */
  overlay: SchematicOverlay | null;
}

const HEALTH_TAG: Readonly<
  Record<
    ReturnType<typeof nodeHealth>,
    { variant: 'success' | 'warning' | 'error' | 'info'; labelKey: string }
  >
> = {
  idle: { variant: 'info', labelKey: 'schematic.overlay.idle' },
  running: { variant: 'warning', labelKey: 'schematic.overlay.running' },
  healthy: { variant: 'success', labelKey: 'schematic.overlay.healthy' },
  degraded: { variant: 'error', labelKey: 'schematic.overlay.degraded' },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

export function StorageInspector({ activeKind, onClose, overlay }: StorageInspectorProps) {
  const { t } = useTranslation();
  if (activeKind === null) return null;
  const node: PipelineNode | undefined = PIPELINE_NODES.find((n) => n.kind === activeKind);
  if (node === undefined) return null;

  const health = overlay === null ? 'idle' : nodeHealth(overlay);
  const tag = HEALTH_TAG[health];

  return (
    <GlassCard
      elevation={3}
      className="pointer-events-auto absolute right-4 top-4 w-[min(18rem,calc(100%-2rem))] border border-white/10 p-4 backdrop-blur-2xl"
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

      {overlay === null || overlay.unavailable ? (
        <p className="mt-3 text-xs text-neutral-300">{t('schematic.overlay.unavailable')}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Tag variant={tag.variant} dot size="sm">
              {t(tag.labelKey)}
            </Tag>
            {overlay.running > 0 ? (
              <span className="text-[10px] text-neutral-300">
                {t('schematic.overlay.running_count', { count: overlay.running })}
              </span>
            ) : null}
          </div>

          {overlay.lastOperation === null ? (
            <p className="text-xs text-neutral-400">{t('schematic.overlay.no_operation')}</p>
          ) : (
            <dl className="space-y-1 text-[11px] text-neutral-300">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-neutral-400">{t('schematic.overlay.last_operation')}</dt>
                <dd className="truncate font-medium text-neutral-100">
                  {overlay.lastOperation.kind}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-neutral-400">{t('schematic.overlay.status')}</dt>
                <dd className="font-medium text-neutral-100">{overlay.lastOperation.status}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-neutral-400">{t('schematic.overlay.ago')}</dt>
                <dd className="font-medium text-neutral-100">
                  {formatRelative(overlay.lastOperation.at)}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </GlassCard>
  );
}
