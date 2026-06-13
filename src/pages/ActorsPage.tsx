import { useState } from 'react';
import { Plus, Pencil, Phone, Mail, Archive, ArchiveRestore, AtSign } from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveActors, getArchivedActors, formatActorRolesSummary } from '../store/selectors';
import { generateId } from '../utils/id';
import { readPhotoAsDataUrl } from '../utils/photo';
import { formatPhone, formatPhoneInput, parsePhoneForSave } from '../utils/phone';
import type { Actor, ActorStatus } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea, Select } from '../components/FormFields';
import { ActorAvatar } from '../components/ActorAvatar';

const emptyActor = (): Omit<Actor, 'id'> => ({
  name: '',
  status: 'active',
  archiveReason: undefined,
  photoUrl: undefined,
  phone: '',
  email: '',
  telegramUsername: '',
  notes: '',
});

type Tab = 'active' | 'archived';

function ActorCard({
  actor,
  onEdit,
  onDelete,
  archived,
  rolesSummary,
}: {
  actor: Actor;
  onEdit: (actor: Actor) => void;
  onDelete: (id: string) => void;
  archived?: boolean;
  rolesSummary: string;
}) {
  const telegramUsername = actor.telegramUsername?.replace(/^@+/, '').trim();
  return (
    <div
      className={`group overflow-hidden rounded-2xl border bg-surface/60 ${
        archived ? 'border-muted/20 opacity-80' : 'border-gold/10'
      }`}
    >
      <div className="flex items-start gap-4 p-5">
        <ActorAvatar name={actor.name} photoUrl={actor.photoUrl} archived={archived} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-white">{actor.name}</h3>
            {archived && (
              <span className="shrink-0 rounded-full bg-muted/20 px-2 py-0.5 text-xs text-muted">
                Архив
              </span>
            )}
          </div>
          <p className="text-sm text-gold-light line-clamp-2">{rolesSummary}</p>
          {archived && actor.archiveReason && (
            <p className="mt-2 text-xs text-muted">
              <span className="text-muted/70">Причина: </span>
              {actor.archiveReason}
            </p>
          )}
          {!archived && actor.phone && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <Phone size={12} /> {formatPhone(actor.phone)}
            </p>
          )}
          {!archived && actor.email && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <Mail size={12} /> {actor.email}
            </p>
          )}
          {!archived && telegramUsername && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <AtSign size={12} /> @{telegramUsername}
            </p>
          )}
        </div>
      </div>
      {!archived && actor.notes && (
        <p className="border-t border-gold/10 px-5 py-3 text-sm text-muted">{actor.notes}</p>
      )}
      <div className="flex gap-2 border-t border-gold/10 px-5 py-3 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" className="!px-2 !py-1" onClick={() => onEdit(actor)}>
          <Pencil size={16} />
        </Button>
        <DeleteButton label="Удалить участника" onClick={() => onDelete(actor.id)} />
      </div>
    </div>
  );
}

