import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { AppLogo } from './AppLogo';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useActorNavMode } from '../hooks/useActorNavMode';
import { getActivePlay, getTheaterPlays } from '../store/selectors';
import { TheaterSwitcher } from './TheaterSwitcher';
import { getMainNavLabel, getNavItemsForUser } from '../navigation/mainNav';
import { appPaths } from '../navigation/appPaths';

const SIDEBAR_COLLAPSED_KEY = 'rehearsals-sidebar-collapsed';

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

type SidebarProps = {
  className?: string;
  /** В выезжающем меню на мобильных — всегда развёрнуто */
  drawer?: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ className = '', drawer = false, onNavigate }: SidebarProps) {
  const { state } = useRehearsalStore();
  const actorOnly = useActorNavMode();
  const activePlay = getActivePlay(state);
  const visibleNavItems = getNavItemsForUser(getTheaterPlays(state).length, actorOnly);
  const [collapsed, setCollapsed] = useState(() => (drawer ? false : readCollapsedPreference()));
  const isCollapsed = drawer ? false : collapsed;

  useEffect(() => {
    if (drawer) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed, drawer]);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-gold/10 bg-surface/80 transition-[width] duration-200 ${
        isCollapsed ? 'w-[4.5rem]' : 'w-64'
      } ${className}`}
    >
      <div className={`border-b border-gold/10 ${isCollapsed ? 'px-2 py-4' : 'px-4 py-5'}`}>
        <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : 'gap-3'}`}>
          <AppLogo size="md" />
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-gold-light">Репетиции</h1>
              <p className="truncate text-xs text-muted">
                {state.theaters.find((t) => t.id === state.activeTheaterId)?.name ?? 'Выберите театр'}
                {activePlay ? ` · «${activePlay.title}»` : ''}
              </p>
            </div>
          )}
          {!drawer ? (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className={`rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white ${
                isCollapsed ? '' : 'ml-auto shrink-0'
              }`}
              title={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
              aria-label={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          ) : null}
        </div>
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {!isCollapsed && (
          <TheaterSwitcher variant="sidebar" onTheaterChange={onNavigate} />
        )}
        {visibleNavItems.map((item) => {
          const { to, icon: Icon } = item;
          const navLabel = getMainNavLabel(item, 'theater');
          return (
          <NavLink
            key={to}
            to={to}
            end={to === appPaths.home || to === appPaths.my}
            title={isCollapsed ? navLabel : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center rounded-lg text-sm transition-colors ${
                isCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-gold/15 text-gold-light'
                  : 'text-muted hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!isCollapsed && <span>{navLabel}</span>}
          </NavLink>
          );
        })}
      </nav>

      {!isCollapsed && (
        <div className="border-t border-gold/10 p-4">
          <p className="text-xs text-muted/60">Google Календарь — скоро</p>
        </div>
      )}
    </aside>
  );
}
