import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowLeft,
  CheckSquare,
  Clock,
  Copy,
  GripVertical,
  MapPin,
  Pencil,
  Send,
  UserPlus,
} from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { generateId } from '../utils/id';
import { addMinutes } from '../utils/time';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from '../utils/sceneDefaults';
import { recalculateScheduleStartTimes, setPlanPoolDragData } from '../utils/schedulePlan';
import { fetchTelegramConfigured, sendTelegramHtmlMessage } from '../api/telegram';
import { resolveRehearsalLocation } from '../utils/venue';
import {
  buildRehearsalTelegramBotMessage,
  buildRehearsalTelegramMessage,
  copyRehearsalTelegramMessage,
} from '../utils/rehearsalTelegramExport';
import { getSceneShortLabel } from '../utils/sceneLabels';
import {
  applySceneIdsToSchedule,
  getSceneDurationsFromSchedule,
  getSceneIdsFromSchedule,
  updateSceneDurationInSchedule,
} from '../utils/scheduleSync';
import {
  formatPerformanceLabel,
  getActorAssignments,
  getPlayPerformances,
  getPlayRoles,
  getPlayScenes,
  getTheaterPlays,
  getTheaterTasks,
  getTheaterVenues,
  getShowRehearsalWarnings,
  getActiveActors,
} from '../store/selectors';
import {
  getRehearsalParticipantActorIds,
  mergeActorsForNewScenes,
  resolveRehearsalPerformanceId,
  sortParticipantOrderByParticipation,
} from '../utils/rehearsalActors';
import { ActorAvatar } from '../components/ActorAvatar';
import { SceneListGrouped } from '../components/SceneListGrouped';
import { ScenePicker } from '../components/ScenePicker';
import { SceneSelect } from '../components/SceneSelect';
import { RehearsalScheduleEditor } from '../components/RehearsalScheduleEditor';
import type {
  AttendanceStatus,
  Rehearsal,
  Scene,
  ScheduleBlock,
  ScheduleBlockType,
  Task,
} from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea, Select } from '../components/FormFields';
import { VenueSelect } from '../components/VenueSelect';
import { RehearsalWarningsPanel } from '../components/RehearsalWarningsPanel';
import { RehearsalCalendarActions } from '../components/RehearsalCalendarActions';
import { RehearsalPlanningPanel } from '../components/RehearsalPlanningPanel';
import {
  dismissRehearsalWarning,
  getActorScheduleConflicts,
  getRehearsalWarnings,
} from '../utils/rehearsalInsights';
import { getRehearsalEventTitle } from '../utils/rehearsalCalendar';
import { appPaths } from '../navigation/appPaths';

const blockTypeLabels: Record<ScheduleBlockType, string> = {
  scene: 'Сцена',
  task: 'Задача',
  break: 'Перерыв',
  warmup: 'Разминка',
  custom: 'Другое',
};

const attendanceLabels: Record<AttendanceStatus, string> = {
  present: 'Был(а)',
  late: 'Опоздал(а)',
  absent: 'Отсутствовал(а)',
  substitute: 'Замена',
};

const attendanceColors: Record<AttendanceStatus, string> = {
  present: 'attendance-badge attendance-badge-present',
  late: 'attendance-badge attendance-badge-late',
  absent: 'attendance-badge attendance-badge-absent',
  substitute: 'attendance-badge attendance-badge-substitute',
};

