import type { AppState, Play, Rehearsal } from '../types';
import { getActorIdsForSceneIdsMultiPlay } from './rehearsalActors';
import { getSceneIdsFromSchedule } from './scheduleSync';

/** Все sceneId репетиции: из sceneIds, schedule и блоков плана. */
export function getRehearsalAllSceneIds(rehearsal: Rehearsal): string[] {
  const ids = new Set<string>(rehearsal.sceneIds);
  for (const id of getSceneIdsFromSchedule(rehearsal.schedule)) ids.add(id);
  for (const block of rehearsal.schedule) {
    if (block.sceneId) ids.add(block.sceneId);
  }
  return [...ids];
}

export function getScenePlayId(state: AppState, sceneId: string): string | undefined {
  return state.scenes.find((scene) => scene.id === sceneId)?.playId;
}

/** Постановки, затронутые репетицией (через сцены и этюды). legacy playId учитывается. */
export function getRehearsalPlayIds(state: AppState, rehearsal: Rehearsal): string[] {
  const playIds = new Set<string>();
  if (rehearsal.playId) playIds.add(rehearsal.playId);
  for (const sceneId of getRehearsalAllSceneIds(rehearsal)) {
    const playId = getScenePlayId(state, sceneId);
    if (playId) playIds.add(playId);
  }
  for (const block of rehearsal.schedule) {
    if (block.type === 'etude' && block.playId) playIds.add(block.playId);
  }
  return [...playIds];
}

export function rehearsalInvolvesPlay(
  state: AppState,
  rehearsal: Rehearsal,
  playId: string
): boolean {
  return getRehearsalPlayIds(state, rehearsal).includes(playId);
}

export function rehearsalHasEtudeBlocks(rehearsal: Rehearsal): boolean {
  return rehearsal.schedule.some((block) => block.type === 'etude');
}

export function getRehearsalPlayTitles(state: AppState, rehearsal: Rehearsal): string[] {
  return getRehearsalPlayIds(state, rehearsal)
    .map((playId) => state.plays.find((play) => play.id === playId)?.title)
    .filter((title): title is string => Boolean(title));
}

export function getArchivedPlaysInRehearsal(state: AppState, rehearsal: Rehearsal): Play[] {
  return getRehearsalPlayIds(state, rehearsal)
    .map((playId) => state.plays.find((play) => play.id === playId))
    .filter((play): play is Play => Boolean(play?.archivedAt));
}

export function rehearsalInvolvesActor(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string
): boolean {
  if (rehearsal.actorIds.includes(actorId)) return true;
  const sceneActorIds = getActorIdsForSceneIdsMultiPlay(state, getRehearsalAllSceneIds(rehearsal));
  if (sceneActorIds.includes(actorId)) return true;
  for (const block of rehearsal.schedule) {
    if (block.type === 'etude' && block.actorIds?.includes(actorId)) return true;
  }
  return false;
}