export function ActorsPage() {
  const { state, dispatch } = useRehearsalStore();
  const { confirm } = useConfirmDialog();
  const [tab, setTab] = useState<Tab>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Actor | null>(null);
  const [form, setForm] = useState(emptyActor());

  const activeActors = getActiveActors(state);
  const archivedActors = getArchivedActors(state);
  const displayed = tab === 'active' ? activeActors : archivedActors;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyActor());
    setModalOpen(true);
  };

  const openEdit = (actor: Actor) => {
    setEditing(actor);
    setForm({
      ...actor,
      phone: formatPhone(actor.phone ?? ''),
      archiveReason: actor.archiveReason ?? '',
      telegramUsername: actor.telegramUsername ?? '',
    });
    setModalOpen(true);
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await readPhotoAsDataUrl(file);
      setForm((f) => ({ ...f, photoUrl: dataUrl }));
    }
  };

  const handleStatusChange = (status: ActorStatus) => {
    setForm((f) => ({
      ...f,
      status,
      archiveReason: status === 'active' ? undefined : f.archiveReason ?? '',
    }));
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (form.status === 'archived' && !form.archiveReason?.trim()) return;

    const payload: Actor = {
      ...form,
      id: editing?.id ?? generateId(),
      theaterId: editing?.theaterId ?? form.theaterId ?? state.activeTheaterId ?? undefined,
      telegramUsername: form.telegramUsername?.replace(/^@+/, '').trim() || undefined,
      phone: parsePhoneForSave(form.phone),
      archiveReason:
        form.status === 'archived' ? form.archiveReason?.trim() : undefined,
    };

    if (editing) {
      dispatch({ type: 'UPDATE_ACTOR', payload });
    } else {
      dispatch({ type: 'ADD_ACTOR', payload });
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Удалить участника?',
      message: 'Участник будет удалён из всех списков и назначений.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_ACTOR', payload: id });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Участники</h1>
          <p className="mt-1 text-muted">
            {activeActors.length} активных
            {archivedActors.length > 0 && ` · ${archivedActors.length} в архиве`}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} />
          Добавить
        </Button>
      </header>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`rounded-lg px-4 py-2 text-sm transition-colors ${
            tab === 'active'
              ? 'bg-gold/15 text-gold-light'
              : 'text-muted hover:bg-white/5 hover:text-white'
          }`}
        >
          Активные ({activeActors.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('archived')}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors ${
            tab === 'archived'
              ? 'bg-gold/15 text-gold-light'
              : 'text-muted hover:bg-white/5 hover:text-white'
          }`}
        >
          <Archive size={14} />
          Архив ({archivedActors.length})
        </button>
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          {tab === 'active'
            ? 'Пока нет активных участников.'
            : 'Архив пуст. Переведите участника в архив через редактирование.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((actor) => (
            <ActorCard
              key={actor.id}
              actor={actor}
              archived={tab === 'archived'}
              rolesSummary={formatActorRolesSummary(state, actor.id)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Редактировать участника' : 'Новый участник'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={form.status === 'archived' && !form.archiveReason?.trim()}
            >
              {form.status === 'archived' ? (
                <>
                  <Archive size={16} /> В архив
                </>
              ) : editing?.status === 'archived' ? (
                <>
                  <ArchiveRestore size={16} /> Вернуть
                </>
              ) : (
                'Сохранить'
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <ActorAvatar name={form.name || 'Участник'} photoUrl={form.photoUrl} size="lg" />
            <label className="cursor-pointer rounded-lg border border-gold/20 px-4 py-2 text-sm text-gold-light hover:bg-gold/10">
              Загрузить фото
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>
          <Input
            label="Имя"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Иван Петров"
          />
          <p className="-mt-2 text-xs text-muted">
            Роли назначаются в разделе «Постановки» — один участник может быть в нескольких постановках и ролях.
          </p>
          <Select
            label="Статус"
            value={form.status}
            onChange={(e) => handleStatusChange(e.target.value as ActorStatus)}
            options={[
              { value: 'active', label: 'Активный' },
              { value: 'archived', label: 'Архив' },
            ]}
          />
          {form.status === 'archived' && (
            <Textarea
              label="Причина архивации"
              value={form.archiveReason ?? ''}
              onChange={(e) => setForm({ ...form, archiveReason: e.target.value })}
              placeholder="Ушёл из проекта, занят в другой постановке..."
            />
          )}
          {form.status === 'active' && (
            <>
              <Input
                label="Телефон"
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => setForm({ ...form, phone: formatPhoneInput(e.target.value) })}
                placeholder="+7 (999) 123-45-67"
              />
              <Input
                label="Email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Telegram"
                value={form.telegramUsername ?? ''}
                onChange={(e) => setForm({ ...form, telegramUsername: e.target.value })}
                placeholder="@username"
              />
              <Textarea
                label="Заметки"
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
