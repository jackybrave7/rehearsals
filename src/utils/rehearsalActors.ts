import type { AppState, Rehearsal, ScheduleBlock } from '../types';
import { getDefaultPerformance, getSelectedPerformance } from '../store/selectors';
import { getScenePlayId } from './rehearsalPlays';

export function resolvePerformanceIdForPlay(
  state: AppState,
  playId: string | undefined
): string | undefined {
  if (!playId) return undefined;
  return (
    getSelectedPerformance(state, playId)?.id ?? getDefaultPerformance(state, playId)?.id
  );
}

export function resolveRehearsalPerformanceId(
  state: AppState,
  rehearsal: Pick<Rehearsal, 'playId' | 'performanceId'>
): string | undefined {
  if (rehearsal.performanceId) return rehearsal.performanceId;
  return resolvePerformanceIdForPlay(state, rehearsal.playId);
}

export function getActorIdsForSceneIds(
  state: AppState,
  performanceId: string | undefined,
  sceneIds: string[]
): string[] {
  if (!performanceId || sceneIds.length === 0) return [];

  const actorIds = new Set<string>();
  for (const sceneId of sceneIds) {
    const scene = state.scenes.find((s) => s.id === sceneId);
    if (!scene?.roleIds?.length) continue;

    for (const roleId of scene.roleIds) {
      for (const assignment of state.castAssignments) {
        if (assignment.performanceId === performanceId && assignment.roleId === roleId) {
          actorIds.add(assignment.actorId);
        }
      }
    }
  }

  return [...actorIds];
}

/** Состав по сценам из разных постановок — без дублей актёров. */
export function getActorIdsForSceneIdsMultiPlay(state: AppState, sceneIds: string[]): string[] {
  const actorIds = new Set<string>();
  const byPlay = new Map<string, string[]>();

  for (const sceneId of sceneIds) {
    const playId = getScenePlayId(state, sceneId);
    if (!playId) continue;
    const list = byPlay.get(playId) ?? [];
    list.push(sceneId);
    byPlay.set(playId, list);
  }

  for (const [playId, playSceneIds] of byPlay) {
    const performanceId = resolvePerformanceIdForPlay(state, playId);
    for (const actorId of getActorIdsForSceneIds(state, performanceId, playSceneIds)) {
      actorIds.add(actorId);
    }
  }

  return [...actorIds];
}

export function getActorIdsMapForSceneIds(
  state: AppState,
  performanceId: string | undefined,
  sceneIds: string[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const sceneId of sceneIds) {
    const playId = getScenePlayId(state, sceneId);
    const perfId = playId ? resolvePerformanceIdForPlay(state, playId) : performanceId;
    map.set(sceneId, getActorIdsForSceneIds(state, perfId, [sceneId]));
  }
  return map;
}

export function mergeActorsForNewScenes(
  state: AppState,
  rehearsal: Pick<Rehearsal, 'playId' | 'performanceId' | 'actorIds'>,
  previousSceneIds: string[],
  nextSceneIds: string[]
): string[] {
  const newSceneIds = nextSceneIds.filter((id) => !previousSceneIds.includes(id));
  if (newSceneIds.length === 0) return rehearsal.actorIds;

  const newActors = getActorIdsForSceneIdsMultiPlay(state, newSceneIds);
  return [...new Set([...rehearsal.actorIds, ...newActors])];
}

export function mergeActorsForSceneIds(
  state: AppState,
  rehearsal: Pick<Rehearsal, 'playId' | 'performanceId' | 'actorIds'>,
  sceneIds: string[]
): string[] {
  if (sceneIds.length === 0) return rehearsal.actorIds;
  const newActors = getActorIdsForSceneIdsMultiPlay(state, sceneIds);
  return [...new Set([...rehearsal.actorIds, ...newActors])];
}

export function getSceneIdsFromNewScheduleBlocks(
  previousSchedule: ScheduleBlock[],
  nextSchedule: ScheduleBlock[]
): string[] {
  const prevBlockIds = new Set(previousSchedule.map((block) => block.id));
  const sceneIds = new Set<string>();

  for (const block of nextSchedule) {
    if (!prevBlockIds.has(block.id) && block.sceneId) {
      sceneIds.add(block.sceneId);
    }
  }

  return [...sceneIds];
}

export function mergeActorsForNewScheduleBlocks(
  state: AppState,
  rehearsal: Rehearsal,
  nextSchedule: ScheduleBlock[]
): string[] {
  const newSceneIds = getSceneIdsFromNewScheduleBlocks(rehearsal.schedule, nextSchedule);
  return mergeActorsForSceneIds(state, rehearsal, newSceneIds);
}

export function syncParticipantOrder(
  order: string[] | undefined,
  allIds: string[]
): string[] {
  const current = order?.filter((id) => allIds.includes(id)) ?? [];
  const missing = allIds.filter((id) => !current.includes(id));
  return [...current, ...missing];
}

export function resolveParticipantOrder(
  state: AppState,
  rehearsal: Pick<Rehearsal, 'playId' | 'performanceId' | 'actorIds' | 'participantOrder' | 'sceneIds' | 'schedule'>
): string[] {
  const fromScenes = getActorIdsForSceneIdsMultiPlay(state, rehearsal.sceneIds);
  const etudeActors = (rehearsal.schedule ?? [])
    .filter((block) => block.type === 'etude')
    .flatMap((block) => block.actorIds ?? []);
  const allIds = [...new Set([...rehearsal.actorIds, ...fromScenes, ...etudeActors])];

  if (rehearsal.participantOrder?.length) {
    return syncParticipantOrder(rehearsal.participantOrder, allIds);
  }

  const sceneOnly = fromScenes.filter((id) => !rehearsal.actorIds.includes(id));
  return syncParticipantOrder([...rehearsal.actorIds, ...sceneOnly], allIds);
}

export function sortParticipantOrderByParticipation(
  order: string[],
  participatingActorIds: string[]
): string[] {
  const participating = new Set(participatingActorIds);
  const active: string[] = [];
  const inactive: string[] = [];
  for (const id of order) {
    if (participating.has(id)) active.push(id);
    else inactive.push(id);
  }
  return [...active, ...inactive];
}

export function getRehearsalParticipantActorIds(
  state: AppState,
  rehearsal: Rehearsal
): string[] {
  return resolveParticipantOrder(state, rehearsal);
}

export function getParticipatingActorIds(
  state: AppState,
  rehearsal: Rehearsal
): string[] {
  return getRehearsalParticipantActorIds(state, rehearsal).filter((id) =>
    rehearsal.actorIds.includes(id) && rehearsal.attendance?.[id] !== 'absent'
  );
}
