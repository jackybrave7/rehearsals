import type { AppState, Rehearsal, ScheduleBlock } from '../types';
import { getDefaultPerformance, getSelectedPerformance } from '../store/selectors';

export function resolveRehearsalPerformanceId(
  state: AppState,
  rehearsal: Pick<Rehearsal, 'playId' | 'performanceId'>
): string | undefined {
  if (rehearsal.performanceId) return rehearsal.performanceId;
  if (!rehearsal.playId) return undefined;
  return (
    getSelectedPerformance(state, rehearsal.playId)?.id ??
    getDefaultPerformance(state, rehearsal.playId)?.id
  );
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

export function mergeActorsForNewScenes(
  state: AppState,
  rehearsal: Pick<Rehearsal, 'playId' | 'performanceId' | 'actorIds'>,
  previousSceneIds: string[],
  nextSceneIds: string[]
): string[] {
  const newSceneIds = nextSceneIds.filter((id) => !previousSceneIds.includes(id));
  if (newSceneIds.length === 0) return rehearsal.actorIds;

  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  const newActors = getActorIdsForSceneIds(state, performanceId, newSceneIds);
  return [...new Set([...rehearsal.actorIds, ...newActors])];
}

export function mergeActorsForSceneIds(
  state: AppState,
  rehearsal: Pick<Rehearsal, 'playId' | 'performanceId' | 'actorIds'>,
  sceneIds: string[]
): string[] {
  if (sceneIds.length === 0) return rehearsal.actorIds;
  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  const newActors = getActorIdsForSceneIds(state, performanceId, sceneIds);
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
  rehearsal: Pick<Rehearsal, 'playId' | 'performanceId' | 'actorIds' | 'participantOrder' | 'sceneIds'>
): string[] {
  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  const fromScenes = getActorIdsForSceneIds(state, performanceId, rehearsal.sceneIds);
  const allIds = [...new Set([...rehearsal.actorIds, ...fromScenes])];

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
