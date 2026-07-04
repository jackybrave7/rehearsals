import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Flame, Target } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useDesign } from '../store/DesignContext';
import { getActivePlay } from '../store/selectors';
import { getSceneShortLabel } from '../utils/sceneLabels';
import {
  buildPlayReadinessReport,
  heatLevelColors,
  heatLevelLabel,
  readinessStatusColors,
  type SceneHeatLevel,
} from '../utils/sceneReadiness';
import { buildSceneMemorizationSummary } from '../utils/sceneMemorizationReadiness';
import { appPaths } from '../navigation/appPaths';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

const statusLabels = {
  not_started: 'Не начата',
  in_progress: 'В работе',
  ready: 'Готова',
} as const;

function cardClass(variant: 'theater' | 'zen') {
  return variant === 'zen'
    ? 'zen-card p-5'
    : 'rounded-2xl border border-gold/10 bg-surface/40 p-5';
}

function heatSortOrder(heat: SceneHeatLevel): number {
  if (heat === 'never') return 0;
  if (heat === 'stale') return 1;
  return 2;
}

export function ReadinessPage() {
  const { state } = useRehearsalStore();
  const { isZen } = useDesign();
  const variant = isZen ? 'zen' : 'theater';
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
        <Link to={appPaths.scenes} className={`text-sm font-medium hover:underline ${isZen ? 'text-foreground' : 'text-gold'}`}>
          К списку сцен
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cardClass(variant)}>
          <div className="flex items-start gap-3">
            <Target className={`mt-0.5 shrink-0 ${isZen ? 'text-accent' : 'text-gold'}`} size={20} />
            <div>
              <h2 className={`text-sm font-semibold ${isZen ? 'text-foreground' : 'text-white'}`}>
                Прогресс к премьере
              </h2>
              <p className={`mt-2 text-3xl font-bold ${isZen ? 'text-foreground' : 'text-gold-light'}`}>
                {progressPercent}%
              </p>
              <p className="text-sm text-muted">
                {report.readyCount} из {report.totalCount} сцен готовы
              </p>
              {report.premiereDate && (
                <p className="mt-2 text-sm text-muted">
                  Премьера:{' '}
                  <span className={isZen ? 'font-medium text-foreground' : 'text-white'}>
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
                    ? isZen
                      ? 'text-emerald-800'
                      : 'text-emerald-300'
                    : report.onTrackForPremiere === false
                      ? isZen
                        ? 'text-amber-900'
                        : 'text-amber-300'
                      : 'text-muted'
                }`}
              >
                {report.onTrackLabel}
              </p>
            </div>
          </div>
        </section>

        <section className={cardClass(variant)}>
          <div className="flex items-start gap-3">
            <Flame className={`mt-0.5 shrink-0 ${isZen ? 'text-amber-700' : 'text-amber-400'}`} size={20} />
            <div>
              <h2 className={`text-sm font-semibold ${isZen ? 'text-foreground' : 'text-white'}`}>
                Тепловая карта
              </h2>
              <p className="mt-1 text-xs text-muted">
                Красный — не репетировали, жёлтый — давно не брали (&gt;14 дн.), зелёный — недавно.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {report.items.map((item) => (
                  <span
                    key={item.scene.id}
                    title={`${getSceneShortLabel(item.scene)} — ${heatLevelLabel(item.heat)}`}
                    className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border px-2 text-xs font-bold ${heatLevelColors(item.heat, variant)}`}
                  >
                    {item.scene.number}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className={isZen ? 'zen-card overflow-hidden' : 'rounded-2xl border border-gold/10 bg-surface/40'}>
        <div className={`border-b px-5 py-3 ${isZen ? 'border-border/60' : 'border-gold/10'}`}>
          <h2 className={`text-sm font-semibold ${isZen ? 'text-foreground' : 'text-gold-light'}`}>
            Сцены по приоритету внимания
          </h2>
        </div>
        <div className={isZen ? 'divide-y divide-border/40' : 'divide-y divide-gold/5'}>
          {sortedItems.map((item) => {
            const memorizationSummary = buildSceneMemorizationSummary(state, item.scene.id);
            return (
            <div
              key={item.scene.id}
              className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className={`font-medium ${isZen ? 'text-foreground' : 'text-white'}`}>
                  <span className={`mr-2 ${isZen ? 'text-muted' : 'text-gold'}`}>#{item.scene.number}</span>
                  {getSceneShortLabel(item.scene)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Репетиций: {item.rehearsalCount}
                  {item.lastRehearsalDate
                    ? ` · последняя ${format(parseISO(item.lastRehearsalDate), 'd MMM', { locale: ru })}`
                    : ' · ещё не репетировали'}
                </p>
                {memorizationSummary && (
                  <p className={`mt-1 text-xs ${isZen ? 'text-foreground/80' : 'text-gold-light/90'}`}>
                    Заучивание: {memorizationSummary}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${heatLevelColors(item.heat, variant)}`}
                >
                  {heatLevelLabel(item.heat)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${readinessStatusColors(item.status, variant)}`}
                >
                  {statusLabels[item.status]}
                </span>
              </div>
            </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
