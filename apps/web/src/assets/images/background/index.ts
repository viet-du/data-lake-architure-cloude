import backgroundDarkUrl from './background-dark.png';
import backgroundLightUrl from './background-light.png';

export type EBackgroundVariant = 'dark' | 'light';

export const BACKGROUNDS: Readonly<Record<EBackgroundVariant, string>> = {
  dark: backgroundDarkUrl,
  light: backgroundLightUrl,
};
