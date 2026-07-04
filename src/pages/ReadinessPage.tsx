import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Flame, Target } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActivePlay } from '../store/selectors';
import { getSceneShortLabel } from '../utils/sceneLabels';
import {
  buildPlayReadinessReport,
  heatLevelColors,
  heatLevelLabel,
  type SceneHeatLevel,
} from '../utils/sceneReadiness';
import { appPaths } from '../navigation/appPaths';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

const statusLabels = {
  not_started: 'Не начата',
  in_progress: 'В работе',
  ready: 'Готова',
} as const;

const statusColors = {
  not_started: 'bg-white/5 text-muted',
  in_progress: 'bg-amber-500/15 text-amber-200',
  ready: 'bg-emerald-500/15 text-emerald-200',
} as const;

function heatSortOrder(heat: SceneHeatLevel): number {
  if (heat === 'never') return 0;
  if (heat === 'stale') return 1;
  return 2;
}

export function ReadinessPage() {
  const { state } = useRehearsalStore();
  const activePlay = getActivePlay(state);
  const playId = state.activePlayId;

  const report = useMemo(
    () => (playId ? buildPlayReadinessReport(state, playId) : null),
    [state, playId]
  );

  const sortedItems = useMemo(() => {
    if (!report) return [];
    return [...report.items].sort((a, b) => {
      const heatCmp = heatSortOrder(a.heat) - heatSortOrder(b.heat);
      if (heatCmp !== 0) return heatCmp;
      if (a.scene.status !== b.scene.status) {
        if (a.scene.status === 'ready') return 1;
        if (b.scene.status === 'ready') return -1;
      }
      return a.scene.number - b.scene.number;
    });
  }, [report]);

  if (!activePlay || !report) {
    return (
      <div className="space-y-6">
        <header className={pageHeaderClass}>
          <h1 className={pageTitleClass}>Готовность сцен</h1>
        </header>
        <div className="rounded-2xl border border-dashed border-gold/20 p-10 text-center text-muted">
          Выберите постановку, чтобы увидеть прогресс репетиций по сценам.{' '}
          <Link to={appPaths.play} className="text-gold hover:underline">
            К постановкам
          </Link>
        </div>
      </div>
    );
  }

  const progressPercent =
    report.totalCount > 0 ? Math.round((report.readyCount / report.totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Готовность сцен</h1>
          <p className="mt-1 text-sm text-muted">{activePlay.title}</p>
        </div>
        <Link to={appPaths.scenes} className="text-sm text-gold hover:underline">
          К списку сцен
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 shrink-0 text-gold" size={20} />
            <div>
              <h2 className="text-sm font-semibold text-white">Прогресс к премьере</h2>
              <p className="mt-2 text-3xl font-bold text-gold-light">{progressPercent}%</p>
              <p className="text-sm text-muted">
                {report.readyCount} из {report.totalCount} сцен готовы
              </p>
              {report.premiereDate && (
                <p className="mt-2 text-sm text-muted">
                  Премьера:{' '}
                  <span className="text-white">
                    {format(parseISO(report.premiereDate), 'd MMMM yyyy', { locale: ru })}
                  </span>
                  {report.daysUntilPremiere != null && report.daysUntilPremiere >= 0 && (
                    <span> · через {report.daysUntilPremiere} дн.</span>
                  )}
                </p>
              )}
              <p
                className={`mt-3 text-sm font-medium ${
                  report.onTrackForPremiere === true
                    ? 'text-emerald-300'
                    : report.onTrackForPremiere === false
                      ? 'text-amber-300'
                      : 'text-muted'
                }`}
              >
                {report.onTrackLabel}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
          <div className="flex items-start gap-3">
            <Flame className="mt-0.5 shrink-0 text-amber-400" size={20} />
            <div>
              <h2 className="text-sm font-semibold text-white">Тепловая карта</h2>
              <p className="mt-1 text-xs text-muted">
                Красный — не репетировали, жёлтый — давно не брали (&gt;14 дн.), зелёный — недавно.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {report.items.map((item) => (
                  <span
                    key={item.scene.id}
                    title={`${getSceneShortLabel(item.scene)} — ${heatLevelLabel(item.heat)}`}
                    className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 text-xs font-semibold ${heatLevelColors(item.heat)}`}
                  >
                    {item.scene.number}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-gold/10 bg-surface/40">
        <div className="border-b border-gold/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-gold-light">Сцены по приоритету внимания</h2>
        </div>
        <div className="divide-y divide-gold/5">
          {sortedItems.map((item) => (
            <div
              key={item.scene.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-white">
                  <span className="mr-2 text-gold">#{item.scene.number}</span>
                  {getSceneShortLabel(item.scene)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Репетиций: {item.rehearsalCount}
                  {item.lastRehearsalDate
                    ? ` · последняя ${format(parseISO(item.lastRehearsalDate), 'd MMM', { locale: ru })}`
                    : ' · ещё не репетировали'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${heatLevelColors(item.heat)}`}
                >
                  {heatLevelLabel(item.heat)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusColors[item.status]}`}
                >
                  {statusLabels[item.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
