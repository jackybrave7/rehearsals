import { useMemo, useState } from 'react';
import {
  Check,
  CheckSquare,
  Coffee,
  Clock,
  Film,
  GripVertical,
  Pencil,
  Plus,
  Sparkles,
  Wand2,
  X,
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
import {
  canMarkBlockCompletion,
  canMarkScheduleCompletion,
  getScheduleCompletionStats,
} from '../utils/rehearsalScheduleCompletion';

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
  readOnly?: boolean;
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
  readOnly = false,
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
  const showCompletionMarks = canMarkScheduleCompletion(rehearsal);
  const completionStats = getScheduleCompletionStats(sortedSchedule);

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

  const setBlockCompletion = (blockId: string, completed: boolean) => {
    applySchedule(
      sortedSchedule.map((block) => {
        if (block.id !== blockId) return block;
        if (block.completed === completed) {
          const { completed: _removed, ...rest } = block;
          return rest;
        }
        return { ...block, completed };
      })
    );
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
          <h2 className="text-2xl font-bold text-white sm:text-3xl">План по времени</h2>
          {sortedSchedule.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              {formatDuration(totalMinutes)} · {rehearsal.startTime} – {planEndTime}
              {exceedsWindow && (
                <span className="ml-2 text-amber-300">выходит за {rehearsal.endTime}</span>
              )}
              {showCompletionMarks && completionStats.total > 0 && (
                <span className="ml-2 text-muted/90">
                  · отмечено {completionStats.done}/{completionStats.total}
                </span>
              )}
            </p>
          )}
          {showCompletionMarks && completionStats.total > 0 && (
            <p className="mt-1 text-xs text-muted">
              Итог появится после окончания каждого блока; повторное нажатие снимает отметку
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
            const canComplete = canMarkBlockCompletion(rehearsal, block);
            const isDone = block.completed === true;
            const isNotDone = block.completed === false;

            return (
              <div key={block.id}>
                <div
                  className={`group flex flex-col gap-2 rounded-xl border bg-surface/40 py-3 pl-2 pr-3 border-l-4 transition-shadow sm:flex-row sm:gap-3 sm:py-4 sm:pr-4 ${blockTypeColors[block.type]} ${
                    isDragging ? 'opacity-40' : ''
                  } ${
                    dropActive
                      ? 'border-gold/40 ring-1 ring-gold/30'
                      : 'border-gold/10'
                  } ${isDone ? 'bg-emerald-950/20' : ''} ${isNotDone ? 'bg-red-950/10' : ''}`}
                  onDragEnter={(event) => handleDragOver(event, index + 1)}
                  onDragOver={(event) => handleDragOver(event, index + 1)}
                  onDrop={(event) => handleDropAt(event, index + 1)}
                >
                  <div className="flex min-w-0 items-start gap-2 sm:contents">
                  <div
                    draggable={!readOnly}
                    onDragStart={readOnly ? undefined : startScheduleDrag(block.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverIndex(null);
                    }}
                    aria-label={`Переместить блок ${block.title}`}
                    className="schedule-block-grip mt-0.5 flex w-5 shrink-0 cursor-grab items-start justify-center text-muted active:cursor-grabbing sm:mt-1"
                  >
                    <GripVertical size={14} />
                  </div>

                  <div className="schedule-block-time flex min-w-0 flex-1 items-baseline gap-2 font-mono sm:flex-none sm:block sm:w-[5.25rem] sm:shrink-0 sm:space-y-0.5 sm:pt-0.5 sm:text-right">
                    <p className="text-sm font-semibold leading-none text-gold-light">
                      {block.startTime}
                    </p>
                    <span className="text-[10px] text-muted/70 sm:hidden">—</span>
                    <p className="text-xs leading-none text-muted sm:mt-0">{endTime}</p>
                    <span className="hidden text-[10px] leading-none text-muted/70 sm:block">—</span>
                    <p className="schedule-block-duration text-[11px] font-medium leading-tight text-muted sm:pt-2">
                      {formatDuration(block.durationMinutes)}
                    </p>
                  </div>
                  </div>

                  <div className="relative min-w-0 flex-1 border-t border-gold/10 pt-3 sm:border-l sm:border-t-0 sm:pt-0 sm:pl-5 md:pl-6">
                    <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-gold/30 bg-surface sm:-left-3.5 sm:top-1">
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
                        {canComplete && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted">Итог:</span>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => setBlockCompletion(block.id, true)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                isDone
                                  ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/40'
                                  : 'bg-white/5 text-muted hover:bg-emerald-500/10 hover:text-emerald-200'
                              } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                              title="Сделано"
                            >
                              <Check size={12} />
                              Сделано
                            </button>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => setBlockCompletion(block.id, false)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                isNotDone
                                  ? 'bg-red-500/20 text-red-200 ring-1 ring-red-500/35'
                                  : 'bg-white/5 text-muted hover:bg-red-500/10 hover:text-red-200'
                              } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                              title="Не сделано"
                            >
                              <X size={12} />
                              Нет
                            </button>
                          </div>
                        )}
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
                      <div className="schedule-block-actions hidden shrink-0 gap-0.5 sm:flex">
                        {play && blockScene && (
                          <SceneScriptLink play={play} scene={blockScene} compact />
                        )}
                        {!readOnly && (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                    {!readOnly && (
                      <div className="schedule-block-actions mt-2 flex gap-1 sm:hidden">
                        {play && blockScene && (
                          <SceneScriptLink play={play} scene={blockScene} />
                        )}
                        <Button
                          variant="secondary"
                          className="!px-2.5 !py-1.5 text-xs"
                          onClick={() => onEditBlock(block)}
                        >
                          <Pencil size={14} />
                          Изменить
                        </Button>
                        <DeleteButton
                          label={`Удалить блок «${block.title}»`}
                          onClick={() => onDeleteBlock(block.id)}
                        />
                      </div>
                    )}
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
