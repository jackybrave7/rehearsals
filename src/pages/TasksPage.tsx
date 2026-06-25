import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus, Pencil, Check } from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveActors, getPlayScenes, getTheaterPlays, getTheaterTasks } from '../store/selectors';
import { generateId } from '../utils/id';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';
import type { Task, TaskPriority } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea, Select } from '../components/FormFields';
import {
  DEFAULT_TASK_PRIORITY,
  groupTasksForDisplay,
  isTaskDueSoon,
  isTaskOverdue,
  normalizeTask,
  priorityLabels,
} from '../utils/tasks';
import { getSceneShortLabel } from '../utils/sceneLabels';
import { appPaths } from '../navigation/appPaths';

const emptyTask = (): Omit<Task, 'id'> => ({
  title: '',
  description: '',
  completed: false,
  assignedActorIds: [],
  priority: DEFAULT_TASK_PRIORITY,
});

type PriorityFilter = TaskPriority | 'all';
type PlayFilter = 'all' | 'general' | string;

const sectionTitles = {
  overdue: 'Просроченные',
  thisWeek: 'На этой неделе',
  open: 'Открытые',
  done: 'Выполненные',
} as const;

export function TasksPage() {
  const { state, dispatch } = useRehearsalStore();
  const { confirm } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyTask());
  const [playFilter, setPlayFilter] = useState<PlayFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const tasks = getTheaterTasks(state).map(normalizeTask);
  const activeActors = getActiveActors(state);
  const theaterPlays = getTheaterPlays(state);
  const formScenes = getPlayScenes(state, form.playId);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (onlyOverdue && !isTaskOverdue(task)) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (playFilter === 'general' && task.playId) return false;
      if (playFilter !== 'all' && playFilter !== 'general' && task.playId !== playFilter) return false;
      return true;
    });
  }, [tasks, onlyOverdue, priorityFilter, playFilter]);

  const grouped = useMemo(() => groupTasksForDisplay(filteredTasks), [filteredTasks]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyTask(),
      playId: state.activePlayId ?? undefined,
    });
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({ ...normalizeTask(task) });
    setModalOpen(true);
  };

  const toggleComplete = (task: Task) => {
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, completed: !task.completed } });
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    const payload: Task = {
      ...normalizeTask({ ...form, id: editing?.id ?? generateId() }),
      theaterId: editing?.theaterId ?? state.activeTheaterId ?? undefined,
      sceneId: form.playId ? form.sceneId : undefined,
    };
    if (editing) {
      dispatch({ type: 'UPDATE_TASK', payload });
    } else {
      dispatch({ type: 'ADD_TASK', payload });
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Удалить задачу?',
      message: 'Задача будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_TASK', payload: id });
  };

  const toggleActor = (actorId: string) => {
    setForm((current) => ({
      ...current,
      assignedActorIds: current.assignedActorIds.includes(actorId)
        ? current.assignedActorIds.filter((id) => id !== actorId)
        : [...current.assignedActorIds, actorId],
    }));
  };

  const TaskRow = ({ task }: { task: Task }) => {
    const play = task.playId ? state.plays.find((item) => item.id === task.playId) : undefined;
    const scene = task.sceneId ? state.scenes.find((item) => item.id === task.sceneId) : undefined;
    const overdue = isTaskOverdue(task);
    const dueSoon = isTaskDueSoon(task);

    return (
      <div className="group flex items-start gap-3 rounded-xl border border-gold/10 bg-surface/40 px-5 py-4">
        <button
          type="button"
          onClick={() => toggleComplete(task)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
            task.completed
              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
              : 'border-gold/30 hover:border-gold'
          }`}
          aria-label={task.completed ? 'Отметить невыполненной' : 'Отметить выполненной'}
        >
          {task.completed && <Check size={12} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-medium ${task.completed ? 'text-muted line-through' : 'text-white'}`}>
              {task.title}
            </h3>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-muted">
              {priorityLabels[task.priority ?? DEFAULT_TASK_PRIORITY]}
            </span>
            {task.dueDate && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  overdue
                    ? 'bg-red-500/15 text-red-200'
                    : dueSoon
                      ? 'bg-amber-500/15 text-amber-200'
                      : 'bg-white/5 text-muted'
                }`}
              >
                {format(parseISO(task.dueDate), 'd MMM yyyy', { locale: ru })}
              </span>
            )}
          </div>
          {task.description && <p className="mt-1 text-sm text-muted">{task.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {play && (
              <Link
                to={appPaths.scenes}
                className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold-light hover:underline"
              >
                {play.title}
              </Link>
            )}
            {scene && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted">
                {getSceneShortLabel(scene)}
              </span>
            )}
            {task.assignedActorIds.map((id) => {
              const actor = state.actors.find((item) => item.id === id);
              return actor ? (
                <span key={id} className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold-light">
                  {actor.name}
                </span>
              ) : null;
            })}
          </div>
        </div>
        <div className="schedule-block-actions flex gap-1">
          <Button variant="ghost" className="!px-2 !py-1" onClick={() => openEdit(task)}>
            <Pencil size={16} />
          </Button>
          <DeleteButton label="Удалить задачу" onClick={() => handleDelete(task.id)} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Задачи</h1>
          <p className="mt-1 text-muted">Подготовка к показам: сроки, приоритеты, привязка к постановкам</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} />
          Добавить
        </Button>
      </header>

      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {theaterPlays.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setPlayFilter('all')}
                className={`rounded-full px-3 py-1 text-xs ${playFilter === 'all' ? 'bg-gold/15 text-gold-light' : 'bg-white/5 text-muted'}`}
              >
                Все постановки
              </button>
              <button
                type="button"
                onClick={() => setPlayFilter('general')}
                className={`rounded-full px-3 py-1 text-xs ${playFilter === 'general' ? 'bg-gold/15 text-gold-light' : 'bg-white/5 text-muted'}`}
              >
                Общие
              </button>
              {theaterPlays.map((play) => (
                <button
                  key={play.id}
                  type="button"
                  onClick={() => setPlayFilter(play.id)}
                  className={`rounded-full px-3 py-1 text-xs ${playFilter === play.id ? 'bg-gold/15 text-gold-light' : 'bg-white/5 text-muted'}`}
                >
                  {play.title}
                </button>
              ))}
            </>
          )}
          {(['high', 'medium', 'low'] as TaskPriority[]).map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() => setPriorityFilter((current) => (current === priority ? 'all' : priority))}
              className={`rounded-full px-3 py-1 text-xs ${
                priorityFilter === priority ? 'bg-gold/15 text-gold-light' : 'bg-white/5 text-muted'
              }`}
            >
              {priorityLabels[priority]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOnlyOverdue((value) => !value)}
            className={`rounded-full px-3 py-1 text-xs ${
              onlyOverdue ? 'bg-red-500/15 text-red-200' : 'bg-white/5 text-muted'
            }`}
          >
            Только просроченные
          </button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          Создайте задачи: разучивание текста, реквизит, костюмы и т.д.
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(sectionTitles) as Array<keyof typeof sectionTitles>).map((section) => {
            const items = grouped[section];
            if (items.length === 0) return null;
            return (
              <section key={section} className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
                  {sectionTitles[section]} ({items.length})
                </h2>
                {items.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Редактировать задачу' : 'Новая задача'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Выучить монолог акта II"
          />
          <Textarea
            label="Описание"
            value={form.description ?? ''}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Срок"
              type="date"
              value={form.dueDate ?? ''}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value || undefined })}
            />
            <Select
              label="Приоритет"
              value={form.priority ?? DEFAULT_TASK_PRIORITY}
              onChange={(event) =>
                setForm({ ...form, priority: event.target.value as TaskPriority })
              }
              options={(Object.keys(priorityLabels) as TaskPriority[]).map((priority) => ({
                value: priority,
                label: priorityLabels[priority],
              }))}
            />
          </div>
          {theaterPlays.length > 1 && (
            <Select
              label="Постановка"
              value={form.playId ?? ''}
              onChange={(event) =>
                setForm({
                  ...form,
                  playId: event.target.value || undefined,
                  sceneId: undefined,
                })
              }
              options={[
                { value: '', label: 'Общая задача' },
                ...theaterPlays.map((play) => ({ value: play.id, label: play.title })),
              ]}
            />
          )}
          {form.playId && formScenes.length > 0 && (
            <Select
              label="Сцена"
              value={form.sceneId ?? ''}
              onChange={(event) => setForm({ ...form, sceneId: event.target.value || undefined })}
              options={[
                { value: '', label: 'Без привязки к сцене' },
                ...formScenes.map((scene) => ({
                  value: scene.id,
                  label: getSceneShortLabel(scene),
                })),
              ]}
            />
          )}
          {activeActors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Назначить участников</p>
              <div className="flex flex-wrap gap-2">
                {activeActors.map((actor) => (
                  <button
                    key={actor.id}
                    type="button"
                    onClick={() => toggleActor(actor.id)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      form.assignedActorIds.includes(actor.id)
                        ? 'bg-gold/20 text-gold-light'
                        : 'bg-white/5 text-muted hover:bg-white/10'
                    }`}
                  >
                    {actor.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
