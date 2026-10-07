import { Icon } from '@/components';
import { ROUTES, type RoutePath } from '@/navigation/routes';
import { RailItem } from './rail-item.component';
import type { NavRailItem, NavRailProps } from '@/navigation';

const DEFAULT_ITEMS: ReadonlyArray<NavRailItem> = [
  { key: 'home', path: ROUTES.HOME, iconName: 'Home', labelKey: 'nav.home' },
  { key: 'catalog', path: ROUTES.CATALOG, iconName: 'HiveMetastore', labelKey: 'nav.catalog' },
  { key: 'bronze', path: ROUTES.BRONZE, iconName: 'Bronze', labelKey: 'nav.bronze' },
  { key: 'silver', path: ROUTES.SILVER, iconName: 'Silver', labelKey: 'nav.silver' },
  { key: 'gold', path: ROUTES.GOLD, iconName: 'Gold', labelKey: 'nav.gold' },
  { key: 'crawler', path: ROUTES.CRAWLER, iconName: 'Pipeline', labelKey: 'nav.crawler' },
  { key: 'kafka', path: ROUTES.KAFKA, iconName: 'Kafka', labelKey: 'nav.kafka' },
  { key: 'airflow', path: ROUTES.AIRFLOW, iconName: 'Airflow', labelKey: 'nav.airflow' },
  { key: 'dq', path: ROUTES.DQ, iconName: 'Analyst', labelKey: 'nav.dq' },
  { key: 'health', path: ROUTES.HEALTH, iconName: 'Cloud', labelKey: 'nav.health' },
  { key: 'schematic', path: ROUTES.SCHEMATIC, iconName: 'Cloud', labelKey: 'nav.schematic' },
];

export function NavRail({ items = DEFAULT_ITEMS, activePath, onSelect }: NavRailProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className="flex h-full w-20 flex-col items-center gap-2 border-r border-white/5 bg-white/5 py-4 backdrop-blur-xl"
    >
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-cyan-500 shadow-lg shadow-primary-500/30">
        <Icon
          name="Cloud"
          size={28}
          tone="mono"
          alt=""
        />
      </div>

      <div className="h-px w-8 bg-white/10" />

      <div className="flex w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto px-2 py-2">
        {items.map((item) => (
          <RailItem
            key={item.key}
            iconName={item.iconName}
            labelKey={item.labelKey}
            active={item.path === activePath}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </nav>
  );
}

export type { NavRailItem, RoutePath };
