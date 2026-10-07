import { useTranslation } from 'react-i18next';
import { ModuleCard } from './module-card.component';
import type { HomeModuleItem } from './home.types';

export interface ModuleGridProps {
  modules: ReadonlyArray<HomeModuleItem>;
}

export function ModuleGrid({ modules }: ModuleGridProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-black dark:text-white">
            {t('home.modules_section_title')}
          </h3>
          <p className="mt-0.5 text-xs text-black dark:text-white">
            {t('home.modules_section_subtitle')}
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <ModuleCard key={mod.key} module={mod} />
        ))}
      </div>
    </div>
  );
}
