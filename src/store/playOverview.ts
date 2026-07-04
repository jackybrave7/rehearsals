import { differenceInCalendarDays, isAfter, parseISO, startOfDay } from 'date-fns';
import type { AppState, Play, Performance, Rehearsal } from '../types';
import { countOpenTasksByPlay } from '../utils/tasks';
import { getUpcomingPremiere } from '../utils/premiere';
import { rehearsalInvolvesPlay } from '../utils/rehearsalPlays';
import { getTheaterPlays } from './selectors';

export interface PlayOverview {
  play: Play;
  premiere?: { performance: Performance; date: string; daysLeft: number };
  scenes: {
    total: number;
    ready: number;
    inProgress: number;
    notStarted: number;
    readyPercent: number;
  };
  nextRehearsal?: Rehearsal;
  rehearsalsCount: number;
  openTasks: number;
  staleScenes: number;
}

function countStaleScenes(
  state: AppState,
  playId: string,
  staleDays: number,
  today = startOfDay(new Date())
): number {
  const playScenes = state.scenes.filter(
    (scene) => scene.playId === playId && scene.status === 'in_progress'
  );
  let count = 0;

  for (const scene of playScenes) {
    let latest: string | null = null;
    for (const rehearsal of state.rehearsals) {
      if (!rehearsalInvolvesPlay(state, rehearsal, playId)) continue;
      const hasScene =
        rehearsal.sceneIds.includes(scene.id) ||
        rehearsal.schedule.some((block) => block.sceneId === scene.id);
      if (!hasScene) continue;
      if (!latest || rehearsal.date > latest) latest = rehearsal.date;
    }
    if (!latest) {
      count += 1;
      continue;
    }
    if (differenceInCalendarDays(today, parseISO(latest)) > staleDays) count += 1;
  }

  return count;
}

export function getPlayOverviews(state: AppState): PlayOverview[] {
  const plays = getTheaterPlays(state);
  const today = startOfDay(new Date());
  const staleDays = state.appMeta?.staleSceneDays ?? 21;

  const overviews = plays.map((play): PlayOverview => {
    const scenes = state.scenes.filter((scene) => scene.playId === play.id);
    const ready = scenes.filter((scene) => scene.status === 'ready').length;
    const inProgress = scenes.filter((scene) => scene.status === 'in_progress').length;
    const notStarted = scenes.filter((scene) => scene.status === 'not_started').length;
    const total = scenes.length;
    const playRehearsals = state.rehearsals.filter((rehearsal) =>
      rehearsalInvolvesPlay(state, rehearsal, play.id)
    );
    const nextRehearsal = playRehearsals
      .filter((rehearsal) => !isAfter(today, parseISO(rehearsal.date)))
      .sort(
        (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
      )[0];

    return {
      play,
      premiere: getUpcomingPremiere(state, play.id, today),
      scenes: {
        total,
        ready,
        inProgress,
        notStarted,
        readyPercent: total > 0 ? Math.round((ready / total) * 100) : 0,
      },
      nextRehearsal,
      rehearsalsCount: playRehearsals.length,
      openTasks: countOpenTasksByPlay(state.tasks, play.id),
      staleScenes: countStaleScenes(state, play.id, staleDays, today),
    };
  });

  return overviews.sort((a, b) => {
    const aDays = a.premiere?.daysLeft ?? Number.POSITIVE_INFINITY;
    const bDays = b.premiere?.daysLeft ?? Number.POSITIVE_INFINITY;
    if (aDays !== bDays) return aDays - bDays;
    return a.play.title.localeCompare(b.play.title, 'ru');
  });
}
