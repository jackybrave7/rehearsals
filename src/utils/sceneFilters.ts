import type { PlayRole, Scene, SceneStatus } from '../types';
import { sceneMatchesQuery } from './sceneLabels';

export const sceneStatusLabels: Record<SceneStatus, string> = {
  not_started: 'Не начата',
  in_progress: 'В работе',
  ready: 'Готова',
};

export const sceneStatusColors: Record<SceneStatus, string> = {
  not_started: 'bg-gray-500/20 text-gray-300',
  in_progress: 'bg-amber-500/20 text-amber-300',
  ready: 'bg-emerald-500/20 text-emerald-300',
};

export const sceneStatusFilterOrder: SceneStatus[] = ['not_started', 'in_progress', 'ready'];

export interface CharacterFilterOptions {
  /** Сцена содержит только выбранных персонажей, без лишних ролей в составе. */
  onlySelected?: boolean;
}

/** Сцена проходит фильтр, если содержит все выбранные роли (пересечение, не объединение). */
export function sceneMatchesCharacterFilter(
  scene: Scene,
  characterFilter: Set<string>,
  options?: CharacterFilterOptions
): boolean {
  if (characterFilter.size === 0) return true;
  const roleIds = scene.roleIds ?? [];
  const hasEverySelected = [...characterFilter].every((roleId) => roleIds.includes(roleId));
  if (!hasEverySelected) return false;
  if (options?.onlySelected) {
    return roleIds.length === characterFilter.size;
  }
  return true;
}

export function sceneMatchesFilters(
  scene: Scene,
  query: string,
  statusFilter: Set<SceneStatus>,
  characterFilter: Set<string>,
  characterFilterOptions?: CharacterFilterOptions
): boolean {
  if (!sceneMatchesQuery(scene, query)) return false;
  if (statusFilter.size > 0 && !statusFilter.has(scene.status)) return false;
  if (!sceneMatchesCharacterFilter(scene, characterFilter, characterFilterOptions)) return false;
  return true;
}

export function countScenesByStatus(scenes: Scene[]): Record<SceneStatus, number> {
  const counts: Record<SceneStatus, number> = {
    not_started: 0,
    in_progress: 0,
    ready: 0,
  };
  for (const scene of scenes) {
    counts[scene.status] += 1;
  }
  return counts;
}

export function countScenesByRole(scenes: Scene[], characterRoles: PlayRole[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const role of characterRoles) {
    counts.set(role.id, 0);
  }
  for (const scene of scenes) {
    for (const roleId of scene.roleIds ?? []) {
      if (counts.has(roleId)) {
        counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
      }
    }
  }
  return counts;
}
