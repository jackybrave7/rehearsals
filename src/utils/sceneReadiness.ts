import { differenceInCalendarDays, parseISO, subDays } from 'date-fns';
import type { AppState, Performance, Rehearsal, Scene, SceneStatus } from '../types';
import { getPlayScenes, getPlayRehearsals } from '../store/selectors';
import { isRehearsalPast } from './rehearsalSort';
import { getSceneIdsFromSchedule } from './scheduleSync';

export type SceneHeatLevel = 'never' | 'stale' | 'recent';

export interface SceneReadinessItem {
  scene: Scene;
  rehearsalCount: number;
  lastRehearsalDate: string | null;
  heat: SceneHeatLevel;
  status: SceneStatus;
}

export interface PlayReadinessReport {
  items: SceneReadinessItem[];
  readyCount: number;
  totalCount: number;
  premiereDate: string | null;
  premierePerformance: Performance | null;
  daysUntilPremiere: number | null;
  onTrackForPremiere: boolean | null;
  onTrackLabel: string;
}

const STALE_DAYS = 14;

function getSceneIdsInRehearsal(rehearsal: Rehearsal): Set<string> {
  const ids = new Set<string>();
  for (const sceneId of rehearsal.sceneIds) ids.add(sceneId);
  for (const sceneId of getSceneIdsFromSchedule(rehearsal.schedule)) ids.add(sceneId);
  return ids;
}

function buildSceneRehearsalStats(
  rehearsals: Rehearsal[]
): Map<string, { count: number; lastDate: string | null }> {
  const stats = new Map<string, { count: number; lastDate: string | null }>();

  for (const rehearsal of rehearsals) {
    if (!isRehearsalPast(rehearsal)) continue;
    for (const sceneId of getSceneIdsInRehearsal(rehearsal)) {
      const current = stats.get(sceneId) ?? { count: 0, lastDate: null };
      current.count += 1;
      if (!current.lastDate || rehearsal.date > current.lastDate) {
        current.lastDate = rehearsal.date;
      }
      stats.set(sceneId, current);
    }
  }

  return stats;
}

export function resolveSceneHeat(lastDate: string | null, today = new Date()): SceneHeatLevel {
  if (!lastDate) return 'never';
  const days = differenceInCalendarDays(today, parseISO(lastDate));
  if (days > STALE_DAYS) return 'stale';
  return 'recent';
}

export function heatLevelLabel(heat: SceneHeatLevel): string {
  if (heat === 'never') return 'Не репетировали';
  if (heat === 'stale') return 'Давно не брали';
  return 'Недавно';
}

export function heatLevelColors(heat: SceneHeatLevel): string {
  if (heat === 'never') return 'bg-rose-500/20 text-rose-200 border-rose-500/30';
  if (heat === 'stale') return 'bg-amber-500/20 text-amber-200 border-amber-500/30';
  return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30';
}

function resolvePremierePerformance(state: AppState, playId: string): Performance | null {
  const performances = state.performances.filter((item) => item.playId === playId);
  if (performances.length === 0) return null;
  const selectedId = state.selectedPerformanceByPlayId?.[playId];
  if (selectedId) {
    const selected = performances.find((item) => item.id === selectedId);
    if (selected) return selected;
  }
  return performances.find((item) => item.isDefault) ?? performances[0];
}

function estimateWeeklyRehearsalPace(rehearsals: Rehearsal[], today = new Date()): number {
  const since = subDays(today, 28);
  const recent = rehearsals.filter((rehearsal) => {
    const date = parseISO(rehearsal.date);
    return date >= since && date <= today;
  });
  if (recent.length === 0) return 0;
  return recent.length / 4;
}

export function buildPlayReadinessReport(state: AppState, playId: string): PlayReadinessReport {
  const scenes = getPlayScenes(state, playId);
  const rehearsals = getPlayRehearsals(state, playId);
  const stats = buildSceneRehearsalStats(rehearsals);
  const today = new Date();

  const items: SceneReadinessItem[] = scenes.map((scene) => {
    const sceneStats = stats.get(scene.id) ?? { count: 0, lastDate: null };
    return {
      scene,
      rehearsalCount: sceneStats.count,
      lastRehearsalDate: sceneStats.lastDate,
      heat: resolveSceneHeat(sceneStats.lastDate, today),
      status: scene.status,
    };
  });

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const premierePerformance = resolvePremierePerformance(state, playId);
  const premiereDate = premierePerformance?.date ?? null;
  const daysUntilPremiere =
    premiereDate != null ? differenceInCalendarDays(parseISO(premiereDate), today) : null;

  const notReady = items.filter((item) => item.status !== 'ready').length;
  let onTrackForPremiere: boolean | null = null;
  let onTrackLabel = 'Дата премьеры не задана';

  if (premiereDate && daysUntilPremiere != null) {
    if (notReady === 0) {
      onTrackForPremiere = true;
      onTrackLabel = 'Все сцены готовы';
    } else if (daysUntilPremiere < 0) {
      onTrackForPremiere = false;
      onTrackLabel = 'Премьера уже прошла';
    } else {
      const weeklyPace = estimateWeeklyRehearsalPace(rehearsals, today);
      if (weeklyPace <= 0) {
        onTrackForPremiere = false;
        onTrackLabel = 'Нет недавних репетиций для прогноза';
      } else {
        const weeksNeeded = notReady / weeklyPace;
        const daysNeeded = Math.ceil(weeksNeeded * 7);
        onTrackForPremiere = daysNeeded <= daysUntilPremiere;
        onTrackLabel = onTrackForPremiere
          ? `Успеете к премьере (≈${daysNeeded} дн. на ${notReady} сцен)`
          : `Рискуете не успеть (нужно ≈${daysNeeded} дн., осталось ${daysUntilPremiere})`;
      }
    }
  }

  return {
    items,
    readyCount,
    totalCount: items.length,
    premiereDate,
    premierePerformance,
    daysUntilPremiere,
    onTrackForPremiere,
    onTrackLabel,
  };
}
