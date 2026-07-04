const PROMO_PATHS = new Set([
  '/',
  '/pricing',
  '/legal/terms',
  '/legal/privacy',
  '/legal/offer',
]);

const AUTH_PATHS = new Set(['/login', '/verify-email']);

export function isPromoPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  return PROMO_PATHS.has(path);
}

/** Страницы входа всегда в светлой теме Zen (как лендинг) */
export function isAuthPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  return AUTH_PATHS.has(path);
}
