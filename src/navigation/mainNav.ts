import {
  BookOpen,
  BookMarked,
  CalendarDays,
  CalendarOff,
  CheckSquare,
  Film,
  Flame,
  LayoutGrid,
  LayoutDashboard,
  MapPin,
  Settings,
  Users,
  LifeBuoy,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';
import { appPaths } from './appPaths';

export type MainNavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  zenLabel?: string;
  /** Показывать только при playCount >= minPlays */
  minPlays?: number;
};

/** Единый порядок: обзор → репетиции → … */
export const mainNavItems: MainNavItem[] = [
  { to: appPaths.home, icon: LayoutDashboard, label: 'Обзор', zenLabel: 'Сейчас' },
  { to: appPaths.rehearsals, icon: CalendarDays, label: 'Репетиции' },
  {
    to: appPaths.overview,
    icon: LayoutGrid,
    label: 'Все постановки',
    zenLabel: 'Постановки',
    minPlays: 2,
  },
  { to: appPaths.play, icon: BookOpen, label: 'Постановки', zenLabel: 'Постановка' },
  { to: appPaths.scenes, icon: Film, label: 'Сцены' },
  { to: appPaths.readiness, icon: Flame, label: 'Готовность', zenLabel: 'Готовность' },
  { to: appPaths.actors, icon: Users, label: 'Участники' },
  { to: appPaths.availability, icon: CalendarOff, label: 'Доступность', zenLabel: 'Доступность' },
  { to: appPaths.venues, icon: MapPin, label: 'Площадки' },
  { to: appPaths.tasks, icon: CheckSquare, label: 'Задачи' },
  { to: appPaths.guide, icon: BookMarked, label: 'Руководство' },
  { to: appPaths.support, icon: LifeBuoy, label: 'Поддержка' },
  { to: appPaths.settings, icon: Settings, label: 'Настройки' },
];

export const actorNavItems: MainNavItem[] = [
  { to: appPaths.my, icon: UserCircle, label: 'Моё', zenLabel: 'Моё' },
  { to: appPaths.actorSettings, icon: Settings, label: 'Настройки' },
  { to: appPaths.support, icon: LifeBuoy, label: 'Поддержка' },
];

export function getNavItemsForUser(playCount: number, actorOnly: boolean): MainNavItem[] {
  if (actorOnly) return actorNavItems;
  return getVisibleMainNavItems(playCount);
}

export function resolveMainNavTitle(pathname: string, variant: 'theater' | 'zen' = 'zen'): string {
  if (pathname === appPaths.my) return 'Моё';
  if (pathname === appPaths.actorSettings) return 'Настройки';
  if (pathname.startsWith(`${appPaths.rehearsals}/`)) return 'Репетиция';
  if (pathname.startsWith(`${appPaths.adminUsers}/`)) return 'Пользователь';
  if (pathname === appPaths.adminUsers) return 'Пользователи';
  if (pathname === appPaths.admin) return 'Админка';
  if (pathname === appPaths.guide) return 'Руководство';
  if (pathname === appPaths.support) return 'Поддержка';
  const item =
    mainNavItems.find((entry) => entry.to === pathname) ??
    actorNavItems.find((entry) => entry.to === pathname);
  if (!item) return 'Репетиции';
  return getMainNavLabel(item, variant);
}

export function getMainNavLabel(item: MainNavItem, variant: 'theater' | 'zen'): string {
  return variant === 'zen' && item.zenLabel ? item.zenLabel : item.label;
}

export function getVisibleMainNavItems(playCount: number): MainNavItem[] {
  return mainNavItems.filter((item) => !item.minPlays || playCount >= item.minPlays);
}

const primaryNavPaths = new Set<string>([
  appPaths.home,
  appPaths.rehearsals,
  appPaths.scenes,
  appPaths.actors,
]);

/** Основные разделы — нижняя навигация и верх выезжающего меню. */
export function getPrimaryNavItems(items: MainNavItem[]): MainNavItem[] {
  return items.filter((item) => primaryNavPaths.has(item.to));
}

/** Редкие разделы — блок «Ещё» в мобильном меню. */
export function getSecondaryNavItems(items: MainNavItem[]): MainNavItem[] {
  return items.filter((item) => !primaryNavPaths.has(item.to));
}
