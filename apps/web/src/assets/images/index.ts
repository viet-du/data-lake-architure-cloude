import goalUrl from './goal/UI_goal.png';

export const IMAGES = {
  Goal: goalUrl,
} as const;

export type EImageName = keyof typeof IMAGES;
