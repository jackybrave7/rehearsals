import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus, MapPin, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import {
  getActiveActors,
  getActivePlay,
  getTheaterPlays,
  getTheaterRehearsals,
  getTheaterTasks,
  getTheaterVenues,
  getActiveTheater,
} from '../store/selectors';
import { generateId } from '../utils/id';
import { appPaths } from '../navigation/appPaths';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';
import type { Rehearsal } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Textarea, Select } from '../components/FormFields';
import { Calendar } from '../components/Calendar';
import { WeekCalendar, getWeekStart } from '../components/WeekCalendar';
import { VenueSelect } from '../components/VenueSelect';
import { TheaterScenePicker } from '../components/TheaterScenePicker';
import { resolveRehearsalLocation } from '../utils/venue';
import { mergeActorsForNewScenes } from '../utils/rehearsalActors';
import { isActorUnavailable, getActorUnavailabilityReason } from '../utils/actorAvailability';
import {
  getRehearsalWarnings,
  getActorScheduleConflicts,
  getVenueScheduleConflicts,
} from '../utils/rehearsalInsights';
import { suggestRehearsalDates } from '../utils/suggestRehearsalDates';
import { getUpcomingRehearsals } from '../utils/rehearsalSort';
import { RehearsalActionsMenu } from '../components/RehearsalActionsMenu';
import { getArchivedPlaysInRehearsal, rehearsalInvolvesActor, rehearsalInvolvesPlay } from '../utils/rehearsalPlays';
import { CalendarPlayMarkers } from '../components/CalendarPlayMarkers';
import { getRehearsalEventLabel, getRehearsalPlayMarkers } from '../utils/rehearsalCalendarMarkers';

const emptyRehearsal = (date: string, theaterId?: string): Omit<Rehearsal, 'id'> => ({
  theaterId,
  date,
  startTime: '18:00',
  endTime: '21:00',
  location: '',
  notes: '',
  sceneIds: [],
  taskIds: [],
  schedule: [],
  actorIds: [],
  attendance: {},
});

