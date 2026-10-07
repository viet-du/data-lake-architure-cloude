import type { LinkProps } from 'react-router-dom';
import { ROUTES } from './routes';

export interface AppLinkProps extends Omit<LinkProps, 'to'> {
  to: keyof typeof ROUTES | (typeof ROUTES)[keyof typeof ROUTES];
}

export const linkingConfig = {
  config: {
    initialRouteName: 'Home' as const,
    screens: {
      Home: '',
      Catalog: 'catalog',
      Bronze: 'bronze',
      Silver: 'silver',
      Gold: 'gold',
      Crawler: 'crawler',
      Kafka: 'kafka',
      Airflow: 'airflow',
      DQ: 'dq',
      Health: 'health',
      Settings: 'settings',
    },
  },
} as const;
