import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { useDesign } from '../../store/DesignContext';
import { useRehearsalStore } from '../../store/RehearsalContext';
import { TheaterSwitcher } from '../TheaterSwitcher';
import { WorkContextBar } from '../WorkContextBar';
import { MobileBottomNav } from '../MobileBottomNav';
import { NoTheaterGate } from '../NoTheaterGate';
import { appPaths } from '../../navigation/appPaths';
import { getMainNavLabel, getVisibleMainNavItems } from '../../navigation/mainNav';
import { getTheaterPlays } from '../../store/selectors';

export function ZenShell({
  statusBar,
  reminderBanner,
  recoveryBar,
}: {
  statusBar: ReactNode;
  reminderBanner?: ReactNode;
  recoveryBar?: ReactNode;
}) {
  const { design } = useDesign();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { state } = useRehearsalStore();
  const visibleNavItems = getVisibleMainNavItems(getTheaterPlays(state).length);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <div className="zen-shell flex min-h-screen flex-col bg-background">
      <header className="zen-header sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        {statusBar}
        {reminderBanner}
        {recoveryBar}
        <WorkContextBar variant="zen" onMenuClick={() => setMenuOpen(true)} />
      </header>

      <main className="zen-main flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div key={`${design}-${location.pathname}`} className="zen-page mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-6">
          <NoTheaterGate />
        </div>
      </main>

      <MobileBottomNav variant="zen" onMoreClick={() => setMenuOpen(true)} />

      {menuOpen && (
        <div className="zen-overlay fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            aria-label="Закрыть меню"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="zen-drawer absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Меню</p>
                <p className="text-xs text-muted">Театр и разделы</p>
              </div>
              <button type="button" className="zen-icon-btn" onClick={() => setMenuOpen(false)} aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>
            <TheaterSwitcher variant="zen" onTheaterChange={() => setMenuOpen(false)} />
            <div className="px-4 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted">Разделы</div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {visibleNavItems.map(({ to, icon: Icon, label, zenLabel }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === appPaths.home}
                  className={({ isActive }) =>
                    `zen-nav-link flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all ${
                      isActive ? 'zen-nav-link-active' : 'text-muted hover:bg-black/[0.03] hover:text-foreground'
                    }`
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  {getMainNavLabel({ to, icon: Icon, label, zenLabel }, 'zen')}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
