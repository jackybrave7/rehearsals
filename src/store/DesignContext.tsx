import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { isPromoPath } from '../navigation/promoPaths';

export type AppDesign = 'theater' | 'zen';

const STORAGE_KEY = 'rehearsals-design';

function readDesign(): AppDesign {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'zen' ? 'zen' : 'theater';
  } catch {
    return 'theater';
  }
}

function applyDocumentDesign(design: AppDesign) {
  document.documentElement.dataset.design = design;
}

if (typeof document !== 'undefined') {
  const path = window.location.pathname;
  applyDocumentDesign(isPromoPath(path) ? 'zen' : readDesign());
}

type DesignContextValue = {
  design: AppDesign;
  setDesign: (design: AppDesign) => void;
  isZen: boolean;
};

const DesignContext = createContext<DesignContextValue | null>(null);

export function DesignProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [design, setDesign] = useState<AppDesign>(readDesign);
  const onPromo = isPromoPath(pathname);

  useEffect(() => {
    if (onPromo) {
      applyDocumentDesign('zen');
      return;
    }
    applyDocumentDesign(design);
    try {
      localStorage.setItem(STORAGE_KEY, design);
    } catch {
      // ignore
    }
  }, [design, onPromo]);

  return (
    <DesignContext.Provider value={{ design, setDesign, isZen: onPromo || design === 'zen' }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesign must be used within DesignProvider');
  return ctx;
}