export function RehearsalsPage() {
  const { state, dispatch, readOnly } = useRehearsalStore();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<'month' | 'week'>('month');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [filterPlayId, setFilterPlayId] = useState('');
  const [filterActorId, setFilterActorId] = useState('');
  const [form, setForm] = useState(emptyRehearsal(format(new Date(), 'yyyy-MM-dd')));
  const theaterPlays = getTheaterPlays(state);
  const activePlay = getActivePlay(state);
  const activeTheater = getActiveTheater(state);
  const allTheaterRehearsals = getTheaterRehearsals(state);
  const visibleRehearsals = useMemo(() => {
    let list = allTheaterRehearsals;
    if (filterPlayId) {
      list = list.filter((rehearsal) => rehearsalInvolvesPlay(state, rehearsal, filterPlayId));
    }
    if (filterActorId) {
      list = list.filter((rehearsal) => rehearsalInvolvesActor(state, rehearsal, filterActorId));
    }
    return list;
  }, [allTheaterRehearsals, filterPlayId, filterActorId, state]);
  const theaterScenes = useMemo(
    () =>
      state.scenes.filter((scene) =>
        theaterPlays.some((play) => play.id === scene.playId)
      ),
    [state.scenes, theaterPlays]
  );
  const getPlayMarkers = useMemo(
    () => (rehearsal: Rehearsal) => getRehearsalPlayMarkers(state, rehearsal),
    [state]
  );
  const theaterTasks = getTheaterTasks(state);
  const theaterVenues = getTheaterVenues(state);
  const activeActors = getActiveActors(state);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const dayRehearsals = selectedDateStr
    ? visibleRehearsals.filter((r) => r.date === selectedDateStr)
    : [];
  const upcomingRehearsals = useMemo(
    () => getUpcomingRehearsals(visibleRehearsals, 5),
    [visibleRehearsals]
  );

  const rehearsalScenes = theaterScenes;

  const draftRehearsal = useMemo<Rehearsal>(
    () => ({
      ...form,
      id: '__draft__',
      theaterId: form.theaterId ?? state.activeTheaterId ?? undefined,
    }),
    [form, state.activeTheaterId]
  );

  const createWarnings = useMemo(
    () => getRehearsalWarnings(state, draftRehearsal),
    [state, draftRehearsal]
  );

  const createConflicts = useMemo(
    () => getActorScheduleConflicts(state, draftRehearsal),
    [state, draftRehearsal]
  );

  const createVenueConflicts = useMemo(
    () => getVenueScheduleConflicts(state, draftRehearsal),
    [state, draftRehearsal]
  );

  const venueConflictRehearsalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const rehearsal of visibleRehearsals) {
      if (getVenueScheduleConflicts(state, rehearsal).length > 0) {
        ids.add(rehearsal.id);
      }
    }
    return ids;
  }, [state, visibleRehearsals]);

  const suggestedSlots = useMemo(
    () =>
      suggestRehearsalDates(state, draftRehearsal, {
        fromDate: parseISO(form.date),
      }),
    [state, draftRehearsal, form.date]
  );

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setCurrentMonth(date);
    setWeekStart(getWeekStart(date));
  };

  const openCreate = () => {
    if (readOnly) return;
    setForm(
      emptyRehearsal(
        selectedDateStr ?? format(new Date(), 'yyyy-MM-dd'),
        state.activeTheaterId ?? undefined
      )
    );
    setModalOpen(true);
  };

  const handleSave = () => {
    if (readOnly) return;
    const rehearsal: Rehearsal = {
      ...form,
      id: generateId(),
      theaterId: form.theaterId ?? state.activeTheaterId ?? undefined,
    };
    dispatch({ type: 'ADD_REHEARSAL', payload: rehearsal });
    setModalOpen(false);
    navigate(appPaths.rehearsal(rehearsal.id));
  };

  const toggleActor = (actorId: string) => {
    setForm((f) => ({
      ...f,
      actorIds: f.actorIds.includes(actorId)
        ? f.actorIds.filter((id) => id !== actorId)
        : [...f.actorIds, actorId],
    }));
  };

  const toggleScene = (sceneIds: string[]) => {
    setForm((f) => ({
      ...f,
      sceneIds,
      actorIds: mergeActorsForNewScenes(state, f, f.sceneIds, sceneIds),
    }));
  };

  const toggleTask = (taskId: string) => {
    setForm((f) => ({
      ...f,
      taskIds: f.taskIds.includes(taskId)
        ? f.taskIds.filter((id) => id !== taskId)
        : [...f.taskIds, taskId],
    }));
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">
      <header className={pageHeaderClass}>
        <div className="min-w-0">
          <h1 className={pageTitleClass}>Репетиции</h1>
          <p className="mt-0.5 hidden text-sm text-muted sm:block">
            {activeTheater
              ? `${activeTheater.name} — календарь и расписание`
              : 'Календарь и расписание'}
          </p>
        </div>
        {!readOnly && (
          <Button onClick={openCreate} className="w-full shrink-0 sm:w-auto">
            <Plus size={18} />
            Новая репетиция
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {theaterPlays.length > 1 && (
          <Select
            label="Постановка"
            value={filterPlayId}
            onChange={(e) => setFilterPlayId(e.target.value)}
            options={[
              { value: '', label: 'Все постановки' },
              ...theaterPlays.map((play) => ({ value: play.id, label: play.title })),
            ]}
          />
        )}
        {activeActors.length > 0 && (
          <Select
            label="Участник"
            value={filterActorId}
            onChange={(e) => setFilterActorId(e.target.value)}
            options={[
              { value: '', label: 'Все участники' },
              ...activeActors.map((actor) => ({ value: actor.id, label: actor.name })),
            ]}
          />
        )}
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-5">
        <div className="order-2 min-w-0 space-y-6 lg:order-1 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCalendarMode('month')}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                calendarMode === 'month'
                  ? 'bg-gold/15 text-gold-light'
                  : 'text-muted hover:bg-white/5 hover:text-white'
              }`}
            >
              Месяц
            </button>
            <button
              type="button"
              onClick={() => setCalendarMode('week')}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                calendarMode === 'week'
                  ? 'bg-gold/15 text-gold-light'
                  : 'text-muted hover:bg-white/5 hover:text-white'
              }`}
            >
              Неделя
            </button>
            <Link
              to={appPaths.availability}
              className="w-full text-xs text-gold-light hover:underline sm:ml-auto sm:w-auto sm:self-center"
            >
              Доступность труппы →
            </Link>
          </div>

          {calendarMode === 'month' ? (
            <Calendar
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              rehearsals={visibleRehearsals}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              getPlayMarkers={getPlayMarkers}
            />
          ) : (
            <WeekCalendar
              weekStart={weekStart}
              onWeekChange={setWeekStart}
              rehearsals={visibleRehearsals}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          )}

          <section className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Ближайшие репетиции</h2>
            {upcomingRehearsals.length === 0 ? (
              <p className="text-sm text-muted">Нет запланированных репетиций.</p>
            ) : (
              <div className="space-y-2">
                {upcomingRehearsals.map((rehearsal) => {
                  const location = resolveRehearsalLocation(rehearsal, theaterVenues);
                  const playLabel = getRehearsalEventLabel(state, rehearsal);
                  const isSelectedDay = rehearsal.date === selectedDateStr;

                  return (
                    <Link
                      key={rehearsal.id}
                      to={appPaths.rehearsal(rehearsal.id)}
                      onClick={() => handleSelectDate(parseISO(rehearsal.date))}
                      className={`block rounded-xl border p-3 transition-colors hover:border-gold/25 ${
                        isSelectedDay
                          ? 'border-gold/30 bg-gold/5'
                          : 'border-gold/10 bg-background/30'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <CalendarPlayMarkers
                          markers={getPlayMarkers(rehearsal)}
                          size="sm"
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize text-white">
                        {format(parseISO(rehearsal.date), 'EEE, d MMM', { locale: ru })}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-gold-light">
                        <Clock size={14} />
                        <span>
                          {rehearsal.startTime} – {rehearsal.endTime}
                        </span>
                        {venueConflictRehearsalIds.has(rehearsal.id) && (
                          <span
                            className="warning-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            title="Площадка занята в это же время"
                          >
                            <AlertTriangle size={10} />
                            Площадка
                          </span>
                        )}
                      </div>
                      {theaterPlays.length > 0 && (
                        <p className="mt-1 text-xs text-muted">{playLabel}</p>
                      )}
                      {location && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-muted">
                          <MapPin size={12} className="mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{location}</span>
                        </p>
                      )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="order-1 min-w-0 lg:order-2 lg:col-span-3">
          <div className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
            <h2 className="mb-4 text-lg font-semibold capitalize text-white">
              {selectedDate
                ? format(selectedDate, 'EEEE, d MMMM', { locale: ru })
                : 'Выберите дату'}
            </h2>

            {dayRehearsals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gold/20 p-8 text-center text-muted">
                Нет репетиций на этот день.
                {!readOnly && (
                  <Button className="mt-4" variant="secondary" onClick={openCreate}>
                    Запланировать
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {dayRehearsals.map((r) => {
                  const location = resolveRehearsalLocation(r, theaterVenues);
                  const calendarTitle = getRehearsalEventLabel(state, r);
                  return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-gold/10 bg-background/30 p-4 transition-colors hover:border-gold/25"
                  >
                    <Link
                      to={appPaths.rehearsal(r.id)}
                      className="block"
                    >
                      <div className="flex items-start gap-2">
                        <CalendarPlayMarkers
                          markers={getPlayMarkers(r)}
                          size="sm"
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-gold-light">
                        <Clock size={16} />
                        <span className="font-medium">
                          {r.startTime} – {r.endTime}
                        </span>
                        {venueConflictRehearsalIds.has(r.id) && (
                          <span
                            className="warning-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            title="Площадка занята в это же время"
                          >
                            <AlertTriangle size={10} />
                            Площадка
                          </span>
                        )}
                      </div>
                      {location && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                          <MapPin size={14} /> {location}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                        {r.sceneIds.length > 0 && <span>{r.sceneIds.length} сцен</span>}
                        {r.taskIds.length > 0 && <span>{r.taskIds.length} задач</span>}
                        {r.schedule.length > 0 && <span>{r.schedule.length} блоков в плане</span>}
                      </div>
                        </div>
                      </div>
                    </Link>
                    <div className="mt-3 flex justify-end border-t border-gold/10 pt-3">
                      <RehearsalActionsMenu
                        rehearsal={r}
                        title={calendarTitle}
                        location={location}
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Новая репетиция"
        xl
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Создать и открыть план</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Дата"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />

          {(createWarnings.length > 0 ||
            createConflicts.length > 0 ||
            createVenueConflicts.length > 0) && (
            <div className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm">
              {createWarnings.map((warning) => (
                <p key={warning.id} className="text-amber-100">
                  {warning.message}
                </p>
              ))}
              {createConflicts.map((conflict) => (
                <p key={`${conflict.actor.id}-${conflict.otherRehearsal.id}`} className="text-amber-100">
                  {conflict.actor.name} уже в репетиции «{conflict.otherPlayTitle}» в это время (
                  {conflict.otherRehearsal.startTime}–{conflict.otherRehearsal.endTime}).
                </p>
              ))}
              {createVenueConflicts.map((conflict) => (
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

          {suggestedSlots.length > 0 && (
            <div className="rounded-xl border border-gold/15 bg-surface/40 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                <Sparkles size={16} className="text-gold" />
                Предложить даты — все ожидаемые участники свободны
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedSlots.map((slot) => (
                  <button
                    key={slot.date}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, date: slot.date }))}
                    className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      form.date === slot.date
                        ? 'border-gold/40 bg-gold/15 text-gold-light'
                        : 'border-gold/10 bg-background/30 text-muted hover:border-gold/25 hover:text-white'
                    }`}
                  >
                    <span className="block font-medium capitalize text-white">{slot.weekdayLabel}</span>
                    <span className="block">{slot.label}</span>
                    <span className="mt-0.5 block text-[10px] text-muted">
                      {slot.availableCount}/{slot.totalCount} участников
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Начало"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
            <Input
              label="Конец"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
          <VenueSelect
            venues={theaterVenues}
            venueId={form.venueId}
            location={form.location}
            onChange={(patch) => setForm({ ...form, ...patch })}
          />
          <Textarea
            label="Заметки"
            value={form.notes ?? ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          {getArchivedPlaysInRehearsal(state, draftRehearsal).length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              В плане есть сцены из архивных постановок:{' '}
              {getArchivedPlaysInRehearsal(state, draftRehearsal)
                .map((play) => `«${play.title}»`)
                .join(', ')}
            </div>
          )}

          {rehearsalScenes.length > 0 && (
            <TheaterScenePicker
              plays={theaterPlays}
              scenes={rehearsalScenes}
              selectedIds={form.sceneIds}
              onChange={toggleScene}
              defaultPlayId={activePlay?.id ?? state.activePlayId}
            />
          )}

          {theaterTasks.filter((t) => !t.completed).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Задачи</p>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-gold/10 bg-background/20 p-2">
                <div className="flex flex-wrap gap-2">
                {theaterTasks
                  .filter((t) => !t.completed)
                  .map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        form.taskIds.includes(task.id)
                          ? 'bg-gold/20 text-gold-light'
                          : 'bg-white/5 text-muted hover:bg-white/10'
                      }`}
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeActors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Участники</p>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-gold/10 bg-background/20 p-2">
                <div className="flex flex-wrap gap-2">
                {activeActors.map((actor) => {
                  const unavailable = isActorUnavailable(actor, form.date, {
                    startTime: form.startTime,
                    endTime: form.endTime,
                  });
                  const reason = unavailable
                    ? getActorUnavailabilityReason(actor, form.date, {
                        startTime: form.startTime,
                        endTime: form.endTime,
                      })
                    : undefined;
                  return (
                    <button
                      key={actor.id}
                      type="button"
                      title={reason ? `Недоступен: ${reason}` : undefined}
                      onClick={() => toggleActor(actor.id)}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        form.actorIds.includes(actor.id)
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
        </div>
      </Modal>
    </div>
  );
}
