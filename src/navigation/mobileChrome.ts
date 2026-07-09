import { appPaths } from './appPaths';

export function isRehearsalDetailPath(pathname: string): boolean {
  return /^\/app\/rehearsals\/[^/]+$/.test(pathname);
}

/** На телефоне плашку быстрого доступа не показываем там, где уже есть календарь или блок «ближайшая». */
export function shouldShowMobileQuickAccess(pathname: string): boolean {
  if (isRehearsalDetailPath(pathname)) return false;
  if (pathname === appPaths.home || pathname === appPaths.rehearsals) return false;
  return true;
}
