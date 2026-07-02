import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Сбрасывает прокрутку при переходе между страницами (SPA). */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
