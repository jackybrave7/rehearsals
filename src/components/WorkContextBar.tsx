import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AppLogo } from './AppLogo';
import { useRehearsalStore } from '../store/RehearsalContext';
import { appPaths } from '../navigation/appPaths';
import {
  formatPerformanceLabel,
  getActivePlay,
  getActiveTheater,
  getSelectedPerformance,
  getTheaterPlays,
} from '../store/selectors';
import { workContextLinks } from '../navigation/workContextLinks';
import { PlaySwitcherLabel } from './PlaySwitcher';

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
  const playCount = getTheaterPlays(state).length;

  const theaterValue = activeTheater?.name ?? 'Не выбран';
  const performanceValue = performance ? formatPerformanceLabel(performance) : 'Не выбран';

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
          variant === 'zen' ? 'max-w-4xl px-3 py-1.5 sm:px-6' : 'max-w-7xl px-4 py-2 sm:px-5 lg:px-8'
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:text-sm">
          {variant === 'zen' ? (
            <>
              <Link
                to={appPaths.home}
                className="shrink-0 transition-opacity hover:opacity-80"
                aria-label="Репетиции"
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