export function RehearsalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch, readOnly } = useRehearsalStore();
  const { confirm } = useConfirmDialog();
  const navigate = useNavigate();
  const rehearsal = state.rehearsals.find((r) => r.id === id);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramCopied, setTelegramCopied] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramSendError, setTelegramSendError] = useState<string | null>(null);
  const [telegramSent, setTelegramSent] = useState(false);
  const [draggingParticipantId, setDraggingParticipantId] = useState<string | null>(null);
  const [participantDragOverIndex, setParticipantDragOverIndex] = useState<number | null>(null);
  const [manualParticipantId, setManualParticipantId] = useState('');
  const [editForm, setEditForm] = useState<Omit<Rehearsal, 'id'> | null>(null);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [blockForm, setBlockForm] = useState<Omit<ScheduleBlock, 'id'>>({
    startTime: '18:00',
    durationMinutes: 30,
    type: 'scene',
    title: '',
    notes: '',
  });

  useEffect(() => {
    if (!telegramModalOpen) return;
    void fetchTelegramConfigured().then(setTelegramConfigured);
  }, [telegramModalOpen]);

  const rehearsalInsights = useMemo(() => {
    if (!rehearsal) {
      return { warnings: [], conflicts: [] };
    }
    return {
      warnings: getRehearsalWarnings(state, rehearsal),
      conflicts: getActorScheduleConflicts(state, rehearsal),
    };
  }, [state, rehearsal]);

  if (!rehearsal) {
    return (
      <div className="text-center">
        <p className="text-muted">Репетиция не найдена</p>
        <Link to={appPaths.rehearsals} className="mt-4 inline-block text-gold hover:underline">
          ← К календарю
        </Link>
      </div>
    );
  }

  const dismissRehearsalWarningItem = (warningId: string) => {
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: dismissRehearsalWarning(rehearsal, warningId),
    });
  };

  const theaterPlays = getTheaterPlays(state);
  const theaterTasks = getTheaterTasks(state);
  const theaterVenues = getTheaterVenues(state);
  const showRehearsalWarnings = getShowRehearsalWarnings(state);
  const sortedSchedule = [...rehearsal.schedule].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );

  const openAddBlock = () => {
    const lastBlock = sortedSchedule[sortedSchedule.length - 1];
    const startTime = lastBlock
      ? addMinutes(lastBlock.startTime, lastBlock.durationMinutes)
      : rehearsal.startTime;
    setEditingBlock(null);
    setBlockForm({
      startTime,
      durationMinutes: 30,
      type: 'scene',
      title: '',
      notes: '',
    });
    setBlockModalOpen(true);
  };

  const openEditBlock = (block: ScheduleBlock) => {
    setEditingBlock(block);
    setBlockForm({ ...block });
    setBlockModalOpen(true);
  };

  const saveBlock = () => {
    if (!blockForm.title.trim()) return;
    let schedule: ScheduleBlock[];
    if (editingBlock) {
      schedule = rehearsal.schedule.map((b) =>
        b.id === editingBlock.id ? { ...blockForm, id: editingBlock.id } : b
      );
    } else {
      schedule = [...rehearsal.schedule, { ...blockForm, id: generateId() }];
    }
    dispatch({
      type: 'UPDATE_SCHEDULE',
      payload: {
        rehearsalId: rehearsal.id,
        schedule: recalculateScheduleStartTimes(schedule, rehearsal.startTime),
      },
    });
    setBlockModalOpen(false);
  };

  const updateSchedule = (schedule: ScheduleBlock[]) => {
    dispatch({ type: 'UPDATE_SCHEDULE', payload: { rehearsalId: rehearsal.id, schedule } });
  };

  const deleteBlock = (blockId: string) => {
    const schedule = recalculateScheduleStartTimes(
      rehearsal.schedule.filter((b) => b.id !== blockId),
      rehearsal.startTime
    );
    dispatch({ type: 'UPDATE_SCHEDULE', payload: { rehearsalId: rehearsal.id, schedule } });
  };

  const deleteRehearsal = async () => {
    const confirmed = await confirm({
      title: 'Удалить репетицию?',
      message: 'Репетиция и её план будут удалены без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_REHEARSAL', payload: rehearsal.id });
    navigate(appPaths.rehearsals);
  };

  const openEditRehearsal = () => {
    const { id: _id, ...rest } = rehearsal;
    setEditForm({
      ...rest,
      sceneIds: getSceneIdsFromSchedule(rehearsal.schedule),
    });
    setEditModalOpen(true);
  };

  const saveRehearsal = () => {
    if (!editForm) return;
    dispatch({ type: 'UPDATE_REHEARSAL', payload: { ...editForm, id: rehearsal.id } });
    setEditModalOpen(false);
  };

  const toggleParticipant = (actorId: string) => {
    const actorIds = rehearsal.actorIds.includes(actorId)
      ? rehearsal.actorIds.filter((id) => id !== actorId)
      : [...rehearsal.actorIds, actorId];
    const participantOrder = sortParticipantOrderByParticipation(
      getRehearsalParticipantActorIds(state, rehearsal),
      actorIds
    );
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: { ...rehearsal, actorIds, participantOrder },
    });
  };

  const updateAttendance = (actorId: string, status: AttendanceStatus) => {
    const actorIds = rehearsal.actorIds.includes(actorId)
      ? rehearsal.actorIds
      : [...rehearsal.actorIds, actorId];
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: {
        ...rehearsal,
        actorIds,
        attendance: {
          ...(rehearsal.attendance ?? {}),
          [actorId]: status,
        },
      },
    });
  };

  const handleEditScenesChange = (sceneIds: string[]) => {
    if (!editForm) return;
    const schedule = applySceneIdsToSchedule(
      editForm,
      sceneIds,
      playScenes,
      getSceneDurationsFromSchedule(editForm.schedule)
    );
    const syncedSceneIds = getSceneIdsFromSchedule(schedule);
    setEditForm({
      ...editForm,
      sceneIds: syncedSceneIds,
      schedule,
      actorIds: mergeActorsForNewScenes(state, editForm, editForm.sceneIds, syncedSceneIds),
    });
  };

  const handleSceneDurationChange = (sceneId: string, minutes: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      schedule: updateSceneDurationInSchedule(editForm, sceneId, minutes),
    });
  };

  const rehearsalLocation = resolveRehearsalLocation(rehearsal, theaterVenues);

  const handleBlockTypeChange = (type: ScheduleBlockType) => {
    setBlockForm((f) => {
      const updated = { ...f, type };
      if (type === 'scene' && f.sceneId) {
        const scene = state.scenes.find((s) => s.id === f.sceneId);
        if (scene) updated.title = scene.title;
      }
      if (type === 'task' && f.taskId) {
        const task = theaterTasks.find((t) => t.id === f.taskId);
        if (task) updated.title = task.title;
      }
      return updated;
    });
  };

  const handleSceneSelect = (sceneId: string) => {
    const scene = state.scenes.find((s) => s.id === sceneId);
    setBlockForm((f) => ({
      ...f,
      sceneId,
      title: scene?.title ?? f.title,
      durationMinutes: scene?.estimatedMinutes ?? DEFAULT_SCENE_REHEARSAL_MINUTES,
    }));
  };

  const handleTaskSelect = (taskId: string) => {
    const task = theaterTasks.find((t) => t.id === taskId);
    setBlockForm((f) => ({
      ...f,
      taskId,
      title: task?.title ?? f.title,
    }));
  };

  const linkedScenes = getSceneIdsFromSchedule(rehearsal.schedule)
    .map((sid) => state.scenes.find((s) => s.id === sid))
    .filter((scene): scene is Scene => Boolean(scene));
  const playScenes = getPlayScenes(state, rehearsal.playId ?? state.activePlayId);
  const editPerformances = getPlayPerformances(state, editForm?.playId ?? rehearsal.playId ?? state.activePlayId ?? '');
  const pickerCharacterRoles = getPlayRoles(
    state,
    editForm?.playId ?? rehearsal.playId ?? state.activePlayId ?? '',
    'character'
  );
  const linkedTasks = rehearsal.taskIds
    .map((tid) => theaterTasks.find((t) => t.id === tid))
    .filter((task): task is Task => Boolean(task));
  const rehearsalPlay = theaterPlays.find(
    (play) => play.id === (rehearsal.playId ?? state.activePlayId)
  );
  const calendarTitle = getRehearsalEventTitle(rehearsalPlay?.title);

  const rehearsalPerformance = state.performances.find(
    (p) => p.id === resolveRehearsalPerformanceId(state, rehearsal)
  );
  const participantActorIds = getRehearsalParticipantActorIds(state, rehearsal);
  const participantActors = participantActorIds
    .map((aid) => state.actors.find((a) => a.id === aid))
    .filter(Boolean);

  const theaterActorPool = getActiveActors(state).filter(
    (actor) => !participantActorIds.includes(actor.id)
  );

  const addManualParticipant = () => {
    if (!manualParticipantId || participantActorIds.includes(manualParticipantId)) return;
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: {
        ...rehearsal,
        actorIds: [...new Set([...rehearsal.actorIds, manualParticipantId])],
        participantOrder: [...participantActorIds, manualParticipantId],
      },
    });
    setManualParticipantId('');
  };

  const reorderParticipants = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const order = [...participantActorIds];
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: { ...rehearsal, participantOrder: order },
    });
  };

  const handleParticipantDrop = (toIndex: number) => {
    if (!draggingParticipantId) return;
    const fromIndex = participantActorIds.indexOf(draggingParticipantId);
    if (fromIndex !== -1) reorderParticipants(fromIndex, toIndex);
    setDraggingParticipantId(null);
    setParticipantDragOverIndex(null);
  };

  const actorRolesInPlay = (actorId: string) => {
    const performanceId = resolveRehearsalPerformanceId(state, rehearsal);

    if (!performanceId) return '';

    return getActorAssignments(state, actorId)
      .filter((a) => a.performanceId === performanceId)
      .map((a) => state.playRoles.find((r) => r.id === a.roleId)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const telegramMessage = buildRehearsalTelegramMessage(state, rehearsal);

  const handleCopyTelegram = async () => {
    try {
      await copyRehearsalTelegramMessage(state, rehearsal);
      setTelegramCopied(true);
      window.setTimeout(() => setTelegramCopied(false), 2000);
    } catch {
      setTelegramCopied(false);
    }
  };

  const handleSendTelegram = async () => {
    setTelegramSending(true);
    setTelegramSendError(null);
    setTelegramSent(false);
    try {
      await sendTelegramHtmlMessage(buildRehearsalTelegramBotMessage(state, rehearsal));
      setTelegramSent(true);
      window.setTimeout(() => setTelegramSent(false), 3000);
    } catch (error) {
      setTelegramSendError(error instanceof Error ? error.message : 'Не удалось отправить');
    } finally {
      setTelegramSending(false);
    }
  };

  const openTelegramExport = () => {
    setTelegramCopied(false);
    setTelegramSendError(null);
    setTelegramSent(false);
    setTelegramModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link
            to={appPaths.rehearsals}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-gold"
          >
            <ArrowLeft size={16} /> К календарю
          </Link>
          <h1 className="text-3xl font-bold capitalize text-white">
            {format(parseISO(rehearsal.date), 'EEEE, d MMMM yyyy', { locale: ru })}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-muted">
            <span className="flex items-center gap-1">
              <Clock size={16} />
              {rehearsal.startTime} – {rehearsal.endTime}
            </span>
            {rehearsalLocation && (
              <span className="flex items-center gap-1">
                <MapPin size={16} /> {rehearsalLocation}
              </span>
            )}
            {rehearsalPerformance && (
              <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs text-gold-light">
                {formatPerformanceLabel(rehearsalPerformance)}
              </span>
            )}
          </div>
          {rehearsal.notes && <p className="mt-3 text-muted">{rehearsal.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <RehearsalCalendarActions
            rehearsal={rehearsal}
            title={calendarTitle}
            location={rehearsalLocation}
            compact
          />
          <Button variant="secondary" onClick={openTelegramExport}>
            <Send size={16} /> Telegram
          </Button>
          <Button variant="secondary" onClick={openEditRehearsal}>
            <Pencil size={16} /> Редактировать
          </Button>
          <DeleteButton label="Удалить репетицию" onClick={deleteRehearsal} />
        </div>
      </div>

      {showRehearsalWarnings && (
        <RehearsalWarningsPanel
          warnings={rehearsalInsights.warnings}
          conflicts={rehearsalInsights.conflicts}
          dismissedIds={rehearsal.dismissedWarningIds}
          onDismiss={dismissRehearsalWarningItem}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <RehearsalPlanningPanel rehearsal={rehearsal} />

          {linkedScenes.length > 0 && (
            <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
              <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted">
                Сцены ({linkedScenes.length})
              </h2>
              <p className="mb-3 text-xs text-muted">Перетащите в план справа</p>
              <SceneListGrouped
                scenes={linkedScenes}
                play={rehearsalPlay}
                compact
                draggable
              />
            </section>
          )}

          <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4">
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted">
              Участники
            </h2>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              Перетащите за ⋮⋮ для порядка. Добавьте замену или техника вручную. Статус посещаемости
              влияет на историю и Telegram.
            </p>
            {participantActors.length > 0 ? (
              <div className="space-y-2">
                {participantActors.map((actor, index) => {
                  const selected = rehearsal.actorIds.includes(actor!.id);
                  const attendance = rehearsal.attendance?.[actor!.id] ?? (selected ? 'present' : 'absent');
                  return (
                    <div
                      key={actor!.id}
                      className={`flex items-stretch gap-2 rounded-xl transition-colors ${
                        participantDragOverIndex === index ? 'bg-gold/10 ring-1 ring-gold/30' : ''
                      } ${draggingParticipantId === actor!.id ? 'opacity-50' : ''}`}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setParticipantDragOverIndex(index);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDragLeave={() => setParticipantDragOverIndex(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleParticipantDrop(index);
                      }}
                    >
                      <div
                        draggable={!readOnly}
                        onDragStart={() => setDraggingParticipantId(actor!.id)}
                        onDragEnd={() => {
                          setDraggingParticipantId(null);
                          setParticipantDragOverIndex(null);
                        }}
                        aria-label={`Изменить порядок: ${actor!.name}`}
                        className="flex shrink-0 cursor-grab items-center px-1 text-muted opacity-60 active:cursor-grabbing hover:opacity-100"
                      >
                        <GripVertical size={14} />
                      </div>
                      <div
                        className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 transition-colors ${
                          selected
                            ? 'border-gold/25 bg-gold/10 ring-1 ring-gold/20'
                            : 'border-transparent bg-white/[0.02] opacity-80 hover:border-gold/10 hover:opacity-100'
                        }`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <ActorAvatar name={actor!.name} photoUrl={actor!.photoUrl} size="sm" />
                          <button
                            type="button"
                            onClick={() => toggleParticipant(actor!.id)}
                            disabled={readOnly}
                            className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                          >
                            <p className={`truncate text-sm font-semibold ${selected ? 'text-white' : 'text-foreground/80'}`}>
                              {actor!.name}
                            </p>
                            <p className="line-clamp-2 text-xs leading-snug text-muted">
                              {actorRolesInPlay(actor!.id) || 'Роль не указана'}
                            </p>
                          </button>
                          <span
                            className={`participant-status shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              selected ? 'participant-status-active' : 'participant-status-inactive'
                            }`}
                          >
                            {selected ? 'участвует' : 'нет'}
                          </span>
                        </div>
                        <select
                          value={attendance}
                          disabled={readOnly}
                          onChange={(event) =>
                            updateAttendance(actor!.id, event.target.value as AttendanceStatus)
                          }
                          className={`mt-3 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${attendanceColors[attendance]}`}
                          aria-label={`Присутствие: ${actor!.name}`}
                        >
                          {Object.entries(attendanceLabels).map(([value, label]) => (
                            <option key={value} value={value} className="bg-surface text-white">
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">Пока нет участников — добавьте вручную или выберите сцены в плане.</p>
            )}

            {!readOnly && (
              <div className="mt-4 space-y-2 border-t border-gold/10 pt-4">
                <p className="text-xs font-medium text-muted">Добавить вручную</p>
                {theaterActorPool.length > 0 ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={manualParticipantId}
                      onChange={(event) => setManualParticipantId(event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-gold/15 bg-black/20 px-3 py-2.5 text-sm text-white focus:border-gold/40 focus:outline-none"
                    >
                      <option value="">Выберите из состава…</option>
                      {theaterActorPool.map((actor) => (
                        <option key={actor.id} value={actor.id} className="bg-surface">
                          {actor.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0"
                      disabled={!manualParticipantId}
                      onClick={addManualParticipant}
                    >
                      <UserPlus size={16} />
                      Добавить
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Все участники труппы уже в списке. Добавьте человека на странице «Участники».
                  </p>
                )}
              </div>
            )}
          </section>

          {linkedTasks.length > 0 && (
            <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
              <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted">
                Задачи
              </h2>
              <p className="mb-3 text-xs text-muted">Перетащите в план справа</p>
              <ul className="space-y-1">
                {linkedTasks.map((task) => (
                  <li
                    key={task!.id}
                    className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-white hover:bg-white/[0.03]"
                  >
                    <div
                      draggable
                      onDragStart={(event) =>
                        setPlanPoolDragData(event, {
                          source: 'pool',
                          kind: 'task',
                          id: task!.id,
                        })
                      }
                      aria-label={`Перетащить задачу ${task!.title}`}
                      className="flex shrink-0 cursor-grab text-muted opacity-60 active:cursor-grabbing hover:opacity-100"
                    >
                      <GripVertical size={14} />
                    </div>
                    <CheckSquare size={14} className="shrink-0 text-blue-400" />
                    <span>{task!.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0">
          <RehearsalScheduleEditor
            rehearsal={rehearsal}
            play={rehearsalPlay}
            linkedScenes={linkedScenes}
            linkedTasks={linkedTasks}
            onScheduleChange={updateSchedule}
            onAddBlock={openAddBlock}
            onEditBlock={openEditBlock}
            onDeleteBlock={deleteBlock}
            readOnly={readOnly}
          />
        </div>
      </div>

      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Редактировать репетицию"
        xl
        footer={
          editForm ? (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
                Отмена
              </Button>
              <Button onClick={saveRehearsal}>Сохранить</Button>
            </div>
          ) : undefined
        }
      >
        {editForm && (
          <div className="space-y-4">
            <Input
              label="Дата"
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Начало"
                type="time"
                value={editForm.startTime}
                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
              />
              <Input
                label="Конец"
                type="time"
                value={editForm.endTime}
                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
              />
            </div>
            <VenueSelect
              venues={theaterVenues}
              venueId={editForm.venueId}
              location={editForm.location}
              onChange={(patch) => setEditForm({ ...editForm, ...patch })}
            />
            <Textarea
              label="Заметки"
              value={editForm.notes ?? ''}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            />
            {theaterPlays.length > 1 && (
              <Select
                label="Постановка"
                value={editForm.playId ?? ''}
                onChange={(e) => {
                  const playId = e.target.value || undefined;
                  const performanceId = playId
                    ? resolveRehearsalPerformanceId(state, { playId })
                    : undefined;
                  setEditForm({
                    ...editForm,
                    playId,
                    performanceId,
                    sceneIds: [],
                  });
                }}
                options={[
                  { value: '', label: 'Без привязки' },
                  ...theaterPlays.map((p) => ({ value: p.id, label: p.title })),
                ]}
              />
            )}
            {editPerformances.length > 0 && editForm.playId && (
              <Select
                label="Показ"
                value={editForm.performanceId ?? resolveRehearsalPerformanceId(state, editForm) ?? ''}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    performanceId: e.target.value || undefined,
                  })
                }
                options={editPerformances.map((performance) => ({
                  value: performance.id,
                  label: formatPerformanceLabel(performance),
                }))}
              />
            )}
            {playScenes.length > 0 && (
              <ScenePicker
                scenes={playScenes}
                selectedIds={editForm.sceneIds}
                onChange={handleEditScenesChange}
                characterRoles={pickerCharacterRoles}
                playId={editForm.playId ?? state.activePlayId ?? undefined}
                excludeRehearsalId={rehearsal.id}
              />
            )}
            {editForm.sceneIds.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted">Длительность сцен в плане (мин)</p>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-gold/10 bg-background/20 p-3">
                  {editForm.sceneIds.map((sceneId) => {
                    const scene = playScenes.find((item) => item.id === sceneId);
                    if (!scene) return null;
                    const durations = getSceneDurationsFromSchedule(editForm.schedule);
                    const value =
                      durations[sceneId] ??
                      scene.estimatedMinutes ??
                      DEFAULT_SCENE_REHEARSAL_MINUTES;
                    return (
                      <label
                        key={sceneId}
                        className="flex items-center gap-3 text-sm text-white"
                      >
                        <input
                          type="number"
                          min={1}
                          step={5}
                          value={value}
                          onChange={(e) =>
                            handleSceneDurationChange(
                              sceneId,
                              Number(e.target.value) || DEFAULT_SCENE_REHEARSAL_MINUTES
                            )
                          }
                          className="w-16 rounded-lg border border-gold/15 bg-background/60 px-2 py-1 text-center text-sm text-white focus:border-gold/30 focus:outline-none"
                        />
                        <span className="min-w-0 flex-1 text-muted">
                          {getSceneShortLabel(scene)}
                          {scene.estimatedMinutes ? (
                            <span className="ml-1 text-xs text-muted/70">
                              (оценка {scene.estimatedMinutes} мин)
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        title={editingBlock ? 'Редактировать блок' : 'Новый блок плана'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setBlockModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveBlock}>Сохранить</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Тип"
            value={blockForm.type}
            onChange={(e) => handleBlockTypeChange(e.target.value as ScheduleBlockType)}
            options={Object.entries(blockTypeLabels).map(([value, label]) => ({ value, label }))}
          />

          {blockForm.type === 'scene' && playScenes.length > 0 && (
            <SceneSelect
              label="Сцена"
              scenes={playScenes}
              value={blockForm.sceneId ?? ''}
              onChange={handleSceneSelect}
            />
          )}

          {blockForm.type === 'task' && theaterTasks.length > 0 && (
            <Select
              label="Задача"
              value={blockForm.taskId ?? ''}
              onChange={(e) => handleTaskSelect(e.target.value)}
              options={[
                { value: '', label: '— выбрать —' },
                ...theaterTasks.map((t) => ({ value: t.id, label: t.title })),
              ]}
            />
          )}

          <Input
            label="Название"
            value={blockForm.title}
            onChange={(e) => setBlockForm({ ...blockForm, title: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Начало"
              type="time"
              value={blockForm.startTime}
              onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
            />
            <Input
              label="Длительность (мин)"
              type="number"
              value={blockForm.durationMinutes}
              onChange={(e) =>
                setBlockForm({ ...blockForm, durationMinutes: Number(e.target.value) || DEFAULT_SCENE_REHEARSAL_MINUTES })
              }
            />
          </div>
          <Textarea
            label="Заметки"
            value={blockForm.notes ?? ''}
            onChange={(e) => setBlockForm({ ...blockForm, notes: e.target.value })}
          />
          {blockForm.type === 'scene' && (
            <>
              <Textarea
                label="Что решили (внутренне, не для Telegram)"
                value={blockForm.decidedNotes ?? ''}
                onChange={(e) => setBlockForm({ ...blockForm, decidedNotes: e.target.value })}
              />
              <Textarea
                label="Что осталось сделать (внутренне, не для Telegram)"
                value={blockForm.remainingNotes ?? ''}
                onChange={(e) => setBlockForm({ ...blockForm, remainingNotes: e.target.value })}
              />
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={telegramModalOpen}
        onClose={() => setTelegramModalOpen(false)}
        title="Сообщение для Telegram"
        xl
        footer={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {telegramCopied && (
              <span className="text-sm text-emerald-300">Скопировано в буфер обмена</span>
            )}
            {telegramSent && (
              <span className="text-sm text-emerald-300">Отправлено в Telegram</span>
            )}
            <Button variant="secondary" onClick={() => setTelegramModalOpen(false)}>
              Закрыть
            </Button>
            <Button onClick={handleCopyTelegram}>
              <Copy size={16} />
              {telegramCopied ? 'Скопировано' : 'Скопировать'}
            </Button>
            {telegramConfigured && (
              <Button onClick={handleSendTelegram} disabled={telegramSending}>
                <Send size={16} />
                {telegramSending ? 'Отправка…' : 'Отправить в Telegram'}
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Telegram не принимает ссылки из буфера браузера. При «Скопировать» под каждой сценой
            будет строка 🔗 — она кликабельна в чате. Чтобы названия сцен были ссылками (как на
            скрине), настройте бота в <code className="text-gold/80">.env</code> и нажмите
            «Отправить в Telegram».
          </p>
          <textarea
            readOnly
            value={telegramMessage}
            rows={18}
            className="w-full resize-y rounded-xl border border-gold/15 bg-background/60 px-4 py-3 font-mono text-sm leading-relaxed text-white focus:border-gold/30 focus:outline-none"
            onFocus={(event) => event.target.select()}
          />
          {telegramSendError && (
            <p className="text-sm text-red-300">{telegramSendError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
