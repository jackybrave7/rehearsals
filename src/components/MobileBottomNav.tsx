import { NavLink } from 'react-router-dom';
import { CalendarDays, Film, LayoutDashboard, MoreHorizontal, UserCircle, Users } from 'lucide-react';
import { appPaths } from '../navigation/appPaths';
import { useActorNavMode } from '../hooks/useActorNavMode';

const directorItems = [
  { to: appPaths.rehearsals, icon: CalendarDays, label: 'Репетиции', shortLabel: 'Репет.' },
  { to: appPaths.home, icon: LayoutDashboard, label: 'Обзор', shortLabel: 'Обзор' },
  { to: appPaths.scenes, icon: Film, label: 'Сцены', shortLabel: 'Сцены' },
  { to: appPaths.actors, icon: Users, label: 'Участники', shortLabel: 'Люди' },
] as const;

const actorItems = [
  { to: appPaths.my, icon: UserCircle, label: 'Моё', shortLabel: 'Моё' },
] as const;

interface MobileBottomNavProps {
  variant?: 'theater' | 'zen';
  onMoreClick?: () => void;
}

export function MobileBottomNav({ variant = 'theater', onMoreClick }: MobileBottomNavProps) {
  const isZen = variant === 'zen';
  const actorOnly = useActorNavMode();
  const items = actorOnly ? actorItems : directorItems;

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
      <div className="mx-auto grid max-w-lg grid-cols-5 items-stretch">
        {items.map(({ to, icon: Icon, label, shortLabel }) => (
          <NavLink
            key={to}
            to={to}
            end={to === appPaths.home || to === appPaths.my}
            className={({ isActive }) =>
              `flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[9px] leading-tight transition-colors sm:text-[10px] ${
                isActive
                  ? isZen
                    ? 'font-semibold text-foreground'
                    : 'font-semibold text-gold-light'
                  : 'text-muted hover:text-foreground'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.75} className="shrink-0" />
            <span className="max-w-full truncate px-0.5">{shortLabel}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMoreClick}
          className="flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[9px] leading-tight text-muted transition-colors hover:text-foreground sm:text-[10px]"
          aria-label="Ещё разделы"
        >
          <MoreHorizontal size={22} strokeWidth={1.75} className="shrink-0" />
          <span>Ещё</span>
        </button>
      </div>
    </nav>
  );
}
