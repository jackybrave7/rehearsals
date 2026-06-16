import { Link } from 'react-router-dom';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Users, Film, CalendarDays, CheckSquare, ArrowRight } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import {
  getActivePlay,
  getPlayScenes,
  getActiveActors,
  getArchivedActors,
  getTheaterPlays,
  getTheaterRehearsals,
  getTheaterTasks,
  getTheaterVenues,
} from '../store/selectors';
import { resolveRehearsalLocation } from '../utils/venue';
import { useDesign } from '../store/DesignContext';
import { ZenDashboard } from '../components/zen/ZenDashboard';
import { PlayOverviewMini } from './OverviewPage';
import { appPaths } from '../navigation/appPaths';

export function DashboardPage() {
  const { isZen } = useDesign();
  const { state } = useRehearsalStore();

  if (isZen) {
    return <ZenDashboard />;
  }
  const activePlay = getActivePlay(state);
  const activeScenes = getPlayScenes(state, state.activePlayId);
  const theaterPlays = getTheaterPlays(state);
  const theaterRehearsals = getTheaterRehearsals(state);
  const theaterTasks = getTheaterTasks(state);
  const theaterVenues = getTheaterVenues(state);
  const today = startOfDay(new Date());

  const upcoming = theaterRehearsals
    .filter((r) => !isAfter(today, parseISO(r.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const openTasks = theaterTasks.filter((t) => !t.completed).length;
  const readyScenes = activeScenes.filter((s) => s.status === 'ready').length;

  const activeActorCount = getActiveActors(state).length;
  const archivedActorCount = getArchivedActors(state).length;

  const stats = [
    { label: 'Сцены', value: activeScenes.length, icon: Film, to: appPaths.scenes, sub: readyScenes ? `${readyScenes} готовы` : undefined },
    { label: 'Репетиции', value: theaterRehearsals.length, icon: CalendarDays, to: appPaths.rehearsals },
    {
      label: 'Участники',
      value: activeActorCount,
      icon: Users,
      to: appPaths.actors,
      sub: archivedActorCount > 0 ? `${archivedActorCount} в архиве` : undefined,
    },
    { label: 'Задачи', value: openTasks, icon: CheckSquare, to: appPaths.tasks, sub: 'открытых' },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Обзор</h1>
        {activePlay ? (
          <p className="mt-1 text-muted">
            «{activePlay.title}» — {activePlay.author}
            {theaterPlays.length > 1 && ` · ${theaterPlays.length} постановок`}
            {readyScenes > 0 && ` · ${readyScenes} сцен готовы`}
          </p>
        ) : (
          <p className="mt-1 text-muted">
            Начните с{' '}
            <Link to={appPaths.play} className="text-gold hover:underline">
              добавления постановки
            </Link>
          </p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to, sub }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-2xl border border-gold/10 bg-surface/60 p-5 transition-colors hover:border-gold/25"
          >
            <div className="flex items-center justify-between">
              <Icon size={22} className="text-gold/70" />
              <ArrowRight size={16} className="card-actions text-muted" />
            </div>
            <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            <p className="text-sm text-muted">
              {label}
              {sub && <span className="text-muted/60"> ({sub})</span>}
            </p>
          </Link>
        ))}
      </div>

      <PlayOverviewMini />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Ближайшие репетиции</h2>
          <Link to={appPaths.rehearsals} className="text-sm text-gold hover:underline">
            Все репетиции
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gold/20 p-8 text-center text-muted">
            Нет запланированных репетиций.{' '}
            <Link to={appPaths.rehearsals} className="text-gold hover:underline">
              Создать
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((r) => {
              const location = resolveRehearsalLocation(r, theaterVenues);
              return (
              <Link
                key={r.id}
                to={appPaths.rehearsal(r.id)}
                className="flex items-center justify-between rounded-xl border border-gold/10 bg-surface/40 px-5 py-4 transition-colors hover:border-gold/25"
              >
                <div>
                  <p className="font-medium text-white capitalize">
                    {format(parseISO(r.date), 'EEEE, d MMMM', { locale: ru })}
                  </p>
                  <p className="text-sm text-muted">
                    {r.startTime}–{r.endTime}
                    {location && ` · ${location}`}
                  </p>
                </div>
                <span className="rounded-full bg-gold/10 px-3 py-1 text-xs text-gold-light">
                  {r.schedule.length} блоков
                </span>
              </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
