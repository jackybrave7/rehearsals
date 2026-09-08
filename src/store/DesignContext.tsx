import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isAuthPath, isPromoPath } from '../navigation/promoPaths';

export type AppDesign = 'theater' | 'zen';

const STORAGE_KEY = 'rehearsals-design';
const EXPLICIT_KEY = 'rehearsals-design-explicit';

function isDesignExplicit(): boolean {
  try {
    return localStorage.getItem(EXPLICIT_KEY) === '1';
  } catch {
    return false;
  }
}

function readDesign(): AppDesign {
  try {
    if (!isDesignExplicit()) return 'zen';
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'theater') return 'theater';
    if (stored === 'zen') return 'zen';
    return 'zen';
  } catch {
    return 'zen';
  }
}

function persistDesignChoice(design: AppDesign) {
  localStorage.setItem(STORAGE_KEY, design);
  localStorage.setItem(EXPLICIT_KEY, '1');
}

function applyDocumentDesign(design: AppDesign) {
  document.documentElement.dataset.design = design;
}

if (typeof document !== 'undefined') {
  const path = window.location.pathname;
  if (isAuthPath(path) || isPromoPath(path)) applyDocumentDesign('zen');
  else applyDocumentDesign(readDesign());
}

type DesignContextValue = {
  design: AppDesign;
  setDesign: (design: AppDesign) => void;
  isZen: boolean;
};

const DesignContext = createContext<DesignContextValue | null>(null);

export function DesignProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [design, setDesignState] = useState<AppDesign>(readDesign);
  const onPromo = isPromoPath(pathname);
  const onAuth = isAuthPath(pathname);

  const setDesign = useCallback((next: AppDesign) => {
    setDesignState(next);
    try {
      persistDesignChoice(next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (onPromo || onAuth) {
      applyDocumentDesign('zen');
      return;
    }
    applyDocumentDesign(design);
  }, [design, onPromo, onAuth]);

  return (
    <DesignContext.Provider value={{ design, setDesign, isZen: onPromo || onAuth || design === 'zen' }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesign must be used within DesignProvider');
  return ctx;
}
