import noiseUrl from './noise.svg';

export const AMBIENT = {
  Noise: noiseUrl,
} as const;

export type EAmbientAsset = keyof typeof AMBIENT;