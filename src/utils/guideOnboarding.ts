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
import {
  THEATER_SETUP_STEP_DEFINITIONS,
  THEATER_SETUP_STEP_COUNT,
  type TheaterSetupStepId,
} from '../../shared/theaterSetupSteps';

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

const SETUP_STEP_HREFS: Record<TheaterSetupStepId, string> = {
  theater: appPaths.overview,
  actors: appPaths.actors,
  play: appPaths.play,
  scenes: appPaths.scenes,
  cast: appPaths.playCast,
  venue: appPaths.venues,
  rehearsal: appPaths.rehearsals,
  telegram: appPaths.rehearsals,
  telegram_bot: `${appPaths.settings}?tab=theater&focus=telegram`,
};

export { THEATER_SETUP_STEP_COUNT };

function isSetupStepDone(state: AppState, id: TheaterSetupStepId): boolean {
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

  switch (id) {
    case 'theater':
      return Boolean(theater);
    case 'actors':
      return actors.length >= 1;
    case 'play':
      return plays.length >= 1;
    case 'scenes':
      return scenes.length >= 3;
    case 'cast':
      return castCount >= 1;
    case 'venue':
      return venues.length >= 1;
    case 'rehearsal':
      return hasScheduledRehearsal;
    case 'telegram':
      return planExported;
    case 'telegram_bot':
      return (
        Boolean(theater?.telegramChatId?.trim()) &&
        actors.some((actor) => Boolean(actor.telegramChatId?.trim()))
      );
    default:
      return false;
  }
}

export function getTheaterSetupSteps(state: AppState): TheaterSetupStep[] {
  return THEATER_SETUP_STEP_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    done: isSetupStepDone(state, def.id),
    href: SETUP_STEP_HREFS[def.id],
  }));
}

export function getTheaterSetupProgress(state: AppState) {
  const steps = getTheaterSetupSteps(state);
  const completed = steps.filter((s) => s.done).length;
  return { steps, completed, total: steps.length, allDone: completed === steps.length };
}

export const GUIDE_CHECKLIST_HIDDEN_KEY = 'guide-checklist-hidden';
export const ONBOARDING_CHECKLIST_SKIP_KEY = 'theater-onboarding-skipped';

export function isOnboardingChecklistSkipped(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_CHECKLIST_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOnboardingChecklistSkipped(skipped: boolean) {
  try {
    if (skipped) localStorage.setItem(ONBOARDING_CHECKLIST_SKIP_KEY, '1');
    else localStorage.removeItem(ONBOARDING_CHECKLIST_SKIP_KEY);
  } catch {
    // ignore
  }
}

export function getNextSetupStep(state: AppState): TheaterSetupStep | undefined {
  return getTheaterSetupSteps(state).find((step) => !step.done);
}

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
