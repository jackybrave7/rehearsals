import type { DragEvent } from 'react';
import type { Scene, ScheduleBlock, Task } from '../types';
import { generateId } from './id';
import { addMinutes } from './time';
import {
  DEFAULT_SCENE_REHEARSAL_MINUTES,
  DEFAULT_TASK_REHEARSAL_MINUTES,
} from './sceneDefaults';

export type PlanDragPayload =
  | { source: 'pool'; kind: 'scene' | 'task'; id: string }
  | { source: 'schedule'; blockId: string };

export const PLAN_DRAG_MIME = 'application/x-rehearsal-drag';

export function serializePlanDragPayload(payload: PlanDragPayload): string {
  return JSON.stringify(payload);
}

export function parsePlanDragPayload(raw: string): PlanDragPayload | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlanDragPayload;
  } catch {
    return null;
  }
}

export function readPlanDragPayload(dataTransfer: DataTransfer): PlanDragPayload | null {
  return (
    parsePlanDragPayload(dataTransfer.getData(PLAN_DRAG_MIME)) ??
    parsePlanDragPayload(dataTransfer.getData('text/plain'))
  );
}

export function setPlanPoolDragData(
  event: DragEvent,
  payload: Extract<PlanDragPayload, { source: 'pool' }>
) {
  const serialized = serializePlanDragPayload(payload);
  event.dataTransfer.setData(PLAN_DRAG_MIME, serialized);
  event.dataTransfer.setData('text/plain', serialized);
  event.dataTransfer.effectAllowed = 'move';
}

export function setPlanScheduleDragData(event: DragEvent, blockId: string) {
  const serialized = serializePlanDragPayload({ source: 'schedule', blockId });
  event.dataTransfer.setData(PLAN_DRAG_MIME, serialized);
  event.dataTransfer.setData('text/plain', serialized);
  event.dataTransfer.effectAllowed = 'move';
}

export function recalculateScheduleStartTimes(
  blocks: ScheduleBlock[],
  startTime: string
): ScheduleBlock[] {
  let current = startTime;
  return blocks.map((block) => {
    const updated = { ...block, startTime: current };
    current = addMinutes(current, block.durationMinutes);
    return updated;
  });
}

export function getScheduleTotalMinutes(blocks: ScheduleBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.durationMinutes, 0);
}

export function getScheduleEndTime(blocks: ScheduleBlock[], startTime: string): string {
  if (blocks.length === 0) return startTime;
  const last = blocks[blocks.length - 1];
  return addMinutes(last.startTime, last.durationMinutes);
}

export function createBlockFromScene(scene: Scene): ScheduleBlock {
  return {
    id: generateId(),
    startTime: '00:00',
    durationMinutes: scene.estimatedMinutes ?? DEFAULT_SCENE_REHEARSAL_MINUTES,
    type: 'scene',
    title: scene.title,
    sceneId: scene.id,
  };
}

export function createBlockFromTask(task: Task): ScheduleBlock {
  return {
    id: generateId(),
    startTime: '00:00',
    durationMinutes: DEFAULT_TASK_REHEARSAL_MINUTES,
    type: 'task',
    title: task.title,
    taskId: task.id,
  };
}

export function buildScheduleFromRehearsalItems(
  startTime: string,
  sceneIds: string[],
  taskIds: string[],
  scenes: Scene[],
  tasks: Task[]
): ScheduleBlock[] {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const orderedSceneIds = [...sceneIds].sort((a, b) => {
    const sceneA = sceneById.get(a);
    const sceneB = sceneById.get(b);
    return (sceneA?.number ?? 0) - (sceneB?.number ?? 0);
  });

  const blocks: ScheduleBlock[] = [];

  for (const sceneId of orderedSceneIds) {
    const scene = sceneById.get(sceneId);
    if (scene) blocks.push(createBlockFromScene(scene));
  }

  for (const taskId of taskIds) {
    const task = taskById.get(taskId);
    if (task) blocks.push(createBlockFromTask(task));
  }

  return recalculateScheduleStartTimes(blocks, startTime);
}

export function insertScheduleBlockAt(
  blocks: ScheduleBlock[],
  block: ScheduleBlock,
  index: number,
  startTime: string
): ScheduleBlock[] {
  const next = [...blocks];
  next.splice(index, 0, block);
  return recalculateScheduleStartTimes(next, startTime);
}

export function moveScheduleBlock(
  blocks: ScheduleBlock[],
  blockId: string,
  targetIndex: number,
  startTime: string
): ScheduleBlock[] {
  const fromIndex = blocks.findIndex((block) => block.id === blockId);
  if (fromIndex === -1) return blocks;

  const next = [...blocks];
  const [moved] = next.splice(fromIndex, 1);
  const adjustedIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
  next.splice(Math.max(0, adjustedIndex), 0, moved);

  return recalculateScheduleStartTimes(next, startTime);
}
