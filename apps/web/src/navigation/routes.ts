export const ROUTES = {
  HOME: '/',
  CATALOG: '/catalog',
  BRONZE: '/bronze',
  SILVER: '/silver',
  GOLD: '/gold',
  CRAWLER: '/crawler',
  KAFKA: '/kafka',
  AIRFLOW: '/airflow',
  DQ: '/dq',
  HEALTH: '/health',
  SETTINGS: '/settings',
  SCHEMATIC: '/schematic',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export const NAV_ROUTES: ReadonlyArray<{ path: RoutePath; key: keyof typeof ROUTES }> = [
  { path: ROUTES.HOME, key: 'HOME' },
  { path: ROUTES.CATALOG, key: 'CATALOG' },
  { path: ROUTES.BRONZE, key: 'BRONZE' },
  { path: ROUTES.SILVER, key: 'SILVER' },
  { path: ROUTES.GOLD, key: 'GOLD' },
  { path: ROUTES.CRAWLER, key: 'CRAWLER' },
  { path: ROUTES.KAFKA, key: 'KAFKA' },
  { path: ROUTES.AIRFLOW, key: 'AIRFLOW' },
  { path: ROUTES.DQ, key: 'DQ' },
  { path: ROUTES.HEALTH, key: 'HEALTH' },
  { path: ROUTES.SCHEMATIC, key: 'SCHEMATIC' },
];
