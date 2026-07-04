import { useEffect, useMemo, useState } from 'react';
import { addDays, addWeeks, endOfWeek, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarDays, ExternalLink, MessageSquare, Sparkles, Theater, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { patchActorAvailability, patchActorRsvp, fetchActorNotes, acknowledgeActorNote, fetchActorRehearsalsRsvp } from '../api/actorSelf';
import { ActorAvailabilityCalendar } from '../components/ActorAvailabilityCalendar';
import { MemorizationStatusBadge } from '../components/MemorizationStatusBadge';
import { PlayIcon } from '../components/PlayIcon';
import { Modal } from '../components/Modal';
import { SceneStatusBadge } from '../components/SceneStatusBadge';
import { Button } from '../components/Button';
import { getWeekStart } from '../components/WeekCalendar';
import { useAuth } from '../store/AuthContext';
import { useDesign } from '../store/DesignContext';
import { useRehearsalStore } from '../store/RehearsalContext';
import type { Actor, ActorUnavailability, AppState, Rehearsal, RehearsalActorNote, RsvpStatus } from '../types';
import { findLinkedActor, findTheaterWithLinkedActor, getActorScenes, getActorScenesInRehearsal } from '../utils/actorProfile';
import {
  buildActorPlaySummaries,
  formatMemorizationProgressLabel,
  getActorUpcomingRehearsals,
  groupActorScenesByPlay,
} from '../utils/actorMyPage';
import { getMemorizationStatus } from '../utils/memorization';
import {
  createWeekdayUnavailability,
  formatUnavailabilityTimeRange,
  isFullDayUnavailability,
} from '../utils/actorAvailability';
import { resolveSceneScriptUrl } from '../utils/googleDocs';
import { getScenePlayId } from '../utils/rehearsalPlays';
import { isRehearsalPast } from '../utils/rehearsalSort';
import { rsvpShortLabels } from '../utils/rehearsalRsvp';
import { getSceneShortLabel } from '../utils/sceneLabels';
import { formatNoteLabel } from '../utils/rehearsalActorNotes';
import { resolveRehearsalLocation } from '../utils/venue';
import { generateId } from '../utils/id';
import { appPaths } from '../navigation/appPaths';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

const RSVP_STATUSES: RsvpStatus[] = ['confirmed', 'declined', 'late'];

function getUpcomingTheaterRehearsals(rehearsals: Rehearsal[], theaterId: string | null): Rehearsal[] {
  return rehearsals
    .filter(
      (rehearsal) =>
        (!theaterId || rehearsal.theaterId === theaterId) && !isRehearsalPast(rehearsal)
    )
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.startTime.localeCompare(b.startTime);
    });
}

function ActorRsvpButtons({
  currentRsvp,
  disabled,
  onRsvp,
}: {
  currentRsvp?: RsvpStatus;
  disabled?: boolean;
  onRsvp: (status: RsvpStatus) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {RSVP_STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          disabled={disabled}
          onClick={() => onRsvp(status)}
          className={`rounded-xl border px-4 py-2 text-sm transition-colors disabled:opacity-60 ${
            currentRsvp === status
              ? 'border-gold/40 bg-gold/15 text-gold-light'
              : 'border-gold/15 bg-black/20 text-muted hover:border-gold/30 hover:text-foreground'
          }`}
        >
          {rsvpShortLabels[status]}
        </button>
      ))}
    </div>
  );
}

