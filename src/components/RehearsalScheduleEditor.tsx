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
import { Modal } from './Modal';
import { SceneScriptLink } from './SceneScriptLink';
import { addMinutes, formatDuration, timeToMinutes } from '../utils/time';
import { DecidedNotesDisplay } from './DecidedNotesDisplay';
import { PlayIcon } from './PlayIcon';
import {
  appendScheduleFromRehearsalItems,
  buildScheduleFromRehearsalItems,
  createBlockFromScene,
  createBlockFromTask,
  getScheduleEndTime,
  getScheduleTotalMinutes,
  insertScheduleBlockAt,
  moveScheduleBlock,
  PLAN_GENERATION_MODE_LABELS,
  readPlanDragPayload,
  recalculateScheduleStartTimes,
  setPlanScheduleDragData,
  type PlanGenerationMode,
} from '../utils/schedulePlan';
import {
  getActorIdsMapForSceneIds,
  resolveRehearsalPerformanceId,
} from '../utils/rehearsalActors';
import {
  canMarkBlockCompletion,
  canMarkScheduleCompletion,
  getScheduleCompletionStats,
  isPastRehearsalDay,
  isScheduleBlockCompletable,
} from '../utils/rehearsalScheduleCompletion';

const blockTypeLabels: Record<ScheduleBlockType, string> = {
  scene: 'Сцена',
  task: 'Задача',
  break: 'Перерыв',
  warmup: 'Разминка',
  custom: 'Другое',
  etude: 'Этюд',
};

const blockTypeIcons: Record<ScheduleBlockType, typeof Film> = {
  scene: Film,
  task: CheckSquare,
  break: Coffee,
  warmup: Sparkles,
  custom: Clock,
  etude: Wand2,
};

const blockTypeColors: Record<ScheduleBlockType, string> = {
  scene: 'border-l-emerald-500',
  task: 'border-l-blue-500',
  break: 'border-l-amber-500',
  warmup: 'border-l-purple-500',
  custom: 'border-l-gray-500',
  etude: 'border-l-violet-500',
};

const PLAN_GENERATION_OPTIONS: {
  mode: PlanGenerationMode;
  label: string;
  description: string;
}[] = [
  {
    mode: 'chronology',
    label: PLAN_GENERATION_MODE_LABELS.chronology,
    description: 'Сцены в порядке следования в пьесе',
  },
  {
    mode: 'by-actors',
    label: PLAN_GENERATION_MODE_LABELS['by-actors'],
    description: 'Сцены с общим составом ставятся рядом; при равенстве — по хронологии',
  },
  {
    mode: 'by-productions',
    label: PLAN_GENERATION_MODE_LABELS['by-productions'],
    description: 'Блоки одного спектакля подряд — удобно при сценах из нескольких постановок',
  },
];

