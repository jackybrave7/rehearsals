import { Link, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useActorNavMode } from '../hooks/useActorNavMode';
import { appPaths } from '../navigation/appPaths';
import { getNextTheaterRehearsal } from '../utils/directorDashboard';
import { getLastRehearsalVisit } from '../utils/lastRehearsalVisit';
import { getTheaterRehearsals } from '../store/selectors';
import {
  isRehearsalDetailPath,
  shouldShowMobileQuickAccess,
} from '../navigation/mobileChrome';

type RehearsalQuickAccessBarProps = {
  variant: 'zen' | 'theater';
};

export function RehearsalQuickAccessBar({ variant }: RehearsalQuickAccessBarProps) {
  const { pathname } = useLocation();
  const { state } = useRehearsalStore();
  const actorOnly = useActorNavMode();

  if (actorOnly || isRehearsalDetailPath(pathname)) return null;

  const nextRehearsal = getNextTheaterRehearsal(state);
  const lastVisit = getLastRehearsalVisit(state.activeTheaterId);
  const lastRehearsal = lastVisit
    ? getTheaterRehearsals(state).find((item) => item.id === lastVisit.rehearsalId)
    : undefined;
  const showContinue =
    lastRehearsal && (!nextRehearsal || lastRehearsal.id !== nextRehearsal.id);

  if (!nextRehearsal && !showContinue) return null;

  const isZen = variant === 'zen';
  const hideOnMobile = !shouldShowMobileQuickAccess(pathname);
  const mobileTarget = nextRehearsal ?? lastRehearsal;
  const mobileLabel = nextRehearsal
    ? 'Ближайшая'
    : showContinue
      ? 'Продолжить'
      : '';

  const formatShort = (date: string, startTime: string) =>
    `${format(parseISO(date), 'EEE, d MMM', { locale: ru })} · ${startTime}`;

  const shellClass = isZen
    ? 'border-b border-border/40 bg-black/[0.02]'
    : 'border-b border-gold/10 bg-gold/[0.04]';

  return (
    <>
      {/* Телефон: одна строка-чип */}
      {mobileTarget && mobileLabel ? (
        <div className={`${shellClass} ${hideOnMobile ? 'hidden' : 'lg:hidden'}`}>
          <div className={`mx-auto px-3 py-1 ${isZen ? 'max-w-4xl' : 'max-w-7xl'}`}>
            <Link
              to={appPaths.rehearsal(mobileTarget.id)}
              className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                isZen
                  ? 'text-foreground hover:bg-black/[0.04]'
                  : 'text-gold-light hover:bg-gold/10'
              }`}
            >
              <CalendarDays size={14} className="shrink-0 opacity-80" aria-hidden />
              <span className="min-w-0 truncate">
                {mobileLabel}: {formatShort(mobileTarget.date, mobileTarget.startTime)}
              </span>
              <ChevronRight size={14} className="ml-auto shrink-0 opacity-60" aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}

      {/* Десктоп: полная плашка */}
      <div className={`${shellClass} hidden lg:block`}>
        <div
          className={`mx-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-5 py-1.5 text-sm ${
            isZen ? 'max-w-4xl sm:px-6' : 'max-w-7xl lg:px-8'
          }`}
        >
          <CalendarDays
            size={14}
            className={`shrink-0 ${isZen ? 'text-muted' : 'text-gold-light/80'}`}
            aria-hidden
          />
          {nextRehearsal ? (
            <Link
              to={appPaths.rehearsal(nextRehearsal.id)}
              className={`inline-flex min-w-0 items-center gap-1 font-medium transition-colors ${
                isZen ? 'text-foreground hover:text-gold' : 'text-gold-light hover:text-white'
              }`}
            >
              <span className="truncate">
                Ближайшая: {formatShort(nextRehearsal.date, nextRehearsal.startTime)}
              </span>
              <ChevronRight size={14} className="shrink-0 opacity-70" />
            </Link>
          ) : null}
          {showContinue && lastRehearsal ? (
            <Link
              to={appPaths.rehearsal(lastRehearsal.id)}
              className={`inline-flex min-w-0 items-center gap-1 transition-colors ${
                isZen ? 'text-muted hover:text-foreground' : 'text-muted hover:text-gold-light'
              }`}
            >
              <span className="truncate">
                Продолжить: {formatShort(lastRehearsal.date, lastRehearsal.startTime)}
              </span>
              <ChevronRight size={14} className="shrink-0 opacity-70" />
            </Link>
          ) : null}
          <Link
            to={appPaths.rehearsals}
            className={`ml-auto shrink-0 transition-colors ${
              pathname === appPaths.rehearsals
                ? isZen
                  ? 'text-foreground'
                  : 'text-gold-light'
                : isZen
                  ? 'text-muted hover:text-foreground'
                  : 'text-muted hover:text-gold-light'
            }`}
          >
            Календарь
          </Link>
        </div>
      </div>
    </>
  );
}
