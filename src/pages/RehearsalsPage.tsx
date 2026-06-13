import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus, MapPin, Clock } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import {
  getPlayScenes,
  getActiveActors,
  getPlayPerformances,
  formatPerformanceLabel,
  getPlayRoles,
  getTheaterPlays,
  getTheaterRehearsals,
  getTheaterTasks,
  getTheaterVenues,
} from '../store/selectors';
import { generateId } from '../utils/id';
import { appPaths } from '../navigation/appPaths';
import type { Rehearsal } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Input, Textarea, Select } from '../components/FormFields';
import { Calendar } from '../components/Calendar';
import { VenueSelect } from '../components/VenueSelect';
import { ScenePicker } from '../components/ScenePicker';
import { resolveRehearsalLocation } from '../utils/venue';
import { mergeActorsForNewScenes, resolveRehearsalPerformanceId } from '../utils/rehearsalActors';
import { getUpcomingRehearsals } from '../utils/rehearsalSort';
import { RehearsalCalendarActions } from '../components/RehearsalCalendarActions';
import { getRehearsalEventTitle } from '../utils/rehearsalCalendar';

const emptyRehearsal = (
  date: string,
  theaterId?: string,
  playId?: string,
  performanceId?: string
): Omit<Rehearsal, 'id'> => ({
  theaterId,
  date,
  startTime: '18:00',
  endTime: '21:00',
  location: '',
  notes: '',
  playId,
  performanceId,
  sceneIds: [],
  taskIds: [],
  schedule: [],
  actorIds: [],
  attendance: {},
});

export function RehearsalsPage() {
  const { state, dispatch } = useRehearsalStore();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyRehearsal(format(new Date(), 'yyyy-MM-dd')));
  const theaterPlays = getTheaterPlays(state);
  const theaterRehearsals = getTheaterRehearsals(state);
  const theaterTasks = getTheaterTasks(state);
  const theaterVenues = getTheaterVenues(state);
  const activeActors = getActiveActors(state);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const dayRehearsals = selectedDateStr
    ? theaterRehearsals.filter((r) => r.date === selectedDateStr)
    : [];
  const upcomingRehearsals = useMemo(
    () => getUpcomingRehearsals(theaterRehearsals, 5),
    [theaterRehearsals]
  );

  const rehearsalScenes = getPlayScenes(state, form.playId ?? state.activePlayId);
  const rehearsalPerformances = getPlayPerformances(state, form.playId ?? state.activePlayId ?? '');
  const pickerCharacterRoles = getPlayRoles(state, form.playId ?? state.activePlayId ?? '', 'character');

  const openCreate = () => {
    const playId = state.activePlayId ?? undefined;
    const performanceId = playId ? resolveRehearsalPerformanceId(state, { playId }) : undefined;
    setForm(
      emptyRehearsal(
        selectedDateStr ?? format(new Date(), 'yyyy-MM-dd'),
        state.activeTheaterId ?? undefined,
        playId,
        performanceId
      )
    );
    setModalOpen(true);
  };

  const handleSave = () => {
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
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Репетиции</h1>
          <p className="mt-1 text-muted">Календарь и расписание</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={openCreate}>
            <Plus size={18} />
            Новая репетиция
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Calendar
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            rehearsals={theaterRehearsals}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          <section className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Ближайшие репетиции</h2>
            {upcomingRehearsals.length === 0 ? (
              <p className="text-sm text-muted">Нет запланированных репетиций.</p>
            ) : (
              <div className="space-y-2">
                {upcomingRehearsals.map((rehearsal) => {
                  const location = resolveRehearsalLocation(rehearsal, theaterVenues);
                  const play = theaterPlays.find((item) => item.id === rehearsal.playId);
                  const performance = state.performances.find(
                    (item) => item.id === resolveRehearsalPerformanceId(state, rehearsal)
                  );
                  const isSelectedDay = rehearsal.date === selectedDateStr;

                  return (
                    <Link
                      key={rehearsal.id}
                      to={appPaths.rehearsal(rehearsal.id)}
                      onClick={() => setSelectedDate(parseISO(rehearsal.date))}
                      className={`block rounded-xl border p-3 transition-colors hover:border-gold/25 ${
                        isSelectedDay
                          ? 'border-gold/30 bg-gold/5'
                          : 'border-gold/10 bg-background/30'
                      }`}
                    >
                      <p className="font-medium capitalize text-white">
                        {format(parseISO(rehearsal.date), 'EEE, d MMM', { locale: ru })}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-sm text-gold-light">
                        <Clock size={14} />
                        <span>
                          {rehearsal.startTime} – {rehearsal.endTime}
                        </span>
                      </div>
                      {play && theaterPlays.length > 1 && (
                        <p className="mt-1 text-xs text-muted">«{play.title}»</p>
                      )}
                      {performance && (
                        <p className="mt-0.5 text-xs text-muted">
                          {formatPerformanceLabel(performance)}
                        </p>
                      )}
                      {location && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-muted">
                          <MapPin size={12} className="mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{location}</span>
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
            <h2 className="mb-4 text-lg font-semibold capitalize text-white">
              {selectedDate
                ? format(selectedDate, 'EEEE, d MMMM', { locale: ru })
                : 'Выберите дату'}
            </h2>

            {dayRehearsals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gold/20 p-8 text-center text-muted">
                Нет репетиций на этот день.
                <Button className="mt-4" variant="secondary" onClick={openCreate}>
                  Запланировать
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {dayRehearsals.map((r) => {
                  const location = resolveRehearsalLocation(r, theaterVenues);
                  const play = theaterPlays.find((item) => item.id === r.playId);
                  const calendarTitle = getRehearsalEventTitle(play?.title);
                  return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-gold/10 bg-background/30 p-4 transition-colors hover:border-gold/25"
                  >
                    <Link
                      to={appPaths.rehearsal(r.id)}
                      className="block"
                    >
                      <div className="flex items-center gap-2 text-gold-light">
                        <Clock size={16} />
                        <span className="font-medium">
                          {r.startTime} – {r.endTime}
                        </span>
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
                    </Link>
                    <div className="mt-3 border-t border-gold/10 pt-3">
                      <RehearsalCalendarActions
                        rehearsal={r}
                        title={calendarTitle}
                        location={location}
                        compact
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

          {theaterPlays.length > 1 && (
            <Select
              label="Постановка"
              value={form.playId ?? ''}
              onChange={(e) => {
                const playId = e.target.value || undefined;
                const performanceId = playId
                  ? resolveRehearsalPerformanceId(state, { playId })
                  : undefined;
                setForm({
                  ...form,
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

          {rehearsalPerformances.length > 0 && form.playId && (
            <Select
              label="Показ"
              value={form.performanceId ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  performanceId: e.target.value || undefined,
                })
              }
              options={rehearsalPerformances.map((performance) => ({
                value: performance.id,
                label: formatPerformanceLabel(performance),
              }))}
            />
          )}

          {rehearsalScenes.length > 0 && (
            <ScenePicker
              scenes={[...rehearsalScenes].sort((a, b) => a.number - b.number)}
              selectedIds={form.sceneIds}
              onChange={toggleScene}
              characterRoles={pickerCharacterRoles}
              playId={form.playId ?? state.activePlayId ?? undefined}
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
                {activeActors.map((actor) => (
                  <button
                    key={actor.id}
                    type="button"
                    onClick={() => toggleActor(actor.id)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      form.actorIds.includes(actor.id)
                        ? 'bg-gold/20 text-gold-light'
                        : 'bg-white/5 text-muted hover:bg-white/10'
                    }`}
                  >
                    {actor.name}
                  </button>
                ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