function ActorUpcomingRehearsalCard({
  rehearsal,
  linkedActor,
  state,
  isNearest,
  saving,
  onRsvp,
}: {
  rehearsal: Rehearsal;
  linkedActor: Actor;
  state: AppState;
  isNearest?: boolean;
  saving: boolean;
  onRsvp: (status: RsvpStatus) => void;
}) {
  const { isZen } = useDesign();
  const playTitleClass = isZen ? 'text-foreground' : 'text-gold-light';
  const location = resolveRehearsalLocation(rehearsal, state.venues);
  const scenesInRehearsal = getActorScenesInRehearsal(state, rehearsal, linkedActor.id);
  const scenesByPlay = groupActorScenesByPlay(state, scenesInRehearsal);
  const currentRsvp = rehearsal.rsvp?.[linkedActor.id];

  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        isNearest ? 'border-gold/25 bg-gold/5' : 'border-gold/10 bg-black/15'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className={`font-semibold text-foreground ${isNearest ? 'text-lg' : 'text-sm'}`}>
          {format(parseISO(rehearsal.date), 'd MMMM, EEEE', { locale: ru })}
        </p>
        {isNearest && (
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-light">
            Ближайшая
          </span>
        )}
      </div>
      <p className={`text-muted ${isNearest ? 'text-sm' : 'text-sm'}`}>
        {rehearsal.startTime.slice(0, 5)}–{rehearsal.endTime.slice(0, 5)}
        {location ? ` · ${location}` : ''}
      </p>
      {scenesInRehearsal.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Мои сцены в плане</p>
          {scenesByPlay.map(({ play, scenes }) => (
            <div key={play?.id ?? 'unknown'}>
              {play && (
                <p className={`text-xs font-medium ${playTitleClass}`}>«{play.title}»</p>
              )}
              <ul
                className={`mt-0.5 space-y-0.5 ${isNearest ? 'text-sm text-foreground' : 'text-xs text-muted'}`}
              >
                {scenes.map((scene) => (
                  <li key={scene.id}>{getSceneShortLabel(scene)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        <ActorRsvpButtons currentRsvp={currentRsvp} disabled={saving} onRsvp={onRsvp} />
      </div>
    </div>
  );
}

export function MyPage() {
  const { user } = useAuth();
  const { isZen } = useDesign();
  const { state, dispatch } = useRehearsalStore();
  const theaterId = state.activeTheaterId;
  const linkedActor = findLinkedActor(state, user?.email, theaterId, user?.name);
  const alternateTheater = findTheaterWithLinkedActor(state, user?.email, user?.name);
  const activeTheaterName = state.theaters.find((t) => t.id === theaterId)?.name;

  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [draftUnavailability, setDraftUnavailability] = useState<ActorUnavailability[]>([]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [rsvpSavingId, setRsvpSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actorNotes, setActorNotes] = useState<RehearsalActorNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesSceneFilter, setNotesSceneFilter] = useState('');
  const [ackSavingId, setAckSavingId] = useState<string | null>(null);

  const upcoming = useMemo(
    () => getUpcomingTheaterRehearsals(state.rehearsals, theaterId),
    [state.rehearsals, theaterId]
  );

  const myUpcomingRehearsals = useMemo(
    () => (linkedActor ? getActorUpcomingRehearsals(state, linkedActor.id, theaterId) : []),
    [state, linkedActor, theaterId]
  );

  const upcomingRehearsalIds = useMemo(
    () => myUpcomingRehearsals.map((rehearsal) => rehearsal.id).join(','),
    [myUpcomingRehearsals]
  );

  useEffect(() => {
    if (!linkedActor || !theaterId || myUpcomingRehearsals.length === 0) return;
    let cancelled = false;

    const refreshRsvp = async () => {
      try {
        const rehearsals = await fetchActorRehearsalsRsvp(theaterId);
        if (cancelled) return;
        for (const entry of rehearsals) {
          dispatch({
            type: 'PATCH_REHEARSAL_RSVP',
            payload: { rehearsalId: entry.rehearsalId, rsvp: entry.rsvp },
          });
        }
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
  }, [linkedActor?.id, theaterId, upcomingRehearsalIds, dispatch]);

  const myNextRehearsal = myUpcomingRehearsals[0] ?? null;

  const nearestRehearsalWithoutMe = useMemo(() => {
    if (!linkedActor || myNextRehearsal) return null;
    return upcoming[0] ?? null;
  }, [upcoming, linkedActor, myNextRehearsal]);

  const myScenes = useMemo(
    () => (linkedActor ? getActorScenes(state, linkedActor.id) : []),
    [state, linkedActor]
  );

  const myPlaysWithScenes = useMemo(() => {
    const playIds = new Set(
      myScenes
        .map((scene) => getScenePlayId(state, scene.id))
        .filter((playId): playId is string => Boolean(playId))
    );
    return state.plays
      .filter((play) => playIds.has(play.id))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }, [myScenes, state]);

  const defaultScenesPlayId = useMemo(() => {
    if (state.activePlayId && myPlaysWithScenes.some((play) => play.id === state.activePlayId)) {
      return state.activePlayId;
    }
    return myPlaysWithScenes[0]?.id ?? '';
  }, [state.activePlayId, myPlaysWithScenes]);

  const [selectedScenesPlayId, setSelectedScenesPlayId] = useState('');

  useEffect(() => {
    setSelectedScenesPlayId((current) => {
      if (current && myPlaysWithScenes.some((play) => play.id === current)) return current;
      return defaultScenesPlayId;
    });
  }, [myPlaysWithScenes, defaultScenesPlayId]);

  const filteredMyScenes = useMemo(() => {
    if (!selectedScenesPlayId) return myScenes;
    return myScenes.filter((scene) => getScenePlayId(state, scene.id) === selectedScenesPlayId);
  }, [myScenes, selectedScenesPlayId, state]);

  const myPlaySummaries = useMemo(
    () => (linkedActor ? buildActorPlaySummaries(state, linkedActor.id, theaterId) : []),
    [state, linkedActor, theaterId]
  );

  useEffect(() => {
    if (!linkedActor || !theaterId) {
      setActorNotes([]);
      return;
    }
    let cancelled = false;
    setNotesLoading(true);
    void fetchActorNotes(theaterId)
      .then((notes) => {
        if (!cancelled) setActorNotes(notes);
      })
      .catch(() => {
        if (!cancelled) setActorNotes([]);
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkedActor, theaterId]);

  const filteredActorNotes = useMemo(() => {
    const sorted = [...actorNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!notesSceneFilter) return sorted;
    return sorted.filter((note) => note.sceneId === notesSceneFilter);
  }, [actorNotes, notesSceneFilter]);

  const visibleActorNotes = notesExpanded ? filteredActorNotes : filteredActorNotes.slice(0, 3);

  const noteSceneOptions = useMemo(() => {
    const sceneIds = new Set(actorNotes.map((note) => note.sceneId).filter(Boolean) as string[]);
    return state.scenes.filter((scene) => sceneIds.has(scene.id));
  }, [actorNotes, state.scenes]);

  const handleAcknowledgeNote = async (noteId: string) => {
    if (!theaterId) return;
    setAckSavingId(noteId);
    try {
      const updated = await acknowledgeActorNote(theaterId, noteId);
      setActorNotes((current) =>
        current.map((note) => (note.id === updated.id ? updated : note))
      );
      dispatch({ type: 'MERGE_REHEARSAL_ACTOR_NOTES', payload: [updated] });
    } catch {
      setError('Не удалось отметить замечание.');
    } finally {
      setAckSavingId(null);
    }
  };

  const openAvailabilityModal = () => {
    setDraftUnavailability(linkedActor?.unavailability ? [...linkedActor.unavailability] : []);
    setAvailabilityOpen(true);
    setError(null);
  };

  const handleRsvp = async (rehearsalId: string, status: RsvpStatus) => {
    if (!linkedActor || !theaterId) return;
    const rehearsal = state.rehearsals.find((item) => item.id === rehearsalId);
    if (!rehearsal) return;

    const currentRsvp = rehearsal.rsvp?.[linkedActor.id];
    setRsvpSavingId(rehearsalId);
    setError(null);
    try {
      const nextStatus = currentRsvp === status ? null : status;
      const rsvp = await patchActorRsvp(rehearsalId, nextStatus);
      dispatch({
        type: 'UPDATE_REHEARSAL',
        payload: { ...rehearsal, rsvp },
      });
    } catch {
      setError('Не удалось сохранить ответ. Попробуйте ещё раз.');
    } finally {
      setRsvpSavingId(null);
    }
  };

  const handleSaveAvailability = async () => {
    if (!linkedActor || !theaterId) return;
    setSavingAvailability(true);
    setError(null);
    try {
      const unavailability = await patchActorAvailability(theaterId, draftUnavailability);
      dispatch({
        type: 'UPDATE_ACTOR',
        payload: { ...linkedActor, unavailability },
      });
      setAvailabilityOpen(false);
    } catch {
      setError('Не удалось сохранить доступность.');
    } finally {
      setSavingAvailability(false);
    }
  };

  const addUnavailabilityPeriod = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setDraftUnavailability((current) => [
      ...current,
      { id: generateId(), from: today, to: today, reason: '' },
    ]);
  };

  const addPresetToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setDraftUnavailability((current) => [
      ...current,
      { id: generateId(), from: today, to: today, reason: 'Сегодня' },
    ]);
  };

  const addPresetTomorrow = () => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    setDraftUnavailability((current) => [
      ...current,
      { id: generateId(), from: tomorrow, to: tomorrow, reason: 'Завтра' },
    ]);
  };

  const addPresetNextWeek = () => {
    const nextWeek = addWeeks(new Date(), 1);
    const from = format(getWeekStart(nextWeek), 'yyyy-MM-dd');
    const to = format(endOfWeek(nextWeek, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    setDraftUnavailability((current) => [
      ...current,
      { id: generateId(), from, to, reason: 'Следующая неделя' },
    ]);
  };

  const addPresetWeekdays = () => {
    setDraftUnavailability((current) => [
      ...current,
      createWeekdayUnavailability([1, 2, 3, 4, 5], 'Будни (пн–пт)', generateId()),
    ]);
  };

  const addPresetWeekdaysUntil19 = () => {
    setDraftUnavailability((current) => [
      ...current,
      createWeekdayUnavailability([1, 2, 3, 4, 5], 'Будни до 19:00', generateId(), {
        startTime: '00:00',
        endTime: '19:00',
      }),
    ]);
  };

  const weekdayLabels = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  const togglePeriodWeekday = (index: number, day: number) => {
    setDraftUnavailability((current) =>
      current.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        const weekdays = new Set(entry.weekdays ?? []);
        if (weekdays.has(day)) weekdays.delete(day);
        else weekdays.add(day);
        return { ...entry, weekdays: [...weekdays].sort((a, b) => a - b) };
      })
    );
  };

  const setPeriodWeeklyRecurrence = (index: number, weekly: boolean) => {
    setDraftUnavailability((current) =>
      current.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        if (!weekly) {
          return { ...entry, recurrence: 'none', weekdays: undefined };
        }
        return {
          ...entry,
          recurrence: 'weekly',
          weekdays: entry.weekdays?.length ? entry.weekdays : [1, 2, 3, 4, 5],
        };
      })
    );
  };

  const formatPeriodLabel = (period: ActorUnavailability): string | null => {
    const timeLabel = formatUnavailabilityTimeRange(period);
    if (period.recurrence === 'weekly' && period.weekdays?.length) {
      const labels = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
      const days = period.weekdays.map((day) => labels[day]).join(', ');
      return `Еженедельно: ${days} · ${timeLabel}`;
    }
    if (timeLabel !== 'весь день') return timeLabel;
    return null;
  };

  const setPeriodFullDay = (index: number, fullDay: boolean) => {
    setDraftUnavailability((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? fullDay
            ? { ...entry, startTime: undefined, endTime: undefined }
            : { ...entry, startTime: entry.startTime ?? '10:00', endTime: entry.endTime ?? '19:00' }
          : entry
      )
    );
  };

  const sectionClass = isZen
    ? 'rounded-2xl border border-border/60 bg-surface/80 p-4 sm:p-5'
    : 'rounded-2xl border border-gold/10 bg-surface/40 p-4 sm:p-5';

  if (!linkedActor) {
    return (
      <div className="space-y-6">
        <header className={pageHeaderClass}>
          <h1 className={pageTitleClass}>Моё</h1>
        </header>
        <div className={`${sectionClass} text-center`}>
          <UserCircle size={40} className="mx-auto text-muted" strokeWidth={1.25} />
          {alternateTheater && alternateTheater.theaterId !== theaterId ? (
            <>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                В театре «{activeTheaterName ?? 'текущий'}» профиль участника не найден. Ваш профиль
                есть в театре «{alternateTheater.theaterName}».
              </p>
              <Button
                className="mt-4"
                onClick={() => dispatch({ type: 'SET_ACTIVE_THEATER', payload: alternateTheater.theaterId })}
              >
                Переключиться на «{alternateTheater.theaterName}»
              </Button>
            </>
          ) : (
            <>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Профиль участника не найден. Email в вашем аккаунте (
                <span className="text-foreground">{user?.email}</span>) должен совпадать с email в карточке
                участника театра.
              </p>
              <p className="mt-3 text-sm text-muted">
                Попросите режиссёра указать ваш email в карточке участника или обратитесь в{' '}
                <Link to={appPaths.support} className="text-gold-light hover:underline">
                  поддержку
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Моё</h1>
          <p className="mt-1 text-sm text-muted">{linkedActor.name}</p>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className={sectionClass}>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <CalendarDays size={16} />
          {myUpcomingRehearsals.length > 1 ? 'Мои репетиции' : 'Ближайшая репетиция'}
        </div>

        {myUpcomingRehearsals.length > 0 && linkedActor ? (
          <div className="space-y-3">
            {myUpcomingRehearsals.map((item, index) => {
              const rehearsal = state.rehearsals.find((entry) => entry.id === item.id) ?? item;
              return (
                <ActorUpcomingRehearsalCard
                  key={rehearsal.id}
                  rehearsal={rehearsal}
                  linkedActor={linkedActor}
                  state={state}
                  isNearest={index === 0}
                  saving={rsvpSavingId === rehearsal.id}
                  onRsvp={(status) => void handleRsvp(rehearsal.id, status)}
                />
              );
            })}
          </div>
        ) : nearestRehearsalWithoutMe ? (
          <p className="text-sm text-muted">
            В ближайшей репетиции ({format(parseISO(nearestRehearsalWithoutMe.date), 'd MMM', { locale: ru })},{' '}
            {nearestRehearsalWithoutMe.startTime.slice(0, 5)}) вас нет в плане.
          </p>
        ) : (
          <p className="text-sm text-muted">Пока нет запланированных репетиций.</p>
        )}
      </section>

      <section className={sectionClass}>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Theater size={16} />
          Мои постановки
        </div>
        {myPlaySummaries.length === 0 ? (
          <p className="text-sm text-muted">Постановки с вашими ролями пока не назначены.</p>
        ) : (
          <ul className="space-y-2">
            {myPlaySummaries.map(({ play, roleName, sceneCount, memorization, nextRehearsal }) => (
              <li
                key={play.id}
                className="flex items-start gap-3 rounded-xl border border-gold/10 bg-black/15 px-3 py-3"
              >
                <PlayIcon play={play} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">«{play.title}»</p>
                  <p className="text-sm text-gold-light">{roleName}</p>
                  <p className="mt-1 text-xs text-muted">
                    {sceneCount > 0
                      ? `${sceneCount} сцен · ${formatMemorizationProgressLabel(memorization)}`
                      : 'нет сцен'}
                    {nextRehearsal && (
                      <>
                        {' · '}
                        след. реп.{' '}
                        {format(parseISO(nextRehearsal.date), 'd MMM', { locale: ru })}
                      </>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={sectionClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
            <Sparkles size={16} />
            Мои сцены
          </div>
          {myPlaysWithScenes.length > 0 && (
            <select
              value={selectedScenesPlayId}
              onChange={(e) => setSelectedScenesPlayId(e.target.value)}
              className={`max-w-full rounded-xl border px-3 py-1.5 text-sm ${
                isZen
                  ? 'border-border/60 bg-surface text-foreground'
                  : 'border-gold/15 bg-black/20 text-foreground'
              }`}
              aria-label="Постановка"
            >
              {myPlaysWithScenes.map((play) => (
                <option key={play.id} value={play.id}>
                  «{play.title}»
                </option>
              ))}
            </select>
          )}
        </div>
        {myScenes.length === 0 ? (
          <p className="text-sm text-muted">Сцены с вашими ролями пока не назначены.</p>
        ) : filteredMyScenes.length === 0 ? (
          <p className="text-sm text-muted">В этой постановке нет ваших сцен.</p>
        ) : (
          <ul className="space-y-3">
            {filteredMyScenes.map((scene) => {
              const playId = getScenePlayId(state, scene.id);
              const play = state.plays.find((item) => item.id === playId);
              const scriptUrl = resolveSceneScriptUrl(play, scene);
              const memStatus = linkedActor
                ? getMemorizationStatus(linkedActor.memorizationByScene, scene.id)
                : 'not_started';
              return (
                <li
                  key={scene.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-gold/10 bg-black/15 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{getSceneShortLabel(scene)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <SceneStatusBadge status={scene.status} />
                    <MemorizationStatusBadge status={memStatus} variant={isZen ? 'zen' : 'theater'} />
                    {scriptUrl && (
                      <a
                        href={scriptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-gold-light hover:underline"
                      >
                        <ExternalLink size={12} />
                        Текст
                      </a>
                    )}
                    <Link
                      to={appPaths.learnScene(scene.id)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        isZen
                          ? 'border-border/60 bg-surface text-foreground hover:border-accent/40'
                          : 'border-gold/25 bg-gold/10 text-gold-light hover:border-gold/40'
                      }`}
                    >
                      Учить текст
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!notesLoading && actorNotes.length > 0 && (
      <section className={sectionClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
            <MessageSquare size={16} />
            Мои замечания
          </div>
          {noteSceneOptions.length > 0 && (
            <select
              value={notesSceneFilter}
              onChange={(event) => setNotesSceneFilter(event.target.value)}
              className="rounded-lg border border-gold/15 bg-black/20 px-2 py-1.5 text-xs text-white"
            >
              <option value="">Все сцены</option>
              {noteSceneOptions.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {getSceneShortLabel(scene)}
                </option>
              ))}
            </select>
          )}
        </div>

        {filteredActorNotes.length === 0 ? (
          <p className="text-sm text-muted">Нет замечаний по выбранной сцене</p>
        ) : (
          <>
            <ul className="space-y-3">
              {visibleActorNotes.map((note) => {
                const rehearsal = state.rehearsals.find((item) => item.id === note.rehearsalId);
                return (
                  <li
                    key={note.id}
                    className="rounded-xl border border-gold/10 bg-black/15 px-3 py-2.5 text-sm"
                  >
                    <p className="mb-1 text-xs text-muted">
                      {formatNoteLabel(note, state.scenes, rehearsal?.date)}
                    </p>
                    <p className="whitespace-pre-wrap text-foreground">{note.text}</p>
                    {note.sentAt && (
                      <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={Boolean(note.acknowledgedAt)}
                          disabled={Boolean(note.acknowledgedAt) || ackSavingId === note.id}
                          onChange={() => void handleAcknowledgeNote(note.id)}
                          className="h-3.5 w-3.5 rounded border-gold/30 accent-gold"
                        />
                        учтено
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
            {filteredActorNotes.length > 3 && (
              <button
                type="button"
                onClick={() => setNotesExpanded((value) => !value)}
                className="mt-3 text-xs text-gold-light hover:underline"
              >
                {notesExpanded
                  ? 'Свернуть'
                  : `Показать ещё (${filteredActorNotes.length - 3})`}
              </button>
            )}
          </>
        )}
      </section>
      )}

      <section className={sectionClass}>
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
            <CalendarDays size={16} />
            Когда не могу
          </div>
          <Button variant="secondary" onClick={openAvailabilityModal}>
            Отметить занятость
          </Button>
        </div>
        <p className="mb-3 text-sm text-muted">
          Отметьте дни, когда <span className="text-foreground">не сможете</span> прийти на репетицию.
          Режиссёр увидит это при планировании. Свободные дни отмечать не нужно.
        </p>

        <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-amber-500/30 ring-1 ring-amber-500/40" />
            весь день
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-amber-500/15 ring-1 ring-dashed ring-amber-500/40" />
            часть дня
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded bg-black/15 ring-1 ring-white/10" />
            без отметки
          </span>
        </div>

        <ActorAvailabilityCalendar actor={linkedActor} isZen={isZen} defaultView="month" />
      </section>

      <Modal
        open={availabilityOpen}
        onClose={() => setAvailabilityOpen(false)}
        title="Когда не могу прийти"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setAvailabilityOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void handleSaveAvailability()} disabled={savingAvailability}>
              {savingAvailability ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm leading-relaxed text-amber-100">
            Здесь отмечаются только дни, когда вы <strong>не можете</strong> на репетицию. Это не
            расписание занятий — свободные дни добавлять не нужно.
          </p>

          <p className="text-xs text-muted">Быстрые отметки «не могу»:</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={addPresetToday}>
              Сегодня
            </Button>
            <Button variant="secondary" onClick={addPresetTomorrow}>
              Завтра
            </Button>
            <Button variant="secondary" onClick={addPresetNextWeek}>
              Следующая неделя
            </Button>
            <Button variant="secondary" onClick={addPresetWeekdays}>
              Будни (пн–пт)
            </Button>
            <Button variant="secondary" onClick={addPresetWeekdaysUntil19}>
              Будни до 19:00
            </Button>
          </div>

          {draftUnavailability.length === 0 ? (
            <p className="text-sm text-muted">
              Пока нет отметок «не могу». Нажмите кнопку выше или добавьте период вручную.
            </p>
          ) : (
            draftUnavailability.map((period, index) => (
              <div key={period.id} className="space-y-2 rounded-xl border border-gold/10 bg-black/15 p-3">
                {formatPeriodLabel(period) && (
                  <p className="text-xs font-medium text-amber-200/90">{formatPeriodLabel(period)}</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-muted">
                    С
                    <input
                      type="date"
                      value={period.from}
                      onChange={(event) =>
                        setDraftUnavailability((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, from: event.target.value } : entry
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gold/15 bg-black/20 px-2 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-muted">
                    По
                    <input
                      type="date"
                      value={period.to}
                      onChange={(event) =>
                        setDraftUnavailability((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, to: event.target.value } : entry
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gold/15 bg-black/20 px-2 py-2 text-sm text-white"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={isFullDayUnavailability(period)}
                    onChange={(event) => setPeriodFullDay(index, event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gold/30 accent-gold"
                  />
                  Весь день
                </label>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={period.recurrence === 'weekly'}
                    onChange={(event) => setPeriodWeeklyRecurrence(index, event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gold/30 accent-gold"
                  />
                  Повторять еженедельно
                </label>
                {period.recurrence === 'weekly' && (
                  <div className="flex flex-wrap gap-1.5">
                    {weekdayLabels.map((label, day) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => togglePeriodWeekday(index, day)}
                        className={`rounded-lg border px-2 py-1 text-xs ${
                          period.weekdays?.includes(day)
                            ? 'border-gold/40 bg-gold/15 text-gold-light'
                            : 'border-gold/15 bg-black/20 text-muted hover:border-gold/30'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {!isFullDayUnavailability(period) && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-muted">
                      Не могу с
                      <input
                        type="time"
                        value={period.startTime ?? ''}
                        onChange={(event) =>
                          setDraftUnavailability((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, startTime: event.target.value }
                                : entry
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gold/15 bg-black/20 px-2 py-2 text-sm text-white"
                      />
                    </label>
                    <label className="text-xs text-muted">
                      до
                      <input
                        type="time"
                        value={period.endTime ?? ''}
                        onChange={(event) =>
                          setDraftUnavailability((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, endTime: event.target.value }
                                : entry
                            )
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gold/15 bg-black/20 px-2 py-2 text-sm text-white"
                      />
                    </label>
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Причина (необязательно)"
                  value={period.reason ?? ''}
                  onChange={(event) =>
                    setDraftUnavailability((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, reason: event.target.value } : entry
                      )
                    )
                  }
                  className="w-full rounded-lg border border-gold/15 bg-black/20 px-3 py-2 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraftUnavailability((current) => current.filter((entry) => entry.id !== period.id))
                  }
                  className="text-xs text-red-300 hover:underline"
                >
                  Удалить период
                </button>
              </div>
            ))
          )}
          <Button variant="secondary" onClick={addUnavailabilityPeriod}>
            Добавить период «не могу»
          </Button>
        </div>
      </Modal>
    </div>
  );
}
