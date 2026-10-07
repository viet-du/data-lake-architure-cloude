export const LAYERS = ['bronze', 'silver', 'gold'] as const;
export type Layer = (typeof LAYERS)[number];

export const isLayer = (value: unknown): value is Layer =>
  typeof value === 'string' && (LAYERS as readonly string[]).includes(value);