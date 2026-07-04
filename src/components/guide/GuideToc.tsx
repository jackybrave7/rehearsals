import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDesign } from '../../store/DesignContext';

export interface TocItem {
  id: string;
  title: string;
  level: 2 | 3;
}

interface GuideTocProps {
  items: TocItem[];
  activeId: string | null;
  onNavigate: (id: string) => void;
  mobile?: boolean;
}

export function GuideToc({ items, activeId, onNavigate, mobile = false }: GuideTocProps) {
  const { isZen } = useDesign();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const linkClass = (id: string, level: 2 | 3) => {
    const active = activeId === id;
    const base =
      level === 3 ? 'block py-1.5 pl-4 text-sm' : 'block py-1.5 text-sm font-medium';
    if (isZen) {
      return `${base} rounded-lg px-2 transition-colors ${
        active ? 'bg-black/[0.06] text-foreground' : 'text-muted hover:bg-black/[0.03] hover:text-foreground'
      }`;
    }
    return `${base} rounded-lg px-2 transition-colors ${
      active ? 'bg-gold/15 text-gold-light' : 'text-muted hover:bg-white/5 hover:text-foreground'
    }`;
  };

  const nav = (
    <nav aria-label="Содержание руководства">
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={linkClass(item.id, item.level)}
              onClick={(event) => {
                event.preventDefault();
                onNavigate(item.id);
                setMobileOpen(false);
              }}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );

  if (mobile) {
    return (
      <div className="lg:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
            isZen ? 'border-border/70 bg-white' : 'border-gold/15 bg-surface/60'
          }`}
        >
          Содержание
          <ChevronDown size={16} className={`transition-transform ${mobileOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobileOpen && (
          <div
            className={`mt-2 max-h-[50vh] overflow-y-auto rounded-xl border p-3 ${
              isZen ? 'border-border/70 bg-white' : 'border-gold/15 bg-surface/80'
            }`}
          >
            {nav}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="hidden lg:block">
      <div
        className={`sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border p-4 ${
          isZen ? 'border-border/70 bg-white' : 'border-gold/10 bg-surface/50'
        }`}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Содержание</p>
        {nav}
      </div>
    </aside>
  );
}
