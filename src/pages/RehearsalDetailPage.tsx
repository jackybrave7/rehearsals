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
  Send,
  UserPlus,
} from 'lucide-react';
import { RehearsalActionsMenu } from '../components/RehearsalActionsMenu';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useAuth } from '../store/AuthContext';
import { generateId } from '../utils/id';
import { pageTitleClass } from '../utils/pageLayout';
import { addMinutes } from '../utils/time';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from '../utils/sceneDefaults';
import { recalculateScheduleStartTimes, setPlanPoolDragData } from '../utils/schedulePlan';
import { fetchTelegramStatus, sendTelegramHtmlMessage } from '../api/telegram';
import { fetchRehearsalRsvp } from '../api/rehearsalRsvp';
import { resolveRehearsalLocation } from '../utils/venue';
import {
  buildRehearsalTelegramBotMessage,
  buildRehearsalTelegramMessage,
  copyRehearsalTelegramMessage,
} from '../utils/rehearsalTelegramExport';
import { formatReminderKindLabel } from '../utils/reminders';
import { getSceneShortLabel } from '../utils/sceneLabels';
import {
  removeDeselectedScenesFromSchedule,
  getSceneDurationsFromSchedule,
  getSceneIdsFromSchedule,
  updateSceneDurationInSchedule,
} from '../utils/scheduleSync';
import {
  getActorAssignments,
  getTheaterPlays,
  getTheaterTasks,
  getTheaterVenues,
  getShowRehearsalWarnings,
  getActiveActors,
} from '../store/selectors';
import {
  getRehearsalParticipantActorIds,
  mergeActorsForNewScenes,
  resolvePerformanceIdForPlay,
  sortParticipantOrderByParticipation,
} from '../utils/rehearsalActors';
import { getArchivedPlaysInRehearsal, getRehearsalPlayIds } from '../utils/rehearsalPlays';
import { getRehearsalEventLabel } from '../utils/rehearsalCalendarMarkers';
import { isActorUnavailable, getActorUnavailabilityReason } from '../utils/actorAvailability';
import { ActorAvatar } from '../components/ActorAvatar';
import { TheaterSceneListGrouped } from '../components/TheaterSceneListGrouped';
import { TheaterScenePicker } from '../components/TheaterScenePicker';
import { SceneSelect } from '../components/SceneSelect';
import { RehearsalScheduleEditor } from '../components/RehearsalScheduleEditor';
import type {
  AttendanceStatus,
  Rehearsal,
  RsvpStatus,
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
import { RehearsalPlanningPanel } from '../components/RehearsalPlanningPanel';
import { GuideContextHelp } from '../components/guide/GuideContextHelp';
import { markGuidePlanExported } from '../utils/guidePlanExport';
import { MentionTextarea } from '../components/MentionTextarea';
import { buildMentionOptions } from '../utils/decidedNotesMentions';
import {
  dismissRehearsalWarning,
  getActorScheduleConflicts,
  getRehearsalWarnings,
  getVenueScheduleConflicts,
} from '../utils/rehearsalInsights';
import { appPaths } from '../navigation/appPaths';
import {
  countRsvpSummary,
  formatRsvpSummaryLine,
  rsvpColors,
  rsvpLabels,
  rsvpShortLabels,
} from '../utils/rehearsalRsvp';

const blockTypeLabels: Record<ScheduleBlockType, string> = {
  scene: 'Сцена',
  task: 'Задача',
  break: 'Перерыв',
  warmup: 'Разминка',
  custom: 'Другое',
  etude: 'Этюд',
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

const rsvpEmptyLabel = 'Без ответа';

export function RehearsalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch, readOnly } = useRehearsalStore();
  const { user } = useAuth();
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
    const theaterId = rehearsal?.theaterId ?? state.activeTheaterId;
    if (!telegramModalOpen || !theaterId) return;
    void fetchTelegramStatus(theaterId).then((status) => setTelegramConfigured(status.configured));
  }, [telegramModalOpen, rehearsal?.theaterId, state.activeTheaterId]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const refreshRsvp = async () => {
      try {
        const rsvp = await fetchRehearsalRsvp(id);
        if (cancelled) return;
        dispatch({ type: 'PATCH_REHEARSAL_RSVP', payload: { rehearsalId: id, rsvp } });
      } catch {
        // ignore transient polling errors
      }
    };

    void refreshRsvp();
    const intervalId = window.setInterval(() => void refreshRsvp(), 15_000);
    const onFocus = () => void refreshRsvp();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [id, dispatch]);

  const rehearsalInsights = useMemo(() => {
    if (!rehearsal) {
      return { warnings: [], conflicts: [], venueConflicts: [] };
    }
    return {
      warnings: getRehearsalWarnings(state, rehearsal),
      conflicts: getActorScheduleConflicts(state, rehearsal),
      venueConflicts: getVenueScheduleConflicts(state, rehearsal),
    };
  }, [state, rehearsal]);

  const editDraftRehearsal = useMemo<Rehearsal | null>(() => {
    if (!editForm || !rehearsal) return null;
    return { ...editForm, id: rehearsal.id };
  }, [editForm, rehearsal]);

  const editInsights = useMemo(() => {
    if (!editDraftRehearsal) {
      return { warnings: [], conflicts: [], venueConflicts: [] };
    }
    return {
      warnings: getRehearsalWarnings(state, editDraftRehearsal),
      conflicts: getActorScheduleConflicts(state, editDraftRehearsal),
      venueConflicts: getVenueScheduleConflicts(state, editDraftRehearsal),
    };
  }, [state, editDraftRehearsal]);

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
    if (readOnly) return;
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: dismissRehearsalWarning(rehearsal, warningId),
    });
  };

  const theaterPlays = getTheaterPlays(state);
  const theaterTasks = getTheaterTasks(state);
  const theaterVenues = getTheaterVenues(state);
  const showRehearsalWarnings = getShowRehearsalWarnings(state);
  const openAddBlock = () => {
    if (readOnly) return;
    const lastBlock = rehearsal.schedule[rehearsal.schedule.length - 1];
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
    if (readOnly) return;
    setEditingBlock(block);
    setBlockForm({ ...block });
    setBlockModalOpen(true);
  };

  const saveBlock = () => {
    if (readOnly) return;
    let title = blockForm.title.trim();
    if (!title && blockForm.type === 'scene' && blockForm.sceneId) {
      title = state.scenes.find((s) => s.id === blockForm.sceneId)?.title?.trim() ?? '';
    }
    if (!title) return;
    let schedule: ScheduleBlock[];
    const blockPayload = { ...blockForm, title };
    if (editingBlock) {
      schedule = rehearsal.schedule.map((b) =>
        b.id === editingBlock.id ? { ...blockPayload, id: editingBlock.id } : b
      );
    } else {
      schedule = [...rehearsal.schedule, { ...blockPayload, id: generateId() }];
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
    if (readOnly) return;
    dispatch({ type: 'UPDATE_SCHEDULE', payload: { rehearsalId: rehearsal.id, schedule } });
  };

  const deleteBlock = (blockId: string) => {
    if (readOnly) return;
    const schedule = recalculateScheduleStartTimes(
      rehearsal.schedule.filter((b) => b.id !== blockId),
      rehearsal.startTime
    );
    dispatch({ type: 'UPDATE_SCHEDULE', payload: { rehearsalId: rehearsal.id, schedule } });
  };

  const deleteRehearsal = async () => {
    if (readOnly) return;
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
    if (readOnly) return;
    const { id: _id, ...rest } = rehearsal;
    setEditForm({
      ...rest,
      sceneIds:
        rehearsal.sceneIds.length > 0
          ? rehearsal.sceneIds
          : getSceneIdsFromSchedule(rehearsal.schedule),
    });
    setEditModalOpen(true);
  };

  const saveRehearsal = () => {
    if (readOnly || !editForm) return;
    dispatch({ type: 'UPDATE_REHEARSAL', payload: { ...editForm, id: rehearsal.id } });
    setEditModalOpen(false);
  };

  const toggleParticipant = (actorId: string) => {
    if (readOnly) return;
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
    if (readOnly) return;
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

  const updateRsvp = (actorId: string, status: RsvpStatus | '') => {
    if (readOnly) return;
    const next = { ...(rehearsal.rsvp ?? {}) };
    if (!status) delete next[actorId];
    else next[actorId] = status;
    dispatch({
      type: 'UPDATE_REHEARSAL',
      payload: { ...rehearsal, rsvp: next },
    });
  };

  const handleEditScenesChange = (sceneIds: string[]) => {
    if (!editForm) return;
    const schedule = removeDeselectedScenesFromSchedule(editForm, sceneIds);
    setEditForm({
      ...editForm,
      sceneIds,
      schedule,
      actorIds: mergeActorsForNewScenes(state, editForm, editForm.sceneIds, sceneIds),
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
      const base = {
        startTime: f.startTime,
        durationMinutes: f.durationMinutes,
        notes: f.notes,
        type,
      };
      switch (type) {
        case 'scene': {
          const scene = f.sceneId ? state.scenes.find((s) => s.id === f.sceneId) : undefined;
          return {
            ...base,
            sceneId: f.sceneId,
            title: scene?.title ?? '',
            decidedNotes: f.decidedNotes,
          };
        }
        case 'task': {
          const task = f.taskId ? theaterTasks.find((t) => t.id === f.taskId) : undefined;
          return {
            ...base,
            taskId: f.taskId,
            title: task?.title ?? blockTypeLabels.task,
          };
        }
        case 'etude':
          return {
            ...base,
            playId: f.playId,
            actorIds: f.actorIds,
            title: 'Этюд',
          };
        case 'break':
          return { ...base, title: blockTypeLabels.break };
        case 'warmup':
          return { ...base, title: blockTypeLabels.warmup };
        case 'custom':
          return { ...base, title: f.title || '' };
        default:
          return { ...base, title: f.title };
      }
    });
  };

  const handleEtudePlaySelect = (playId: string) => {
    setBlockForm((f) => ({
      ...f,
      playId: playId || undefined,
    }));
  };

  const toggleEtudeActor = (actorId: string) => {
    setBlockForm((f) => {
      const current = f.actorIds ?? [];
      const actorIds = current.includes(actorId)
        ? current.filter((id) => id !== actorId)
        : [...current, actorId];
      return { ...f, actorIds: actorIds.length > 0 ? actorIds : undefined };
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

  const linkedScenes = rehearsal.sceneIds
    .map((sid) => state.scenes.find((s) => s.id === sid))
    .filter((scene): scene is Scene => Boolean(scene));
  const theaterScenes = state.scenes.filter((scene) =>
    theaterPlays.some((play) => play.id === scene.playId)
  );
  const selectablePlanScenes = (() => {
    const playIds = new Set(getRehearsalPlayIds(state, rehearsal));
    if (state.activePlayId) playIds.add(state.activePlayId);
    if (playIds.size > 0) {
      return theaterScenes.filter((scene) => scene.playId && playIds.has(scene.playId));
    }
    return theaterScenes;
  })();
  const playsById = Object.fromEntries(theaterPlays.map((play) => [play.id, play]));
  const linkedTasks = rehearsal.taskIds
    .map((tid) => theaterTasks.find((t) => t.id === tid))
    .filter((task): task is Task => Boolean(task));
  const calendarTitle = getRehearsalEventLabel(state, rehearsal);
  const rehearsalPlayTitles = getRehearsalPlayIds(state, rehearsal)
    .map((playId) => theaterPlays.find((play) => play.id === playId)?.title)
    .filter((title): title is string => Boolean(title));
  const participantActorIds = getRehearsalParticipantActorIds(state, rehearsal);
  const participantActors = participantActorIds
    .map((aid) => state.actors.find((a) => a.id === aid))
    .filter(Boolean);
  const rsvpSummary = countRsvpSummary(rehearsal, participantActorIds);
  const activeActors = getActiveActors(state);

  const theaterActorPool = activeActors.filter(
    (actor) => !participantActorIds.includes(actor.id)
  );

  const addManualParticipant = () => {
    if (readOnly || !manualParticipantId || participantActorIds.includes(manualParticipantId)) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
    if (!draggingParticipantId) return;
    const fromIndex = participantActorIds.indexOf(draggingParticipantId);
    if (fromIndex !== -1) reorderParticipants(fromIndex, toIndex);
    setDraggingParticipantId(null);
    setParticipantDragOverIndex(null);
  };

  const actorRolesInRehearsal = (actorId: string) => {
    const playIds = getRehearsalPlayIds(state, rehearsal);
    if (playIds.length === 0) return '';

    const parts: string[] = [];
    for (const playId of playIds) {
      const performanceId = resolvePerformanceIdForPlay(state, playId);
      if (!performanceId) continue;

      const roleNames = getActorAssignments(state, actorId)
        .filter((a) => a.performanceId === performanceId)
        .map((a) => state.playRoles.find((r) => r.id === a.roleId)?.name)
        .filter(Boolean);

      if (roleNames.length === 0) continue;

      const play = theaterPlays.find((p) => p.id === playId);
      if (playIds.length > 1 && play) {
        parts.push(`${roleNames.join(', ')} · «${play.title}»`);
      } else {
        parts.push(roleNames.join(', '));
      }
    }

    return parts.join(' · ');
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
    const theaterId = rehearsal.theaterId ?? state.activeTheaterId;
    if (!theaterId) {
      setTelegramSendError('Не выбран театр для отправки');
      return;
    }
    setTelegramSending(true);
    setTelegramSendError(null);
    setTelegramSent(false);
    try {
      await sendTelegramHtmlMessage(
        theaterId,
        buildRehearsalTelegramBotMessage(state, rehearsal, {
          initiatedBy: user?.name?.trim() || user?.email,
        })
      );
      dispatch({
        type: 'UPDATE_REHEARSAL',
        payload: { ...rehearsal, telegramPlanSentAt: new Date().toISOString() },
      });
      markGuidePlanExported(dispatch);
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            to={appPaths.rehearsals}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-gold"
          >
            <ArrowLeft size={16} /> К календарю
          </Link>
          <h1 className={`${pageTitleClass} capitalize`}>
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
            {rehearsalPlayTitles.length > 0 && (
              <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs text-gold-light">
                {rehearsalPlayTitles.map((title) => `«${title}»`).join(' · ')}
              </span>
            )}
          </div>
          {rehearsal.notes && <p className="mt-3 text-muted">{rehearsal.notes}</p>}
        </div>
        <div className="shrink-0 self-start sm:self-auto">
        <RehearsalActionsMenu
          rehearsal={rehearsal}
          title={calendarTitle}
          location={rehearsalLocation}
          onTelegram={openTelegramExport}
          onPlanExported={() => markGuidePlanExported(dispatch)}
          onEdit={readOnly ? undefined : openEditRehearsal}
          onDelete={readOnly ? undefined : deleteRehearsal}
        />
        </div>
      </div>

      {showRehearsalWarnings && (
        <RehearsalWarningsPanel
          warnings={rehearsalInsights.warnings}
          conflicts={rehearsalInsights.conflicts}
          venueConflicts={rehearsalInsights.venueConflicts}
          dismissedIds={rehearsal.dismissedWarningIds}
          onDismiss={dismissRehearsalWarningItem}
        />
      )}

      <section className="rounded-2xl border border-gold/10 bg-surface/40 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-muted">
              Напоминания в Telegram
            </p>
            {!readOnly && (
              <label className="flex cursor-pointer items-center gap-3 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={rehearsal.reminderOptOut ?? false}
                  onChange={() =>
                    dispatch({
                      type: 'UPDATE_REHEARSAL',
                      payload: { ...rehearsal, reminderOptOut: !rehearsal.reminderOptOut },
                    })
                  }
                  className="h-4 w-4 rounded border-gold/30 accent-gold"
                />
                Не напоминать по этой репетиции
              </label>
            )}
            {rehearsal.reminderOptOut && (
              <p className="text-sm text-amber-200">Авто-напоминания отключены для этой репетиции</p>
            )}
            {(rehearsal.remindersSent ?? []).length > 0 ? (
              <ul className="space-y-1 text-sm text-muted">
                {(rehearsal.remindersSent ?? []).map((entry, index) => {
                  const actorLabel = entry.actorId
                    ? state.actors.find((actor) => actor.id === entry.actorId)?.name ?? 'участнику'
                    : null;
                  return (
                    <li key={`${entry.kind}-${entry.actorId ?? ''}-${entry.at}-${index}`}>
                      {actorLabel ? (
                        <>
                          {actorLabel}: напоминание {formatReminderKindLabel(entry.kind, entry.offsetHours)}{' '}
                          отправлено в {format(parseISO(entry.at), 'HH:mm', { locale: ru })}
                        </>
                      ) : (
                        <>
                          Напоминание {formatReminderKindLabel(entry.kind, entry.offsetHours)} отправлено в{' '}
                          {format(parseISO(entry.at), 'HH:mm', { locale: ru })}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Личные напоминания ещё не отправлялись. Включите в «Настройках» и подключите бота у участников.
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <RehearsalPlanningPanel rehearsal={rehearsal} />

          {linkedScenes.length > 0 && (
            <section className="rounded-2xl border border-gold/10 bg-surface/40 p-5">
              <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted">
                Сцены ({linkedScenes.length})
              </h2>
              <p className="mb-3 text-xs text-muted">Перетащите в план справа</p>
              <TheaterSceneListGrouped
                plays={theaterPlays}
                scenes={linkedScenes}
                compact
                draggable={!readOnly}
              />
            </section>
          )}

          <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4">
            <h2 className="mb-1 text-sm font-medium uppercase tracking-wide text-muted">
              Участники
            </h2>
            <p className="participants-hint mb-3 text-xs leading-relaxed">
              Перетащите за ⋮⋮ для порядка. Добавьте замену или техника вручную. Статус посещаемости
              влияет на историю и Telegram. RSVP приходит из Telegram-бота или задаётся вручную.
            </p>
            {rehearsal.actorIds.length > 0 && (
              <p className="mb-3 text-xs font-medium text-gold-light">
                RSVP: {formatRsvpSummaryLine(rsvpSummary)}
              </p>
            )}
            {participantActors.length > 0 ? (
              <div className="space-y-2">
                {participantActors.map((actor, index) => {
                  const selected = rehearsal.actorIds.includes(actor!.id);
                  const attendance = rehearsal.attendance?.[actor!.id] ?? (selected ? 'present' : 'absent');
                  const rsvpStatus = rehearsal.rsvp?.[actor!.id];
                  const unavailable = isActorUnavailable(actor!, rehearsal.date, {
                    startTime: rehearsal.startTime,
                    endTime: rehearsal.endTime,
                  });
                  const unavailReason = unavailable
                    ? getActorUnavailabilityReason(actor!, rehearsal.date, {
                        startTime: rehearsal.startTime,
                        endTime: rehearsal.endTime,
                      })
                    : undefined;
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
                          unavailable
                            ? 'border-amber-500/25 bg-amber-500/5'
                            : selected
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
                            title={unavailReason ? `Недоступен: ${unavailReason}` : undefined}
                          >
                            <p className={`truncate text-sm font-semibold ${selected ? 'text-white' : 'text-foreground/80'}`}>
                              {actor!.name}
                              {unavailable && (
                                <span className="ml-2 text-xs font-normal text-amber-300">
                                  · недоступен
                                </span>
                              )}
                            </p>
                            <p className="participant-role line-clamp-2 text-xs leading-snug">
                              {actorRolesInRehearsal(actor!.id) || 'Роль не указана'}
                            </p>
                          </button>
                          <span
                            className={`participant-status shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                              selected ? 'participant-status-active' : 'participant-status-inactive'
                            }`}
                          >
                            {selected ? 'участвует' : 'нет'}
                          </span>
                          {rsvpStatus && (
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${rsvpColors[rsvpStatus]}`}
                              title={`RSVP: ${rsvpLabels[rsvpStatus]}`}
                            >
                              {rsvpShortLabels[rsvpStatus]} {rsvpLabels[rsvpStatus]}
                            </span>
                          )}
                        </div>
                        {readOnly ? (
                          !rsvpStatus && (
                            <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted">
                              RSVP: {rsvpEmptyLabel}
                            </span>
                          )
                        ) : (
                          <select
                            value={rsvpStatus ?? ''}
                            onChange={(event) =>
                              updateRsvp(actor!.id, event.target.value as RsvpStatus | '')
                            }
                            className={`mt-2 w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none ${
                              rsvpStatus ? rsvpColors[rsvpStatus] : 'border-white/10 bg-white/5 text-muted'
                            }`}
                            aria-label={`RSVP: ${actor!.name}`}
                          >
                            <option value="" className="bg-surface text-white">
                              {rsvpEmptyLabel}
                            </option>
                            {Object.entries(rsvpLabels).map(([value, label]) => (
                              <option key={value} value={value} className="bg-surface text-white">
                                {label}
                              </option>
                            ))}
                          </select>
                        )}
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
                      {theaterActorPool.map((actor) => {
                        const unavailable = isActorUnavailable(actor, rehearsal.date, {
                          startTime: rehearsal.startTime,
                          endTime: rehearsal.endTime,
                        });
                        const reason = unavailable
                          ? getActorUnavailabilityReason(actor, rehearsal.date, {
                              startTime: rehearsal.startTime,
                              endTime: rehearsal.endTime,
                            })
                          : undefined;
                        return (
                          <option
                            key={actor.id}
                            value={actor.id}
                            className="bg-surface"
                            title={reason ? `Недоступен: ${reason}` : undefined}
                          >
                            {actor.name}
                            {unavailable ? ' (недоступен)' : ''}
                          </option>
                        );
                      })}
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
                      draggable={!readOnly}
                      onDragStart={
                        readOnly
                          ? undefined
                          : (event) =>
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
          <div className="mb-2 flex justify-end">
            <GuideContextHelp anchor="репетиция" label="Справка: репетиция и план" />
          </div>
          <RehearsalScheduleEditor
            rehearsal={rehearsal}
            playsById={playsById}
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

            {(editInsights.warnings.length > 0 ||
              editInsights.conflicts.length > 0 ||
              editInsights.venueConflicts.length > 0) && (
              <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">
                {editInsights.warnings.map((warning) => (
                  <p key={warning.id} className="text-amber-100">
                    {warning.message}
                  </p>
                ))}
                {editInsights.conflicts.map((conflict) => (
                  <p
                    key={`${conflict.actor.id}-${conflict.otherRehearsal.id}`}
                    className="text-amber-100"
                  >
                    {conflict.actor.name} уже в репетиции «{conflict.otherPlayTitle}» в это время (
                    {conflict.otherRehearsal.startTime}–{conflict.otherRehearsal.endTime}).
                  </p>
                ))}
                {editInsights.venueConflicts.map((conflict) => (
                  <p
                    key={`${conflict.venue.id}-${conflict.otherRehearsal.id}`}
                    className="text-amber-100"
                  >
                    Площадка «{conflict.venue.name}» уже занята репетицией «
                    {conflict.otherPlayTitle}» в это время (
                    {conflict.otherRehearsal.startTime}–{conflict.otherRehearsal.endTime}).
                  </p>
                ))}
              </div>
            )}

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
            {getArchivedPlaysInRehearsal(state, { ...editForm, id: rehearsal.id }).length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                В плане есть сцены из архивных постановок:{' '}
                {getArchivedPlaysInRehearsal(state, { ...editForm, id: rehearsal.id })
                  .map((play) => `«${play.title}»`)
                  .join(', ')}
              </div>
            )}
            {theaterScenes.length > 0 && (
              <TheaterScenePicker
                plays={theaterPlays}
                scenes={theaterScenes}
                selectedIds={editForm.sceneIds}
                onChange={handleEditScenesChange}
                defaultPlayId={editForm.playId ?? rehearsal.playId ?? state.activePlayId}
                excludeRehearsalId={rehearsal.id}
              />
            )}
            {getSceneIdsFromSchedule(editForm.schedule).length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted">Длительность сцен в плане (мин)</p>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-gold/10 bg-background/20 p-3">
                  {getSceneIdsFromSchedule(editForm.schedule).map((sceneId) => {
                    const scene = state.scenes.find((item) => item.id === sceneId);
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

          {blockForm.type === 'scene' && selectablePlanScenes.length > 0 && (
            <SceneSelect
              label="Сцена"
              scenes={selectablePlanScenes}
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

          {blockForm.type === 'etude' && theaterPlays.length > 0 && (
            <Select
              label="Постановка"
              value={blockForm.playId ?? ''}
              onChange={(e) => handleEtudePlaySelect(e.target.value)}
              options={[
                { value: '', label: '— без привязки —' },
                ...theaterPlays.map((play) => ({ value: play.id, label: play.title })),
              ]}
            />
          )}

          {blockForm.type === 'etude' && activeActors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Участники этюда</p>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-gold/10 bg-background/20 p-2">
                <div className="flex flex-wrap gap-2">
                  {activeActors.map((actor) => {
                    const selected = blockForm.actorIds?.includes(actor.id) ?? false;
                    const unavailable = isActorUnavailable(actor, rehearsal.date, {
                      startTime: rehearsal.startTime,
                      endTime: rehearsal.endTime,
                    });
                    const reason = unavailable
                      ? getActorUnavailabilityReason(actor, rehearsal.date, {
                          startTime: rehearsal.startTime,
                          endTime: rehearsal.endTime,
                        })
                      : undefined;
                    return (
                      <button
                        key={actor.id}
                        type="button"
                        title={reason ? `Недоступен: ${reason}` : undefined}
                        onClick={() => toggleEtudeActor(actor.id)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          selected
                            ? 'bg-gold/20 text-gold-light'
                            : unavailable
                              ? 'bg-amber-500/10 text-amber-200/80 hover:bg-amber-500/20'
                              : 'bg-white/5 text-muted hover:bg-white/10'
                        }`}
                      >
                        {actor.name}
                        {unavailable ? ' ⚠' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
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
            <MentionTextarea
              label="Решения и корректировки"
              value={blockForm.decidedNotes ?? ''}
              onChange={(decidedNotes) => setBlockForm({ ...blockForm, decidedNotes })}
              options={buildMentionOptions(state, rehearsal, blockForm.sceneId)}
              rows={4}
              placeholder="Опишите решения. Введите @, чтобы адресовать строку актёру или роли."
            />
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
            будет строка 🔗 — она кликабельна в чате. Чтобы названия сцен были ссылками, подключите
            чат театра в настройках и нажмите «Отправить в Telegram».
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