interface RehearsalScheduleEditorProps {
  rehearsal: Rehearsal;
  /** @deprecated use playsById */
  play?: Play;
  playsById?: Record<string, Play>;
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
  playsById = {},
  linkedScenes,
  linkedTasks,
  onScheduleChange,
  onAddBlock,
  onEditBlock,
  onDeleteBlock,
  readOnly = false,
}: RehearsalScheduleEditorProps) {
  const { state } = useRehearsalStore();
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [generatePlanModalOpen, setGeneratePlanModalOpen] = useState(false);
  const [planGenerationMode, setPlanGenerationMode] = useState<PlanGenerationMode>('chronology');
  const [keepCurrentPlan, setKeepCurrentPlan] = useState(false);

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
  const pastRehearsal = isPastRehearsalDay(rehearsal);
  const completionStats = getScheduleCompletionStats(sortedSchedule);

  const applySchedule = (schedule: ScheduleBlock[]) => {
    onScheduleChange(recalculateScheduleStartTimes(schedule, rehearsal.startTime));
  };

  const openGeneratePlanModal = () => {
    if (linkedScenes.length === 0 && linkedTasks.length === 0) return;
    setPlanGenerationMode('chronology');
    setKeepCurrentPlan(false);
    setGeneratePlanModalOpen(true);
  };

  const confirmGeneratePlan = () => {
    const planOptions = {
      mode: planGenerationMode,
      actorIdsBySceneId:
        planGenerationMode === 'by-actors'
          ? getActorIdsMapForSceneIds(
              state,
              resolveRehearsalPerformanceId(state, rehearsal),
              rehearsal.sceneIds
            )
          : undefined,
    };

    const nextSchedule =
      keepCurrentPlan && sortedSchedule.length > 0
        ? appendScheduleFromRehearsalItems(
            sortedSchedule,
            rehearsal.startTime,
            rehearsal.sceneIds,
            rehearsal.taskIds,
            linkedScenes,
            linkedTasks,
            planOptions
          )
        : buildScheduleFromRehearsalItems(
            rehearsal.startTime,
            rehearsal.sceneIds,
            rehearsal.taskIds,
            linkedScenes,
            linkedTasks,
            planOptions
          );

    applySchedule(nextSchedule);
    setGeneratePlanModalOpen(false);
  };

  const handleDropAt = (event: React.DragEvent, targetIndex: number) => {
    if (readOnly) return;
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
    if (readOnly) return;
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

  const markAllBlocks = (completed: boolean) => {
    applySchedule(
      sortedSchedule.map((block) => {
        if (!isScheduleBlockCompletable(block)) return block;
        if (!canMarkBlockCompletion(rehearsal, block)) return block;
        if (block.completed === completed) return block;
        return { ...block, completed };
      })
    );
  };

  const clearAllMarks = () => {
    applySchedule(
      sortedSchedule.map((block) => {
        if (block.completed === undefined) return block;
        const { completed: _removed, ...rest } = block;
        return rest;
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
              {pastRehearsal
                ? 'Репетиция прошла — отметки можно проставить ретроспективно по каждому блоку или сразу по всему плану'
                : 'Итог появится после окончания каждого блока; повторное нажатие снимает отметку'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {showCompletionMarks && pastRehearsal && completionStats.total > 0 && !readOnly && (
            <>
              <Button variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={() => markAllBlocks(true)}>
                <Check size={14} />
                Всё сделано
              </Button>
              <Button variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={clearAllMarks}>
                Сбросить отметки
              </Button>
            </>
          )}
          {(linkedScenes.length > 0 || linkedTasks.length > 0) && (
            <Button variant="secondary" onClick={openGeneratePlanModal} disabled={readOnly}>
              <Wand2 size={16} />
              Сформировать план
            </Button>
          )}
          <Button onClick={onAddBlock} disabled={readOnly}>
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
            !readOnly && dragOverIndex === 0
              ? 'border-gold/50 bg-gold/5 text-gold-light'
              : 'border-gold/20 text-muted'
          }`}
          onDragEnter={readOnly ? undefined : (event) => handleDragOver(event, 0)}
          onDragOver={readOnly ? undefined : (event) => handleDragOver(event, 0)}
          onDragLeave={readOnly ? undefined : () => setDragOverIndex(null)}
          onDrop={readOnly ? undefined : (event) => handleDropAt(event, 0)}
        >
          {dragOverIndex === 0 ? 'Отпустите, чтобы добавить в план' : 'План пока пуст'}
          {!readOnly ? (
            <Button className="mt-4" variant="secondary" onClick={onAddBlock}>
              Добавить первый блок
            </Button>
          ) : (
            <p className="mt-4 text-xs text-muted">Редактирование плана недоступно в режиме просмотра</p>
          )}
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
            const blockPlay =
              block.type === 'etude' && block.playId
                ? playsById[block.playId] ?? state.plays.find((p) => p.id === block.playId)
                : blockScene
                  ? playsById[blockScene.playId] ?? play
                  : undefined;
            const sceneCharacters = blockScene
              ? getSceneCharacterNames(state, blockScene)
              : [];
            const etudeActorNames =
              block.type === 'etude' && block.actorIds?.length
                ? block.actorIds
                    .map((id) => state.actors.find((a) => a.id === id)?.name)
                    .filter((name): name is string => Boolean(name))
                : [];
            const participantLine =
              block.type === 'etude' ? etudeActorNames : sceneCharacters;
            const dropActive = dragOverIndex === index + 1;
            const canComplete = canMarkBlockCompletion(rehearsal, block);
            const isDone = block.completed === true;
            const isNotDone = block.completed === false;

            return (
              <div key={block.id}>
                <div
                  className={`group grid grid-cols-[auto_minmax(0,1fr)] gap-x-1.5 gap-y-2 rounded-xl border bg-surface/40 py-2.5 pl-1 pr-2.5 border-l-4 transition-shadow sm:grid-cols-[1rem_3.75rem_minmax(0,1fr)] sm:gap-x-1.5 sm:py-3 sm:pl-1.5 sm:pr-3 ${blockTypeColors[block.type]} ${
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
                  <div
                    draggable={!readOnly}
                    onDragStart={readOnly ? undefined : startScheduleDrag(block.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverIndex(null);
                    }}
                    aria-label={`Переместить блок ${block.title}`}
                    className="schedule-block-grip col-start-1 row-start-1 flex cursor-grab items-start justify-center self-start pt-0.5 text-muted active:cursor-grabbing sm:pt-1"
                  >
                    <GripVertical size={14} />
                  </div>

                  <div className="schedule-block-time col-start-2 row-start-1 flex min-w-0 items-baseline gap-1.5 self-start font-mono sm:block sm:pt-0.5 sm:text-right">
                    <p className="text-sm font-semibold leading-none text-gold-light">
                      {block.startTime}
                    </p>
                    <span className="text-[10px] text-muted/70 sm:hidden">—</span>
                    <p className="text-xs leading-none text-muted sm:mt-0">{endTime}</p>
                    <span className="hidden text-[10px] leading-none text-muted/70 sm:block">—</span>
                    <p className="schedule-block-duration text-[11px] font-medium leading-tight text-muted sm:pt-1.5">
                      {formatDuration(block.durationMinutes)}
                    </p>
                  </div>

                  <div className="relative col-span-2 min-w-0 border-t border-gold/10 pt-2 sm:col-span-1 sm:col-start-3 sm:border-l sm:border-t-0 sm:pt-0 sm:pl-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2 select-none">
                        <div className="flex items-start gap-2.5">
                          {blockPlay && (block.type === 'scene' || block.type === 'etude') ? (
                            <PlayIcon play={blockPlay} size="sm" className="mt-0.5 shrink-0" />
                          ) : (
                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-surface">
                              <Icon size={12} className="text-gold" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-base font-semibold leading-snug text-white">{block.title}</p>
                            {blockPlay && block.type === 'etude' && (
                              <p className="mt-1 text-sm leading-snug text-muted/90">
                                {blockPlay.title}
                              </p>
                            )}
                            {participantLine.length > 0 && (
                              <p className="mt-1 text-sm leading-snug text-muted">
                                {participantLine.join(', ')}
                              </p>
                            )}
                          </div>
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
                              className={`schedule-outcome-btn schedule-outcome-done inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                                isDone ? 'is-active' : ''
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
                              className={`schedule-outcome-btn schedule-outcome-not-done inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                                isNotDone ? 'is-active' : ''
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
                        {block.decidedNotes?.trim() && (
                          <div className="space-y-1 rounded-lg bg-gold/5 px-3 py-2 text-xs text-muted">
                            <p>
                              <span className="font-medium text-gold-light">Решения:</span>{' '}
                              <DecidedNotesDisplay text={block.decidedNotes.trim()} />
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="schedule-block-actions hidden shrink-0 gap-0.5 sm:flex">
                        {blockPlay && blockScene && (
                          <SceneScriptLink play={blockPlay} scene={blockScene} compact />
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
                        {blockPlay && blockScene && (
                          <SceneScriptLink play={blockPlay} scene={blockScene} />
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

      <Modal
        open={generatePlanModalOpen}
        onClose={() => setGeneratePlanModalOpen(false)}
        title="Сформировать план"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setGeneratePlanModalOpen(false)}>
              Отмена
            </Button>
            <Button
              variant={sortedSchedule.length > 0 && !keepCurrentPlan ? 'danger' : 'primary'}
              onClick={confirmGeneratePlan}
            >
              {sortedSchedule.length > 0
                ? keepCurrentPlan
                  ? 'Добавить в план'
                  : 'Заменить план'
                : 'Сформировать'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">Выберите, как расставить сцены в плане:</p>
          <div className="space-y-2">
            {PLAN_GENERATION_OPTIONS.map((option) => {
              const selected = planGenerationMode === option.mode;
              return (
                <label
                  key={option.mode}
                  className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    selected
                      ? 'border-gold/40 bg-gold/10 ring-1 ring-gold/20'
                      : 'border-gold/10 bg-background/20 hover:border-gold/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan-generation-mode"
                    value={option.mode}
                    checked={selected}
                    onChange={() => setPlanGenerationMode(option.mode)}
                    className="mt-1 accent-gold"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-white">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {option.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {sortedSchedule.length > 0 && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gold/10 bg-background/20 px-4 py-3">
              <input
                type="checkbox"
                checked={keepCurrentPlan}
                onChange={(event) => setKeepCurrentPlan(event.target.checked)}
                className="mt-0.5 accent-gold"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">Оставить текущий план</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                  Добавить в конец только сцены и задачи, которых ещё нет в расписании
                </span>
              </span>
            </label>
          )}
          {sortedSchedule.length > 0 && !keepCurrentPlan && (
            <p className="notice-warning rounded-xl px-4 py-3 text-sm font-medium leading-relaxed">
              Текущий план будет заменён. Ручные правки и порядок блоков пропадут.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
