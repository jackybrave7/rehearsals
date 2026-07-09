import { Link } from 'react-router-dom';
import { CalendarDays, Menu } from 'lucide-react';
import { AppLogo } from './AppLogo';
import { useRehearsalStore } from '../store/RehearsalContext';
import { appPaths } from '../navigation/appPaths';
import {
  formatPerformanceLabel,
  getActivePlay,
  getActiveTheater,
  getSelectedPerformance,
  getActiveTheaterPlays,
} from '../store/selectors';
import { workContextLinks } from '../navigation/workContextLinks';
import { PlaySwitcher, PlaySwitcherLabel } from './PlaySwitcher';

type WorkContextBarProps = {
  variant: 'zen' | 'theater';
  onMenuClick?: () => void;
};

function ContextValue({
  value,
  to,
  muted,
}: {
  value: string;
  to: string;
  muted?: boolean;
}) {
  const className = `inline-flex max-w-[14rem] min-w-0 items-center truncate rounded-md px-1 py-0.5 text-sm font-medium leading-tight transition-colors hover:bg-white/[0.04] hover:text-gold-light sm:max-w-none ${
    muted ? 'text-muted/60 italic font-normal' : 'text-foreground'
  }`;

  return (
    <Link to={to} className={className}>
      {value}
    </Link>
  );
}

export function WorkContextBar({ variant, onMenuClick }: WorkContextBarProps) {
  const { state } = useRehearsalStore();
  const activeTheater = getActiveTheater(state);
  const activePlay = getActivePlay(state);
  const performance = activePlay ? getSelectedPerformance(state, activePlay.id) : undefined;
  const playCount = getActiveTheaterPlays(state).length;

  const theaterValue = activeTheater?.name ?? 'Не выбран';
  const performanceValue = performance ? formatPerformanceLabel(performance) : 'Не выбран';
  const playTitle = activePlay?.title ?? 'Постановка не выбрана';

  return (
    <div
      className={`work-context-bar border-b ${
        variant === 'zen'
          ? 'border-border/50 bg-background/95'
          : 'border-gold/10 bg-surface/50'
      }`}
    >
      <div
        className={`mx-auto flex min-w-0 items-center justify-between gap-2 ${
          variant === 'zen' ? 'max-w-4xl px-3 py-1.5 sm:px-6' : 'max-w-7xl px-3 py-1.5 sm:px-5 lg:px-8 lg:py-2'
        }`}
      >
        {/* Компактная шапка для телефонов */}
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
          {variant === 'zen' ? (
            <Link
              to={appPaths.rehearsals}
              className="shrink-0 transition-opacity hover:opacity-80"
              aria-label="Календарь репетиций"
            >
              <AppLogo size="sm" variant="zen" />
            </Link>
          ) : (
            <Link
              to={appPaths.rehearsals}
              className="shrink-0 rounded-lg p-1.5 text-gold-light transition-colors hover:bg-white/5"
              aria-label="Календарь репетиций"
            >
              <CalendarDays size={18} strokeWidth={1.75} />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            {playCount > 1 ? (
              <div className="min-w-0 [&_select]:max-w-full [&_label]:max-w-full">
                <PlaySwitcher variant={variant} />
              </div>
            ) : (
              <>
                <Link
                  to={workContextLinks.play}
                  className={`block truncate text-sm font-medium leading-tight ${
                    variant === 'zen' ? 'text-foreground' : 'text-gold-light'
                  }`}
                >
                  {activePlay ? `«${playTitle}»` : playTitle}
                </Link>
                <Link
                  to={workContextLinks.theater}
                  className="mt-0.5 block truncate text-[11px] leading-tight text-muted"
                >
                  {theaterValue}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Полные хлебные крошки — планшет и десктоп */}
        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:text-sm lg:flex">
          {variant === 'zen' ? (
            <>
              <Link
                to={appPaths.rehearsals}
                className="shrink-0 transition-opacity hover:opacity-80"
                aria-label="Календарь репетиций"
              >
                <AppLogo size="sm" variant="zen" />
              </Link>
              <span className="shrink-0 text-muted/40" aria-hidden>
                ·
              </span>
            </>
          ) : null}
          <ContextValue
            value={theaterValue}
            to={workContextLinks.theater}
            muted={!activeTheater}
          />
          <span className="shrink-0 text-muted/40" aria-hidden>
            ·
          </span>
          {playCount > 1 ? (
            <PlaySwitcherLabel variant={variant} />
          ) : (
            <ContextValue
              value={activePlay ? `«${activePlay.title}»` : 'Не выбрана'}
              to={workContextLinks.play}
              muted={!activePlay}
            />
          )}
          <span className="hidden shrink-0 text-muted/40 sm:inline" aria-hidden>
            ·
          </span>
          <span className="hidden sm:contents">
            <ContextValue
              value={performanceValue}
              to={workContextLinks.performance}
              muted={!performance}
            />
          </span>
          <span className="shrink-0 text-muted/40" aria-hidden>
            ·
          </span>
          <ContextValue value="Репетиции" to={appPaths.rehearsals} />
        </div>

        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className={`shrink-0 rounded-lg p-2 transition-colors ${
              variant === 'zen'
                ? 'zen-icon-btn zen-icon-btn-sm'
                : 'text-muted hover:bg-white/5 hover:text-white lg:hidden'
            }`}
            aria-label="Открыть меню"
          >
            <Menu size={18} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
