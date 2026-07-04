import { NavLink } from 'react-router-dom';
import { CalendarDays, Film, LayoutDashboard, MoreHorizontal, Users } from 'lucide-react';
import { appPaths } from '../navigation/appPaths';

const items = [
  { to: appPaths.home, icon: LayoutDashboard, label: 'Обзор' },
  { to: appPaths.scenes, icon: Film, label: 'Сцены' },
  { to: appPaths.actors, icon: Users, label: 'Участники' },
  { to: appPaths.rehearsals, icon: CalendarDays, label: 'Репетиции' },
] as const;

interface MobileBottomNavProps {
  variant?: 'theater' | 'zen';
  onMoreClick?: () => void;
}

export function MobileBottomNav({ variant = 'theater', onMoreClick }: MobileBottomNavProps) {
  const isZen = variant === 'zen';

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-40 border-t lg:hidden ${
        isZen
          ? 'border-border/60 bg-background/95 backdrop-blur-xl'
          : 'border-gold/10 bg-surface/95 backdrop-blur-md'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Основная навигация"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === appPaths.home}
            className={({ isActive }) =>
              `flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] transition-colors ${
                isActive
                  ? isZen
                    ? 'font-semibold text-foreground'
                    : 'font-semibold text-gold-light'
                  : 'text-muted hover:text-foreground'
              }`
            }
          >
            <Icon size={20} strokeWidth={1.75} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMoreClick}
          className="flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] text-muted transition-colors hover:text-foreground"
          aria-label="Ещё разделы"
        >
          <MoreHorizontal size={20} strokeWidth={1.75} />
          <span>Ещё</span>
        </button>
      </div>
    </nav>
  );
}
