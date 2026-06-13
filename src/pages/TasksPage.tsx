import { useState } from 'react';
import { Plus, Pencil, Check } from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveActors, getTheaterTasks } from '../store/selectors';
import { generateId } from '../utils/id';
import type { Task } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea } from '../components/FormFields';

const emptyTask = (): Omit<Task, 'id'> => ({
  title: '',
  description: '',
  completed: false,
  assignedActorIds: [],
});

export function TasksPage() {
  const { state, dispatch } = useRehearsalStore();
  const { confirm } = useConfirmDialog();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyTask());
  const tasks = getTheaterTasks(state);
  const activeActors = getActiveActors(state);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyTask());
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({ ...task });
    setModalOpen(true);
  };

  const toggleComplete = (task: Task) => {
    dispatch({ type: 'UPDATE_TASK', payload: { ...task, completed: !task.completed } });
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editing) {
      dispatch({ type: 'UPDATE_TASK', payload: { ...form, id: editing.id, theaterId: editing.theaterId } });
    } else {
      dispatch({ type: 'ADD_TASK', payload: { ...form, id: generateId(), theaterId: state.activeTheaterId ?? undefined } });
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
    setForm((f) => ({
      ...f,
      assignedActorIds: f.assignedActorIds.includes(actorId)
        ? f.assignedActorIds.filter((id) => id !== actorId)
        : [...f.assignedActorIds, actorId],
    }));
  };

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const TaskRow = ({ task }: { task: Task }) => (
    <div className="group flex items-start gap-3 rounded-xl border border-gold/10 bg-surface/40 px-5 py-4">
      <button
        type="button"
        onClick={() => toggleComplete(task)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
          task.completed
            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
            : 'border-gold/30 hover:border-gold'
        }`}
      >
        {task.completed && <Check size={12} />}
      </button>
      <div className="min-w-0 flex-1">
        <h3 className={`font-medium ${task.completed ? 'text-muted line-through' : 'text-white'}`}>
          {task.title}
        </h3>
        {task.description && <p className="mt-1 text-sm text-muted">{task.description}</p>}
        {task.assignedActorIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {task.assignedActorIds.map((id) => {
              const actor = state.actors.find((a) => a.id === id);
              return actor ? (
                <span key={id} className="rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold-light">
                  {actor.name}
                </span>
              ) : null;
            })}
          </div>
        )}
      </div>
      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" className="!px-2 !py-1" onClick={() => openEdit(task)}>
          <Pencil size={16} />
        </Button>
        <DeleteButton label="Удалить задачу" onClick={() => handleDelete(task.id)} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Задачи</h1>
          <p className="mt-1 text-muted">Задачи для репетиций</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} />
          Добавить
        </Button>
      </header>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          Создайте задачи: разучивание текста, реквизит, костюмы и т.д.
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
                Открытые ({open.length})
              </h2>
              {open.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </section>
          )}
          {done.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
                Выполненные ({done.length})
              </h2>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </section>
          )}
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
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Выучить монолог акта II"
          />
          <Textarea
            label="Описание"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
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
