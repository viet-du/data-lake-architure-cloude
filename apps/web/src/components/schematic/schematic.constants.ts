import type { PipelineLink, PipelineNode } from './schematic.types';

export const PIPELINE_NODES: ReadonlyArray<PipelineNode> = [
  {
    kind: 'crawler',
    labelKey: 'nav.crawler',
    iconName: 'Pipeline',
    color: '#a78bfa',
    glow: '#7c3aed',
    descriptionKey: 'schematic.nodes.crawler',
    recordsLabel: 'pages',
    recordsValue: '128.4K',
    latencyLabel: 'p95',
    latencyValue: '1.2s',
    position: [-4.5, 0.6, 0],
  },
  {
    kind: 'bronze',
    labelKey: 'nav.bronze',
    iconName: 'Bronze',
    color: '#f59e0b',
    glow: '#b45309',
    descriptionKey: 'schematic.nodes.bronze',
    recordsLabel: 'records',
    recordsValue: '2.6M',
    latencyLabel: 'p95',
    latencyValue: '420ms',
    position: [-2.2, -0.4, 0.3],
  },
  {
    kind: 'silver',
    labelKey: 'nav.silver',
    iconName: 'Silver',
    color: '#94a3b8',
    glow: '#475569',
    descriptionKey: 'schematic.nodes.silver',
    recordsLabel: 'rows',
    recordsValue: '2.1M',
    latencyLabel: 'p95',
    latencyValue: '860ms',
    position: [0.2, 0.4, -0.2],
  },
  {
    kind: 'gold',
    labelKey: 'nav.gold',
    iconName: 'Gold',
    color: '#eab308',
    glow: '#a16207',
    descriptionKey: 'schematic.nodes.gold',
    recordsLabel: 'aggregates',
    recordsValue: '14.2K',
    latencyLabel: 'p95',
    latencyValue: '210ms',
    position: [2.5, -0.3, 0.2],
  },
  {
    kind: 'catalog',
    labelKey: 'nav.catalog',
    iconName: 'HiveMetastore',
    color: '#22d3ee',
    glow: '#0891b2',
    descriptionKey: 'schematic.nodes.catalog',
    recordsLabel: 'tables',
    recordsValue: '186',
    latencyLabel: 'p95',
    latencyValue: '90ms',
    position: [4.5, 0.6, -0.1],
  },
  {
    kind: 'storage',
    labelKey: 'schematic.storage',
    iconName: 'Storage',
    color: '#10b981',
    glow: '#047857',
    descriptionKey: 'schematic.nodes.storage',
    recordsLabel: 'bytes',
    recordsValue: '482GB',
    latencyLabel: 'iops',
    latencyValue: '1.4K',
    position: [0.2, 2.6, 0.2],
  },
];

export const PIPELINE_LINKS: ReadonlyArray<PipelineLink> = [
  { from: 'crawler', to: 'bronze', flowLabelKey: 'schematic.flow.ingest' },
  { from: 'bronze', to: 'silver', flowLabelKey: 'schematic.flow.transform' },
  { from: 'silver', to: 'gold', flowLabelKey: 'schematic.flow.aggregate' },
  { from: 'crawler', to: 'storage', flowLabelKey: 'schematic.flow.archive' },
  { from: 'bronze', to: 'storage', flowLabelKey: 'schematic.flow.archive' },
  { from: 'silver', to: 'storage', flowLabelKey: 'schematic.flow.archive' },
  { from: 'gold', to: 'catalog', flowLabelKey: 'schematic.flow.publish' },
  { from: 'silver', to: 'catalog', flowLabelKey: 'schematic.flow.register' },
];

export const SCHEMATIC_BACKGROUND_RING_RADIUS = 4.8;
export const SCHEMATIC_BACKGROUND_RING_TUBULAR = 128;

export const PARTICLE_BASE_SPEED = 0.45;
export const PARTICLE_RADIUS = 0.035;
export const PARTICLES_PER_LINK = 6;
