import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useRehearsalStore } from '../../store/RehearsalContext';
import {
  getActivePlay,
  getPlayScenes,
  getTheaterPlays,
  getTheaterRehearsals,
  getTheaterTasks,
  getTheaterVenues,
  getShowRehearsalWarnings,
} from '../../store/selectors';
import { resolveRehearsalLocation } from '../../utils/venue';
import { RehearsalWarningsPanel } from '../RehearsalWarningsPanel';
import { RehearsalActionsMenu } from '../RehearsalActionsMenu';
import {
  dismissRehearsalWarning,
  getActorScheduleConflicts,
  getRehearsalWarnings,
} from '../../utils/rehearsalInsights';
import { getRehearsalEventTitle } from '../../utils/rehearsalCalendar';
import { appPaths } from '../../navigation/appPaths';
import { PlayOverviewMini } from '../../pages/OverviewPage';

export function ZenDashboard() {
  const { state, dispatch } = useRehearsalStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const activePlay = getActivePlay(state);
  const activeScenes = getPlayScenes(state, state.activePlayId);
  const theaterRehearsals = getTheaterRehearsals(state);
  const theaterTasks = getTheaterTasks(state);
  const theaterVenues = getTheaterVenues(state);
  const theaterPlays = getTheaterPlays(state);
  const today = startOfDay(new Date());

  const nextRehearsal = theaterRehearsals
    .filter((r) => !isAfter(today, parseISO(r.date)))
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const nextRehearsalPlay = nextRehearsal
    ? theaterPlays.find((play) => play.id === nextRehearsal.playId)
    : undefined;

  const nextRehearsalInsights = useMemo(() => {
    if (!nextRehearsal) return { warnings: [], conflicts: [] };
    return {
      warnings: getRehearsalWarnings(state, nextRehearsal),
      conflicts: getActorScheduleConflicts(state, nextRehearsal),
    };
  }, [state, nextRehearsal]);

  const openTasks = theaterTasks.filter((t) => !t.completed).length;
  const showRehearsalWarnings = getShowRehearsalWarnings(state);

  const dismissNextRehearsalWarning = (warningId: string) => {
    if (!nextRehearsal) return;
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: dismissRehearsalWarning(nextRehearsal, warningId),
    });
  };

  const chips = [
    { label: 'Сцены', value: activeScenes.length, to: appPaths.scenes },
    { label: 'Репетиции', value: theaterRehearsals.length, to: appPaths.rehearsals },
    {
      label: 'Участники',
      value: state.actors.filter((a) => a.theaterId === state.activeTheaterId && a.status !== 'archived').length,
      to: appPaths.actors,
    },
  ];

  const moreLinks = [
    { label: 'Постановка', to: appPaths.play, hint: theaterPlays.length ? `${theaterPlays.length} в работе` : 'Добавить' },
    { label: 'Площадки', to: appPaths.venues },
    { label: 'Задачи', to: appPaths.tasks, hint: openTasks ? `${openTasks} открытых` : undefined },
    { label: 'Настройки', to: appPaths.settings },
  ];

  return (
    <div className="space-y-7">
      {!activePlay && (
        <div className="zen-card p-6 text-center">
          <p className="text-muted">Выберите постановку, чтобы начать планирование.</p>
          <Link to={appPaths.play} className="zen-text-link mt-3 inline-flex items-center gap-1 text-sm font-medium">
            К постановкам <ChevronRight size={16} />
          </Link>
        </div>
      )}

      <section className="zen-card zen-card-focus overflow-hidden">
        {nextRehearsal ? (
          <div>
            <Link to={appPaths.rehearsal(nextRehearsal.id)} className="block p-7 transition-transform hover:scale-[1.01]">
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">Сейчас</p>
              <p className="mt-2 text-3xl font-bold capitalize text-foreground">
                {format(parseISO(nextRehearsal.date), 'd MMMM, EEEE', { locale: ru })}
              </p>
              <p className="mt-1 text-base text-muted">
                {nextRehearsal.startTime}–{nextRehearsal.endTime}
                {resolveRehearsalLocation(nextRehearsal, theaterVenues) &&
                  ` · ${resolveRehearsalLocation(nextRehearsal, theaterVenues)}`}
              </p>
              <p className="zen-text-link mt-4 inline-flex items-center gap-1 text-base font-semibold">
                Открыть план <ChevronRight size={16} />
              </p>
            </Link>
            <div className="space-y-4 border-t border-border/60 px-7 pb-7 pt-5">
              <div className="flex justify-end">
                <RehearsalActionsMenu
                  rehearsal={nextRehearsal}
                  title={getRehearsalEventTitle(nextRehearsalPlay?.title)}
                  location={resolveRehearsalLocation(nextRehearsal, theaterVenues)}
                />
              </div>
              {showRehearsalWarnings && (
                <RehearsalWarningsPanel
                  warnings={nextRehearsalInsights.warnings}
                  conflicts={nextRehearsalInsights.conflicts}
                  dismissedIds={nextRehearsal.dismissedWarningIds}
                  onDismiss={dismissNextRehearsalWarning}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">Ближайшее</p>
            <p className="mt-2 text-xl font-semibold text-foreground">Репетиций пока нет</p>
            <Link
              to={appPaths.rehearsals}
              className="zen-primary-btn mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold"
            >
              <Plus size={18} />
              Запланировать
            </Link>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {chips.map(({ label, value, to }) => (
          <Link key={to} to={to} className="zen-chip">
            <span className="text-muted">{label}</span>
            <span className="font-semibold text-foreground">{value}</span>
          </Link>
        ))}
      </div>

      <PlayOverviewMini />

      <section className="zen-card">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex w-full items-center justify-between px-6 py-5 text-left"
        >
          <span className="text-base font-semibold text-foreground">Ещё разделы</span>
          <ChevronDown
            size={18}
            className={`text-muted transition-transform duration-300 ${moreOpen ? 'rotate-180' : ''}`}
          />
        </button>
        <div
          className={`grid transition-all duration-300 ease-out ${
            moreOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 border-t border-border/60 px-3 pb-3 pt-2">
              {moreLinks.map(({ label, to, hint }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-base text-foreground transition-colors hover:bg-black/[0.03]"
                >
                  <span>{label}</span>
                  {hint ? <span className="text-sm text-muted">{hint}</span> : <CalendarDays size={16} className="text-muted" />}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
