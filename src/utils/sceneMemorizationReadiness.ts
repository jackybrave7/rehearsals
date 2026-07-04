import type { AppState } from '../types';
import { getActorIdsForSceneIds } from './rehearsalActors';
import { resolvePerformanceIdForPlay } from './rehearsalActors';
import { getScenePlayId } from './rehearsalPlays';
import { memorizationLabels, getMemorizationStatus } from './memorization';

/** Краткая сводка заучивания по актёрам сцены, напр. «Треплев — знает, Нина — учит». */
export function buildSceneMemorizationSummary(state: AppState, sceneId: string): string | null {
  const scene = state.scenes.find((item) => item.id === sceneId);
  if (!scene?.roleIds?.length) return null;

  const playId = getScenePlayId(state, sceneId);
  if (!playId) return null;

  const performanceId = resolvePerformanceIdForPlay(state, playId);
  const actorIds = getActorIdsForSceneIds(state, performanceId, [sceneId]);
  if (actorIds.length === 0) return null;

  const parts: string[] = [];

  for (const roleId of scene.roleIds) {
    const role = state.playRoles.find((item) => item.id === roleId);
    if (!role || role.kind !== 'character') continue;

    const assignment = state.castAssignments.find(
      (item) =>
        item.performanceId === performanceId &&
        item.roleId === roleId &&
        actorIds.includes(item.actorId)
    );
    if (!assignment) continue;

    const actor = state.actors.find((item) => item.id === assignment.actorId);
    if (!actor) continue;

    const status = getMemorizationStatus(actor.memorizationByScene, sceneId);
    parts.push(`${role.name} — ${memorizationLabels[status]}`);
  }

  return parts.length > 0 ? parts.join(', ') : null;
}
