import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Film,
  LayoutDashboard,
  MapPin,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { appPaths } from './appPaths';

export type MainNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  zenLabel?: string;
};

/** Единый порядок: обзор → постановка → сцены → люди → репетиции → площадки → задачи → настройки */
export const mainNavItems: MainNavItem[] = [
  { to: appPaths.home, icon: LayoutDashboard, label: 'Обзор', zenLabel: 'Сейчас' },
  { to: appPaths.play, icon: BookOpen, label: 'Постановки', zenLabel: 'Постановка' },
  { to: appPaths.scenes, icon: Film, label: 'Сцены' },
  { to: appPaths.actors, icon: Users, label: 'Участники' },
  { to: appPaths.rehearsals, icon: CalendarDays, label: 'Репетиции' },
  { to: appPaths.venues, icon: MapPin, label: 'Площадки' },
  { to: appPaths.tasks, icon: CheckSquare, label: 'Задачи' },
  { to: appPaths.settings, icon: Settings, label: 'Настройки' },
];

export function resolveMainNavTitle(pathname: string, variant: 'theater' | 'zen' = 'zen'): string {
  if (pathname.startsWith(`${appPaths.rehearsals}/`)) return 'Репетиция';
  const item = mainNavItems.find((entry) => entry.to === pathname);
  if (!item) return 'Репетиции';
  return getMainNavLabel(item, variant);
}

export function getMainNavLabel(item: MainNavItem, variant: 'theater' | 'zen'): string {
  return variant === 'zen' && item.zenLabel ? item.zenLabel : item.label;
}
