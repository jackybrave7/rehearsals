import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type AppDesign = 'theater' | 'zen';

const STORAGE_KEY = 'rehearsals-design';

function readDesign(): AppDesign {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'zen' ? 'zen' : 'theater';
  } catch {
    return 'theater';
  }
}

if (typeof document !== 'undefined') {
  document.documentElement.dataset.design = readDesign();
}

type DesignContextValue = {
  design: AppDesign;
  setDesign: (design: AppDesign) => void;
  isZen: boolean;
};

const DesignContext = createContext<DesignContextValue | null>(null);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [design, setDesign] = useState<AppDesign>(readDesign);

  useEffect(() => {
    document.documentElement.dataset.design = design;
    try {
      localStorage.setItem(STORAGE_KEY, design);
    } catch {
      // ignore
    }
  }, [design]);

  return (
    <DesignContext.Provider value={{ design, setDesign, isZen: design === 'zen' }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error('useDesign must be used within DesignProvider');
  return ctx;
}
