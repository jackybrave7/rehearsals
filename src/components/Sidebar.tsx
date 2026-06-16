import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Film, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActivePlay, getTheaterPlays } from '../store/selectors';
import { TheaterSwitcher } from './TheaterSwitcher';
import { getMainNavLabel, getVisibleMainNavItems } from '../navigation/mainNav';
import { appPaths } from '../navigation/appPaths';

const SIDEBAR_COLLAPSED_KEY = 'rehearsals-sidebar-collapsed';

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function Sidebar() {
  const { state } = useRehearsalStore();
  const activePlay = getActivePlay(state);
  const visibleNavItems = getVisibleMainNavItems(getTheaterPlays(state).length);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-gold/10 bg-surface/80 transition-[width] duration-200 ${
        collapsed ? 'w-[4.5rem]' : 'w-64'
      }`}
    >
      <div className={`border-b border-gold/10 ${collapsed ? 'px-2 py-4' : 'px-4 py-5'}`}>
        <div className={`flex items-center ${collapsed ? 'flex-col gap-3' : 'gap-3'}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/20 text-gold">
            <Film size={22} />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-gold-light">Репетиции</h1>
              <p className="truncate text-xs text-muted">
                {state.theaters.find((t) => t.id === state.activeTheaterId)?.name ?? 'Выберите театр'}
                {activePlay ? ` · «${activePlay.title}»` : ''}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={`rounded-lg p-2 text-muted transition-colors hover:bg-white/5 hover:text-white ${
              collapsed ? '' : 'ml-auto shrink-0'
            }`}
            title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </div>

      <nav className={`flex-1 space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
        {!collapsed && <TheaterSwitcher variant="sidebar" />}
        {visibleNavItems.map((item) => {
          const { to, icon: Icon } = item;
          const navLabel = getMainNavLabel(item, 'theater');
          return (
          <NavLink
            key={to}
            to={to}
            end={to === appPaths.home}
            title={collapsed ? navLabel : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-lg text-sm transition-colors ${
                collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                isActive
                  ? 'bg-gold/15 text-gold-light'
                  : 'text-muted hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{navLabel}</span>}
          </NavLink>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="border-t border-gold/10 p-4">
          <p className="text-xs text-muted/60">Google Календарь — скоро</p>
        </div>
      )}
    </aside>
  );
}
