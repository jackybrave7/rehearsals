import { appPaths } from '../navigation/appPaths';
import {
  getActiveTheater,
  getTheaterPlays,
  getTheaterRehearsals,
  getTheaterVenues,
  getActiveActors,
} from '../store/selectors';
import type { AppState } from '../types';
import { isGuidePlanExported } from './guidePlanExport';

export interface TheaterSetupStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

export function getTheaterScenes(state: AppState) {
  const playIds = new Set(getTheaterPlays(state).map((p) => p.id));
  return state.scenes.filter((scene) => playIds.has(scene.playId));
}

export function getTheaterSetupSteps(state: AppState): TheaterSetupStep[] {
  const theater = getActiveTheater(state);
  const plays = getTheaterPlays(state);
  const scenes = getTheaterScenes(state);
  const actors = getActiveActors(state);
  const castCount = state.castAssignments.filter((c) =>
    plays.some((p) => p.id === c.playId)
  ).length;
  const venues = getTheaterVenues(state);
  const rehearsals = getTheaterRehearsals(state);
  const hasScheduledRehearsal = rehearsals.some((r) => r.schedule.length > 0);
  const planExported = isGuidePlanExported(
    state.appMeta,
    theater?.telegramChatId,
    rehearsals
  );

  return [
    {
      id: 'theater',
      label: 'Создать театр',
      done: Boolean(theater),
      href: appPaths.overview,
    },
    {
      id: 'actors',
      label: 'Участники театра',
      done: actors.length >= 1,
      href: appPaths.actors,
    },
    {
      id: 'play',
      label: 'Добавить постановку',
      done: plays.length >= 1,
      href: appPaths.play,
    },
    {
      id: 'scenes',
      label: 'Добавить сцены (от 3)',
      done: scenes.length >= 3,
      href: appPaths.scenes,
    },
    {
      id: 'cast',
      label: 'Роли в составе',
      done: castCount >= 1,
      href: appPaths.playCast,
    },
    {
      id: 'venue',
      label: 'Добавить площадку',
      done: venues.length >= 1,
      href: appPaths.venues,
    },
    {
      id: 'rehearsal',
      label: 'Создать репетицию с планом',
      done: hasScheduledRehearsal,
      href: appPaths.rehearsals,
    },
    {
      id: 'telegram',
      label: 'Подключить Telegram или отправить план',
      done: planExported,
      href: appPaths.settings,
    },
  ];
}

export function getTheaterSetupProgress(state: AppState) {
  const steps = getTheaterSetupSteps(state);
  const completed = steps.filter((s) => s.done).length;
  return { steps, completed, total: steps.length, allDone: completed === steps.length };
}

export const GUIDE_CHECKLIST_HIDDEN_KEY = 'guide-checklist-hidden';

export function isGuideChecklistHidden(): boolean {
  try {
    return localStorage.getItem(GUIDE_CHECKLIST_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGuideChecklistHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(GUIDE_CHECKLIST_HIDDEN_KEY, '1');
    else localStorage.removeItem(GUIDE_CHECKLIST_HIDDEN_KEY);
  } catch {
    // ignore
  }
}
