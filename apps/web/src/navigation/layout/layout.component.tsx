import { useCallback, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AmbientLayer,
  BackgroundLayer,
  CommandPalette,
  RouteTransition,
  SkipLink,
  ToastContainer,
  TopBar,
} from '@/components';
import { LanguageToggle } from '@/navigation/header/language-toggle.component';
import { ThemeToggle } from '@/navigation/header/theme-toggle.component';
import { NavRail } from '@/navigation/rail/nav-rail.component';
import { SearchBox } from '@/navigation/header/search-box.component';
import { useUiStore } from '@/store';
import { useHotkey } from '@/hooks';
import { cn } from '@/theme';
import type { LayoutProps, NavRailItem } from '@/navigation';
import { useInfoQuery } from '@/services/queries';

const RAIL_WIDTH_EXPANDED = 'w-20';
const RAIL_WIDTH_COLLAPSED = 'w-0';

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const info = useInfoQuery();
  const navigate = useNavigate();
  const sidebar = useUiStore((s) => s.sidebar);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');

  const handleSearch = useCallback((value: string): void => {
    setSearchValue(value);
  }, []);

  const handleSelect = useCallback(
    (item: NavRailItem): void => {
      navigate(item.path);
    },
    [navigate],
  );

  const title = useMemo(() => t('app.name'), [t]);

  useHotkey({ cmd: true, key: 'b' }, () => toggleSidebar());
  useHotkey({ cmd: true, key: 'k' }, () => setPaletteOpen((v) => !v));

  const railWidth = sidebar === 'expanded' ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COLLAPSED;

  return (
    <div className="relative flex h-screen w-screen overflow-hidden">
      <SkipLink targetId="main-content" />
      <AmbientLayer />
      <BackgroundLayer />
      <div className="relative z-10 flex h-full w-full">
        <aside
          className={cn(
            'h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-out',
            railWidth,
          )}
          aria-label="Primary navigation rail"
        >
          <div className="h-full w-20">
            <NavRail
              activePath={location.pathname as NavRailItem['path']}
              onSelect={handleSelect}
            />
          </div>
        </aside>
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            title={title}
            searchSlot={
              <SearchBox
                value={searchValue}
                onChange={handleSearch}
                placeholder={t('header.search_placeholder', 'Search tables, topics, DAGs…')}
              />
            }
            rightSlot={
              <>
                <LanguageToggle />
                <ThemeToggle />
              </>
            }
          />
          <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
            {info.data?.dataSource === 'databricks' ? <div role="status" className="mx-6 mt-4 rounded-xl border border-primary-500/30 bg-primary-500/10 p-3 text-sm">
              <p className="font-semibold">{t('databricks.source', { catalog: info.data.catalog })}</p>
              <p className="mt-1 text-xs">{t('databricks.readOnly')}</p>
            </div> : null}
            <RouteTransition>
              {children ?? <Outlet />}
            </RouteTransition>
          </main>
        </div>
      </div>
      <ToastContainer position="top-right" />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
