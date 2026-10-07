import type { ReactNode } from 'react';
import type { EIconName } from '@/assets';
import type { RoutePath } from './routes';

export interface NavRailItem {
  key: string;
  path: RoutePath;
  iconName: EIconName;
  labelKey: string;
}

export interface HeaderBarProps {
  title: string;
  subtitle?: string;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  searchValue?: string;
  rightSlot?: ReactNode;
}

export interface LayoutProps {
  children?: ReactNode;
}

export interface RailItemProps {
  iconName: EIconName;
  labelKey: string;
  active: boolean;
  onClick: () => void;
}

export interface NavRailProps {
  items?: ReadonlyArray<NavRailItem>;
  activePath: RoutePath;
  onSelect: (item: NavRailItem) => void;
}

export interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export interface LanguageToggleProps {
  className?: string;
}

export interface ThemeToggleProps {
  className?: string;
}
