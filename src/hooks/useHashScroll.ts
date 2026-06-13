import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useHashScroll(deps: unknown[] = []) {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname, ...deps]);
}
