const PROMO_PATHS = new Set([
  '/',
  '/pricing',
  '/login',
  '/verify-email',
  '/legal/terms',
  '/legal/privacy',
  '/legal/offer',
]);

export function isPromoPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  return PROMO_PATHS.has(path);
}
