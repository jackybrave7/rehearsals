import type { Rehearsal, Scene, ScheduleBlock } from '../types';
import {
  createBlockFromScene,
  recalculateScheduleStartTimes,
} from './schedulePlan';

export function getSceneIdsFromSchedule(schedule: ScheduleBlock[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const block of schedule) {
    if (block.type === 'scene' && block.sceneId && !seen.has(block.sceneId)) {
      seen.add(block.sceneId);
      ids.push(block.sceneId);
    }
  }
  return ids;
}

export function getSceneDurationsFromSchedule(schedule: ScheduleBlock[]): Record<string, number> {
  const durations: Record<string, number> = {};
  for (const block of schedule) {
    if (block.type === 'scene' && block.sceneId) {
      durations[block.sceneId] = block.durationMinutes;
    }
  }
  return durations;
}

export function removeDeselectedScenesFromSchedule(
  rehearsal: Pick<Rehearsal, 'schedule' | 'startTime'>,
  selectedSceneIds: string[]
): ScheduleBlock[] {
  const selected = new Set(selectedSceneIds);
  const schedule = rehearsal.schedule.filter(
    (block) => !(block.type === 'scene' && block.sceneId && !selected.has(block.sceneId))
  );
  return recalculateScheduleStartTimes(schedule, rehearsal.startTime);
}

export function applySceneIdsToSchedule(
  rehearsal: Pick<Rehearsal, 'schedule' | 'startTime'>,
  nextSceneIds: string[],
  scenes: Scene[],
  durationOverrides?: Record<string, number>
): ScheduleBlock[] {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const selected = new Set(nextSceneIds);

  let schedule = rehearsal.schedule.filter(
    (block) => !(block.type === 'scene' && block.sceneId && !selected.has(block.sceneId))
  );

  const scheduledIds = new Set(
    schedule
      .filter((block) => block.type === 'scene' && block.sceneId)
      .map((block) => block.sceneId!)
  );

  for (const sceneId of nextSceneIds) {
    if (scheduledIds.has(sceneId)) continue;
    const scene = sceneById.get(sceneId);
    if (!scene) continue;
    const block = createBlockFromScene(scene);
    if (durationOverrides?.[sceneId] !== undefined) {
      block.durationMinutes = durationOverrides[sceneId];
    }
    schedule.push(block);
    scheduledIds.add(sceneId);
  }

  if (durationOverrides) {
    schedule = schedule.map((block) => {
      if (block.type !== 'scene' || !block.sceneId) return block;
      const minutes = durationOverrides[block.sceneId];
      return minutes !== undefined ? { ...block, durationMinutes: minutes } : block;
    });
  }

  return recalculateScheduleStartTimes(schedule, rehearsal.startTime);
}

export function updateSceneDurationInSchedule(
  rehearsal: Pick<Rehearsal, 'schedule' | 'startTime'>,
  sceneId: string,
  durationMinutes: number
): ScheduleBlock[] {
  const schedule = rehearsal.schedule.map((block) =>
    block.type === 'scene' && block.sceneId === sceneId
      ? { ...block, durationMinutes: Math.max(1, durationMinutes) }
      : block
  );
  return recalculateScheduleStartTimes(schedule, rehearsal.startTime);
}

export function syncRehearsalSceneIdsFromSchedule(rehearsal: Rehearsal): Rehearsal {
  return {
    ...rehearsal,
    sceneIds: getSceneIdsFromSchedule(rehearsal.schedule),
  };
}
