import { ChevronDown } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActivePlay, getTheaterPlays } from '../store/selectors';

type PlaySwitcherProps = {
  variant: 'theater' | 'zen';
};

export function PlaySwitcher({ variant }: PlaySwitcherProps) {
  const { state, dispatch, readOnly } = useRehearsalStore();
  const plays = getTheaterPlays(state);

  if (plays.length <= 1) return null;

  const selectClass =
    variant === 'zen'
      ? 'max-w-[12rem] truncate rounded-lg border border-border/60 bg-surface px-2 py-1 text-sm font-medium text-foreground outline-none transition-colors focus:border-accent/40 sm:max-w-none'
      : 'max-w-[11rem] truncate rounded-lg border border-gold/15 bg-background/40 px-2 py-1 text-sm font-medium text-gold-light outline-none transition-colors focus:border-gold/35 sm:max-w-none';

  return (
    <label className="inline-flex min-w-0 items-center gap-1">
      <span className="sr-only">Активная постановка</span>
      <select
        value={state.activePlayId ?? ''}
        disabled={readOnly}
        onChange={(event) =>
          dispatch({ type: 'SET_ACTIVE_PLAY', payload: event.target.value })
        }
        className={selectClass}
        aria-label="Выбрать постановку"
      >
        {plays.map((play) => (
          <option key={play.id} value={play.id}>
            {play.title}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="shrink-0 text-muted" aria-hidden />
    </label>
  );
}

export function PlaySwitcherLabel({ variant }: PlaySwitcherProps) {
  const { state } = useRehearsalStore();
  const plays = getTheaterPlays(state);
  const activePlay = getActivePlay(state);

  if (plays.length <= 1) {
    return (
      <span
        className={
          variant === 'zen'
            ? 'truncate text-sm font-medium text-foreground'
            : 'truncate text-sm font-medium text-gold-light'
        }
      >
        {activePlay ? `«${activePlay.title}»` : 'Не выбрана'}
      </span>
    );
  }

  return <PlaySwitcher variant={variant} />;
}
