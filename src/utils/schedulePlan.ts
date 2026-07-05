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

export function createBlockFromEtude(options: {
  title: string;
  durationMinutes?: number;
  playId?: string;
  actorIds?: string[];
  notes?: string;
}): ScheduleBlock {
  return {
    id: generateId(),
    startTime: '00:00',
    durationMinutes: options.durationMinutes ?? 30,
    type: 'etude',
    title: options.title,
    playId: options.playId,
    actorIds: options.actorIds,
    notes: options.notes,
  };
}

export const DEFAULT_PRODUCTION_BREAK_MINUTES = 15;

export function createBlockFromBreak(
  title = 'Перерыв',
  durationMinutes = DEFAULT_PRODUCTION_BREAK_MINUTES
): ScheduleBlock {
  return {
    id: generateId(),
    startTime: '00:00',
    durationMinutes,
    type: 'break',
    title,
  };
}

export type PlanGenerationMode = 'chronology' | 'by-actors' | 'by-productions';

export const PLAN_GENERATION_MODE_LABELS: Record<PlanGenerationMode, string> = {
  chronology: 'Хронология сцен',
  'by-actors': 'Группировка по актёрам',
  'by-productions': 'Группировка по постановкам',
};

function compareSceneChronology(
  sceneById: Map<string, Scene>,
  sceneIdA: string,
  sceneIdB: string
): number {
  const sceneA = sceneById.get(sceneIdA);
  const sceneB = sceneById.get(sceneIdB);
  return (sceneA?.number ?? 0) - (sceneB?.number ?? 0);
}

function countActorOverlap(
  actorIdsBySceneId: Map<string, string[]>,
  sceneIdA: string,
  sceneIdB: string
): number {
  const actorsA = new Set(actorIdsBySceneId.get(sceneIdA) ?? []);
  const actorsB = actorIdsBySceneId.get(sceneIdB) ?? [];
  return actorsB.filter((actorId) => actorsA.has(actorId)).length;
}

function compareSceneByProductionThenChronology(
  sceneById: Map<string, Scene>,
  sceneIdA: string,
  sceneIdB: string
): number {
  const sceneA = sceneById.get(sceneIdA);
  const sceneB = sceneById.get(sceneIdB);
  const playCmp = (sceneA?.playId ?? '').localeCompare(sceneB?.playId ?? '');
  if (playCmp !== 0) return playCmp;
  return (sceneA?.number ?? 0) - (sceneB?.number ?? 0);
}

export function orderSceneIdsForPlan(
  sceneIds: string[],
  scenes: Scene[],
  mode: PlanGenerationMode,
  actorIdsBySceneId: Map<string, string[]> = new Map()
): string[] {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const knownIds = sceneIds.filter((sceneId) => sceneById.has(sceneId));
  if (knownIds.length <= 1) {
    return [...knownIds].sort((a, b) => compareSceneChronology(sceneById, a, b));
  }
  if (mode === 'chronology') {
    return [...knownIds].sort((a, b) => compareSceneChronology(sceneById, a, b));
  }
  if (mode === 'by-productions') {
    return [...knownIds].sort((a, b) =>
      compareSceneByProductionThenChronology(sceneById, a, b)
    );
  }

  const remaining = new Set(knownIds);
  const order: string[] = [];
  let current = [...remaining].sort((a, b) => compareSceneChronology(sceneById, a, b))[0];

  while (remaining.size > 0) {
    remaining.delete(current);
    order.push(current);
    if (remaining.size === 0) break;

    let nextId = current;
    let bestOverlap = -1;
    let bestChronology = Number.POSITIVE_INFINITY;

    for (const candidate of remaining) {
      const overlap = countActorOverlap(actorIdsBySceneId, current, candidate);
      const chronology = sceneById.get(candidate)?.number ?? 0;
      if (
        overlap > bestOverlap ||
        (overlap === bestOverlap && chronology < bestChronology)
      ) {
        bestOverlap = overlap;
        bestChronology = chronology;
        nextId = candidate;
      }
    }

    current = nextId;
  }

  return order;
}

export function buildScheduleFromRehearsalItems(
  startTime: string,
  sceneIds: string[],
  taskIds: string[],
  scenes: Scene[],
  tasks: Task[],
  options?: {
    mode?: PlanGenerationMode;
    actorIdsBySceneId?: Map<string, string[]>;
  }
): ScheduleBlock[] {
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const mode = options?.mode ?? 'chronology';
  const actorIdsBySceneId = options?.actorIdsBySceneId ?? new Map();

  const orderedSceneIds = orderSceneIdsForPlan(sceneIds, scenes, mode, actorIdsBySceneId);

  const blocks: ScheduleBlock[] = [];
  let lastPlayId: string | undefined;

  for (const sceneId of orderedSceneIds) {
    const scene = sceneById.get(sceneId);
    if (!scene) continue;
    if (
      mode === 'by-productions' &&
      lastPlayId &&
      scene.playId !== lastPlayId &&
      blocks.length > 0
    ) {
      blocks.push(createBlockFromBreak());
    }
    blocks.push(createBlockFromScene(scene));
    lastPlayId = scene.playId;
  }

  for (const taskId of taskIds) {
    const task = taskById.get(taskId);
    if (task) blocks.push(createBlockFromTask(task));
  }

  return recalculateScheduleStartTimes(blocks, startTime);
}

export function appendScheduleFromRehearsalItems(
  existingBlocks: ScheduleBlock[],
  startTime: string,
  sceneIds: string[],
  taskIds: string[],
  scenes: Scene[],
  tasks: Task[],
  options?: {
    mode?: PlanGenerationMode;
    actorIdsBySceneId?: Map<string, string[]>;
  }
): ScheduleBlock[] {
  const existingSceneIds = new Set(
    existingBlocks.map((block) => block.sceneId).filter((id): id is string => Boolean(id))
  );
  const existingTaskIds = new Set(
    existingBlocks.map((block) => block.taskId).filter((id): id is string => Boolean(id))
  );

  const newSceneIds = sceneIds.filter((sceneId) => !existingSceneIds.has(sceneId));
  const newTaskIds = taskIds.filter((taskId) => !existingTaskIds.has(taskId));

  const newBlocks = buildScheduleFromRehearsalItems(
    startTime,
    newSceneIds,
    newTaskIds,
    scenes,
    tasks,
    options
  );

  if (newBlocks.length === 0) {
    return existingBlocks;
  }

  return recalculateScheduleStartTimes([...existingBlocks, ...newBlocks], startTime);
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
