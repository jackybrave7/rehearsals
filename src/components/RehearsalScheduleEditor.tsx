import { useMemo, useState } from 'react';
import {
  CheckSquare,
  Coffee,
  Clock,
  Film,
  GripVertical,
  Pencil,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { Play, Rehearsal, Scene, ScheduleBlock, ScheduleBlockType, Task } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getSceneCharacterNames } from '../utils/sceneLabels';
import { Button } from './Button';
import { DeleteButton } from './DeleteButton';
import { useConfirmDialog } from './ConfirmDialogContext';
import { SceneScriptLink } from './SceneScriptLink';
import { addMinutes, formatDuration, timeToMinutes } from '../utils/time';
import {
  buildScheduleFromRehearsalItems,
  createBlockFromScene,
  createBlockFromTask,
  getScheduleEndTime,
  getScheduleTotalMinutes,
  insertScheduleBlockAt,
  moveScheduleBlock,
  readPlanDragPayload,
  recalculateScheduleStartTimes,
  setPlanScheduleDragData,
} from '../utils/schedulePlan';

const blockTypeLabels: Record<ScheduleBlockType, string> = {
  scene: 'Сцена',
  task: 'Задача',
  break: 'Перерыв',
  warmup: 'Разминка',
  custom: 'Другое',
};

const blockTypeIcons: Record<ScheduleBlockType, typeof Film> = {
  scene: Film,
  task: CheckSquare,
  break: Coffee,
  warmup: Sparkles,
  custom: Clock,
};

const blockTypeColors: Record<ScheduleBlockType, string> = {
  scene: 'border-l-emerald-500',
  task: 'border-l-blue-500',
  break: 'border-l-amber-500',
  warmup: 'border-l-purple-500',
  custom: 'border-l-gray-500',
};

interface RehearsalScheduleEditorProps {
  rehearsal: Rehearsal;
  play?: Play;
  linkedScenes: Scene[];
  linkedTasks: Task[];
  onScheduleChange: (schedule: ScheduleBlock[]) => void;
  onAddBlock: () => void;
  onEditBlock: (block: ScheduleBlock) => void;
  onDeleteBlock: (blockId: string) => void;
}

