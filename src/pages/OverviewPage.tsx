import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, CheckSquare, Film } from 'lucide-react';
import { useMemo } from 'react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getPlayOverviews, type PlayOverview } from '../store/playOverview';
import { getPremiereBadgeTone, isPremierePerformance } from '../utils/premiere';
import { appPaths } from '../navigation/appPaths';
import { useDesign } from '../store/DesignContext';
import { PlayIcon } from '../components/PlayIcon';
import { resolveAssetUrl } from '../utils/fileUrls';

function premiereBadgeClass(tone: ReturnType<typeof getPremiereBadgeTone>): string {
  if (tone === 'urgent') return 'bg-red-500/15 text-red-200 ring-1 ring-red-500/30';
  if (tone === 'gold') return 'bg-gold/20 text-gold-light ring-1 ring-gold/35';
  return 'bg-white/5 text-muted ring-1 ring-white/10';
}

function PlayOverviewCard({
  overview,
  onOpenPlay,
}: {
  overview: PlayOverview;
  onOpenPlay: (playId: string) => void;
}) {
  const { isZen } = useDesign();
  const cardClass = isZen ? 'zen-card p-5' : 'rounded-2xl border border-gold/10 bg-surface/40 p-5';
  const { play, premiere, scenes, nextRehearsal, rehearsalsCount, openTasks, staleScenes } = overview;
  const coverSrc = resolveAssetUrl(play.coverUrl);

  return (
    <article
      className={`${cardClass} flex cursor-pointer flex-col gap-4 overflow-hidden transition-colors hover:border-gold/25`}
      onClick={() => onOpenPlay(play.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenPlay(play.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {coverSrc && (
        <img src={coverSrc} alt="" className="-mx-5 -mt-5 mb-1 aspect-video w-[calc(100%+2.5rem)] object-cover" />
      )}
      <div className="flex items-start gap-3">
        <PlayIcon play={play} size="md" className="shrink-0" />
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold text-white">{play.title}</h2>
          <p className="text-sm text-muted">{play.author}</p>
        </div>
      </div>

      {premiere ? (
        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${premiereBadgeClass(
            getPremiereBadgeTone(premiere.daysLeft)
          )}`}
        >
          {isPremierePerformance(premiere.performance)
            ? `До премьеры ${premiere.daysLeft} дн.`
            : `${premiere.performance.name} через ${premiere.daysLeft} дн.`}{' '}
          · {format(parseISO(premiere.date), 'd MMMM yyyy', { locale: ru })}
        </span>
      ) : (
        <Link
          to={appPaths.playCast}
          onClick={(event) => event.stopPropagation()}
          className="text-xs text-gold-light hover:underline"
        >
          Дата показа не задана — указать в расписании
        </Link>
      )}

      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>Готовность сцен</span>
          <span>
            {scenes.ready}/{scenes.total} · {scenes.readyPercent}%
          </span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-white/5">
          {scenes.total > 0 ? (
            <>
              <div
                className="bg-emerald-500/70"
                style={{ width: `${(scenes.ready / scenes.total) * 100}%` }}
              />
              <div
                className="bg-amber-500/70"
                style={{ width: `${(scenes.inProgress / scenes.total) * 100}%` }}
              />
              <div
                className="bg-gray-500/50"
                style={{ width: `${(scenes.notStarted / scenes.total) * 100}%` }}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {nextRehearsal ? (
          <Link
            to={appPaths.rehearsal(nextRehearsal.id)}
            onClick={(event) => event.stopPropagation()}
            className="rounded-full bg-white/5 px-2.5 py-1 text-muted hover:bg-gold/10 hover:text-gold-light"
          >
            <CalendarDays size={12} className="mr-1 inline" />
            {format(parseISO(nextRehearsal.date), 'd MMM', { locale: ru })} {nextRehearsal.startTime}
          </Link>
        ) : (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-muted">Нет будущих репетиций</span>
        )}
        <Link
          to={appPaths.rehearsals}
          onClick={(event) => event.stopPropagation()}
          className="rounded-full bg-white/5 px-2.5 py-1 text-muted hover:bg-gold/10 hover:text-gold-light"
        >
          {rehearsalsCount} репет.
        </Link>
        <Link
          to={appPaths.tasks}
          onClick={(event) => event.stopPropagation()}
          className="rounded-full bg-white/5 px-2.5 py-1 text-muted hover:bg-gold/10 hover:text-gold-light"
        >
          <CheckSquare size={12} className="mr-1 inline" />
          {openTasks} задач
        </Link>
        {staleScenes > 0 && (
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-200">
            {staleScenes} сцен давно не репетировались
          </span>
        )}
      </div>
    </article>
  );
}

export function PlayOverviewMini() {
  const { state } = useRehearsalStore();
  const overviews = useMemo(() => getPlayOverviews(state), [state]);
  const { isZen } = useDesign();
  if (overviews.length < 2) return null;

  const cardClass = isZen ? 'zen-card p-4' : 'rounded-2xl border border-gold/10 bg-surface/40 p-4';

  return (
    <section className={cardClass}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Все постановки</h2>
        <Link to={appPaths.overview} className="text-xs text-gold-light hover:underline">
          Открыть
        </Link>
      </div>
      <ul className="space-y-2 text-sm">
        {overviews.map((overview) => (
          <li key={overview.play.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <PlayIcon play={overview.play} size="sm" className="shrink-0" />
              <span className="truncate font-medium text-white">{overview.play.title}</span>
            </span>
            <span className="shrink-0 text-muted">
              {overview.premiere
                ? isPremierePerformance(overview.premiere.performance)
                  ? `до премьеры ${overview.premiere.daysLeft} дн.`
                  : `${overview.premiere.performance.name} через ${overview.premiere.daysLeft} дн.`
                : 'без даты'}{' '}
              · {overview.scenes.readyPercent}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverviewPage() {
  const { state, dispatch } = useRehearsalStore();
  const navigate = useNavigate();
  const overviews = useMemo(() => getPlayOverviews(state), [state]);
  const { isZen } = useDesign();

  const openPlay = (playId: string) => {
    dispatch({ type: 'SET_ACTIVE_PLAY', payload: playId });
    navigate(appPaths.scenes);
  };

  if (overviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
        <Film size={32} className="mx-auto mb-3 opacity-50" />
        <p>Пока нет постановок.</p>
        <Link to={appPaths.play} className="mt-2 inline-block text-gold-light hover:underline">
          Добавить постановку
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className={`text-3xl font-bold ${isZen ? 'text-foreground' : 'text-white'}`}>
          Все постановки
        </h1>
        <p className="mt-1 text-muted">Сводка по спектаклям театра без переключения активной пьесы</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overviews.map((overview) => (
          <PlayOverviewCard key={overview.play.id} overview={overview} onOpenPlay={openPlay} />
        ))}
      </div>
    </div>
  );
}
