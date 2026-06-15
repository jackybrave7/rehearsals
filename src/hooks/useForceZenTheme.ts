import { useEffect } from 'react';

/** Welcome/marketing — всегда визуально в стиле «Дзен», без смены сохранённой темы приложения. */
export function useForceZenTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.design ?? 'theater';
    root.dataset.design = 'zen';
    return () => {
      root.dataset.design = previous;
    };
  }, []);
}