export function RehearsalScheduleEditor({
  rehearsal,
  play,
  linkedScenes,
  linkedTasks,
  onScheduleChange,
  onAddBlock,
  onEditBlock,
  onDeleteBlock,
}: RehearsalScheduleEditorProps) {
  const { state } = useRehearsalStore();
  const { confirm } = useConfirmDialog();
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sortedSchedule = useMemo(
    () => [...rehearsal.schedule].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [rehearsal.schedule]
  );

  const totalMinutes = getScheduleTotalMinutes(sortedSchedule);
  const planEndTime = getScheduleEndTime(sortedSchedule, rehearsal.startTime);
  const exceedsWindow =
    sortedSchedule.length > 0 &&
    timeToMinutes(planEndTime) > timeToMinutes(rehearsal.endTime);

  const applySchedule = (schedule: ScheduleBlock[]) => {
    onScheduleChange(recalculateScheduleStartTimes(schedule, rehearsal.startTime));
  };

  const handleGeneratePlan = async () => {
    if (linkedScenes.length === 0 && linkedTasks.length === 0) return;
    if (sortedSchedule.length > 0) {
      const confirmed = await confirm({
        title: 'Сформировать план заново?',
        message:
          'Текущий план по времени будет заменён автоматически сгенерированным из выбранных сцен и задач. Ручные правки и порядок блоков пропадут.',
        confirmLabel: 'Заменить план',
        variant: 'danger',
      });
      if (!confirmed) return;
    }
    applySchedule(
      buildScheduleFromRehearsalItems(
        rehearsal.startTime,
        rehearsal.sceneIds,
        rehearsal.taskIds,
        linkedScenes,
        linkedTasks
      )
    );
  };

  const handleDropAt = (event: React.DragEvent, targetIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverIndex(null);
    setDraggingId(null);

    const payload = readPlanDragPayload(event.dataTransfer);
    if (!payload) return;

    if (payload.source === 'pool') {
      const block =
        payload.kind === 'scene'
          ? linkedScenes.find((scene) => scene.id === payload.id)
          : linkedTasks.find((task) => task.id === payload.id);
      if (!block) return;

      const newBlock =
        payload.kind === 'scene'
          ? createBlockFromScene(block as Scene)
          : createBlockFromTask(block as Task);

      applySchedule(insertScheduleBlockAt(sortedSchedule, newBlock, targetIndex, rehearsal.startTime));
      return;
    }

    if (payload.source === 'schedule') {
      applySchedule(
        moveScheduleBlock(sortedSchedule, payload.blockId, targetIndex, rehearsal.startTime)
      );
    }
  };

  const handleDragOver = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const startScheduleDrag = (blockId: string) => (event: React.DragEvent) => {
    event.stopPropagation();
    setDraggingId(blockId);
    setPlanScheduleDragData(event, blockId);
  };

  const renderInsertSlot = (index: number) => {
    const active = dragOverIndex === index;
    return (
      <div
        className={`relative transition-all ${active ? 'py-2' : 'py-1'}`}
        onDragEnter={(event) => handleDragOver(event, index)}
        onDragOver={(event) => handleDragOver(event, index)}
        onDrop={(event) => handleDropAt(event, index)}
      >
        <div
          className={`rounded-full transition-all ${
            active ? 'h-1.5 bg-gold/70 shadow-[0_0_8px_rgba(212,175,55,0.35)]' : 'h-0.5 bg-gold/10'
          }`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">План по времени</h2>
          {sortedSchedule.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              {formatDuration(totalMinutes)} · {rehearsal.startTime} – {planEndTime}
              {exceedsWindow && (
                <span className="ml-2 text-amber-300">выходит за {rehearsal.endTime}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(linkedScenes.length > 0 || linkedTasks.length > 0) && (
            <Button variant="secondary" onClick={handleGeneratePlan}>
              <Wand2 size={16} />
              Сформировать план
            </Button>
          )}
          <Button onClick={onAddBlock}>
            <Plus size={18} /> Добавить блок
          </Button>
        </div>
      </div>

      {(linkedScenes.length > 0 || linkedTasks.length > 0) && sortedSchedule.length === 0 && (
        <p className="text-xs text-muted">
          Перетащите сцены и задачи из колонки слева (за иконку ⋮⋮) или нажмите «Сформировать план».
        </p>
      )}

      {sortedSchedule.length === 0 ? (
        <div
          className={`rounded-2xl border border-dashed p-12 text-center transition-colors ${
            dragOverIndex === 0
              ? 'border-gold/50 bg-gold/5 text-gold-light'
              : 'border-gold/20 text-muted'
          }`}
          onDragEnter={(event) => handleDragOver(event, 0)}
          onDragOver={(event) => handleDragOver(event, 0)}
          onDragLeave={() => setDragOverIndex(null)}
          onDrop={(event) => handleDropAt(event, 0)}
        >
          {dragOverIndex === 0 ? 'Отпустите, чтобы добавить в план' : 'План пока пуст'}
          <Button className="mt-4" variant="secondary" onClick={onAddBlock}>
            Добавить первый блок
          </Button>
        </div>
      ) : (
        <div
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDragOverIndex(null);
            }
          }}
        >
          {renderInsertSlot(0)}
          {sortedSchedule.map((block, index) => {
            const Icon = blockTypeIcons[block.type];
            const endTime = addMinutes(block.startTime, block.durationMinutes);
            const isDragging = draggingId === block.id;
            const blockScene =
              block.type === 'scene' && block.sceneId
                ? linkedScenes.find((scene) => scene.id === block.sceneId)
                : undefined;
            const sceneCharacters = blockScene
              ? getSceneCharacterNames(state, blockScene)
              : [];
            const dropActive = dragOverIndex === index + 1;

            return (
              <div key={block.id}>
                <div
                  className={`group flex gap-3 rounded-xl border bg-surface/40 py-4 pl-2 pr-4 border-l-4 transition-shadow sm:gap-4 ${blockTypeColors[block.type]} ${
                    isDragging ? 'opacity-40' : ''
                  } ${
                    dropActive
                      ? 'border-gold/40 ring-1 ring-gold/30'
                      : 'border-gold/10'
                  }`}
                  onDragEnter={(event) => handleDragOver(event, index + 1)}
                  onDragOver={(event) => handleDragOver(event, index + 1)}
                  onDrop={(event) => handleDropAt(event, index + 1)}
                >
                  <div
                    draggable
                    onDragStart={startScheduleDrag(block.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverIndex(null);
                    }}
                    aria-label={`Переместить блок ${block.title}`}
                    className="mt-1 flex w-5 shrink-0 cursor-grab items-start justify-center text-muted active:cursor-grabbing"
                  >
                    <GripVertical size={14} className="opacity-50 group-hover:opacity-100" />
                  </div>

                  <div className="schedule-block-time w-[5.25rem] shrink-0 space-y-0.5 pt-0.5 text-right font-mono">
                    <p className="text-sm font-semibold leading-none text-gold-light">
                      {block.startTime}
                    </p>
                    <p className="text-[10px] leading-none text-muted/70">—</p>
                    <p className="text-xs leading-none text-muted">{endTime}</p>
                    <p className="schedule-block-duration pt-2 text-[11px] font-medium leading-tight text-muted">
                      {formatDuration(block.durationMinutes)}
                    </p>
                  </div>

                  <div className="relative min-w-0 flex-1 border-l border-gold/20 pl-5 sm:pl-6">
                    <div className="absolute -left-3.5 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-gold/30 bg-surface">
                      <Icon size={13} className="text-gold" />
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2 select-none">
                        <div>
                          <p className="text-base font-semibold leading-snug text-white">{block.title}</p>
                          {sceneCharacters.length > 0 && (
                            <p className="mt-1 text-sm leading-snug text-muted">
                              {sceneCharacters.join(', ')}
                            </p>
                          )}
                        </div>
                        <p className="schedule-block-meta inline-flex rounded-full bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-muted">
                          {blockTypeLabels[block.type]}
                        </p>
                        {block.notes && (
                          <p className="text-sm leading-relaxed text-muted">{block.notes}</p>
                        )}
                        {(block.decidedNotes?.trim() || block.remainingNotes?.trim()) && (
                          <div className="space-y-1 rounded-lg bg-gold/5 px-3 py-2 text-xs text-muted">
                            {block.decidedNotes?.trim() && (
                              <p>
                                <span className="font-medium text-gold-light">Решили:</span>{' '}
                                {block.decidedNotes.trim()}
                              </p>
                            )}
                            {block.remainingNotes?.trim() && (
                              <p>
                                <span className="font-medium text-gold-light">Осталось:</span>{' '}
                                {block.remainingNotes.trim()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {play && blockScene && (
                          <SceneScriptLink play={play} scene={blockScene} compact />
                        )}
                        <Button
                          variant="ghost"
                          className="!px-2 !py-1"
                          onClick={() => onEditBlock(block)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <DeleteButton
                          label={`Удалить блок «${block.title}»`}
                          onClick={() => onDeleteBlock(block.id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                {renderInsertSlot(index + 1)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
