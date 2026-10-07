import { useTranslation } from 'react-i18next';
import { PIPELINE_LINKS, PIPELINE_NODES } from './schematic.constants';
import type { EPipelineNodeKind, PipelineLink, PipelineNode } from './schematic.types';

export interface SchematicLegendProps {
  activeKind: EPipelineNodeKind | null;
  onSelect: (kind: EPipelineNodeKind) => void;
}

export function SchematicLegend({ activeKind, onSelect }: SchematicLegendProps) {
  const { t } = useTranslation();
  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 flex max-w-[60%] flex-col gap-3">
      <LegendNodes activeKind={activeKind} onSelect={onSelect} />
      <LegendLinks />
    </div>
  );

  function LegendNodes({ activeKind: a, onSelect: s }: { activeKind: EPipelineNodeKind | null; onSelect: (k: EPipelineNodeKind) => void }) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-2xl">
        <p className="text-[10px] uppercase tracking-wider text-neutral-400">
          {t('schematic.legend.nodes')}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PIPELINE_NODES.map((node) => (
            <NodePill
              key={node.kind}
              node={node}
              active={a === node.kind}
              onClick={() => s(node.kind)}
            />
          ))}
        </div>
      </div>
    );
  }

  function LegendLinks() {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-3 backdrop-blur-2xl">
        <p className="text-[10px] uppercase tracking-wider text-neutral-400">
          {t('schematic.legend.flows')}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PIPELINE_LINKS.map((link) => (
            <LinkPill key={`${link.from}-${link.to}`} link={link} />
          ))}
        </div>
      </div>
    );
  }
}

function NodePill({
  node,
  active,
  onClick,
}: {
  node: PipelineNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors ${
        active
          ? 'border-white/40 bg-white/10 text-white'
          : 'border-white/5 bg-white/5 text-neutral-300 hover:bg-white/10'
      }`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: node.color }} />
      {node.kind}
    </button>
  );
}

function LinkPill({ link }: { link: PipelineLink }) {
  return (
    <span className="rounded-md border border-white/5 bg-white/5 px-2 py-1 text-[10px] text-neutral-300">
      {link.from} → {link.to}
    </span>
  );
}
