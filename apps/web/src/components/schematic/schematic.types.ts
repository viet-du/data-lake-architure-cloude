import type { EIconName } from '@/assets';

export type EPipelineNodeKind = 'crawler' | 'bronze' | 'silver' | 'gold' | 'catalog' | 'storage';

export interface PipelineNode {
  kind: EPipelineNodeKind;
  labelKey: string;
  iconName: EIconName;
  color: string;
  glow: string;
  descriptionKey: string;
  recordsLabel: string;
  recordsValue: string;
  latencyLabel: string;
  latencyValue: string;
  position: Readonly<[number, number, number]>;
}

export interface PipelineLink {
  from: EPipelineNodeKind;
  to: EPipelineNodeKind;
  flowLabelKey: string;
}
