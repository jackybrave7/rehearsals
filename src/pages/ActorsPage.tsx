import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Phone, Archive, ArchiveRestore, AtSign, CalendarOff, Trash2 } from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveActors, getArchivedActors, formatActorRolesSummary, countActorRoles } from '../store/selectors';
import { uploadFile } from '../api/files';
import { generateId } from '../utils/id';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';
import { formatPhone, formatPhoneInput, parsePhoneForSave } from '../utils/phone';
import { getActorUnavailabilityBadge } from '../utils/actorAvailability';
import {
  getActorDeletionImpact,
  formatActorDeletionImpactMessage,
} from '../utils/actorDeletionImpact';
import { getActorMiniBadges } from '../utils/actorInsights';
import { appPaths } from '../navigation/appPaths';
import type { Actor, ActorStatus, ActorUnavailability } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea, Select } from '../components/FormFields';
import { ActorAvatar } from '../components/ActorAvatar';
import { ActorTelegramBotLink } from '../components/ActorTelegramBotLink';

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
  onOpen,
  archived,
  rolesSummary,
  roleCount,
  unavailabilityBadge,
  attendancePercent,
  staleLabel,
}: {
  actor: Actor;
  onEdit: (actor: Actor) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  archived?: boolean;
  rolesSummary: string;
  roleCount: number;
  unavailabilityBadge?: string;
  attendancePercent?: number;
  staleLabel?: string;
}) {
  const telegramUsername = actor.telegramUsername?.replace(/^@+/, '').trim();
  const telegramConnected = Boolean(actor.telegramChatId);
  return (
    <div
      className={`group overflow-hidden rounded-2xl border bg-surface/60 ${
        archived ? 'border-muted/20 opacity-80' : 'border-gold/10'
      }`}
    >
      <div className="flex items-start gap-4 p-5">
        <button
          type="button"
          onClick={() => onOpen(actor.id)}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          aria-label={`Открыть карточку: ${actor.name}`}
        >
          <ActorAvatar name={actor.name} photoUrl={actor.photoUrl} archived={archived} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <button
              type="button"
              onClick={() => onOpen(actor.id)}
              title={actor.name}
              className="line-clamp-2 text-left font-semibold leading-snug text-white hover:text-gold-light"
            >
              {actor.name}
            </button>
            {archived && (
              <span className="shrink-0 rounded-full bg-muted/20 px-2 py-0.5 text-xs text-muted">
                Архив
              </span>
            )}
            {!archived && unavailabilityBadge && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
                {unavailabilityBadge}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gold-light line-clamp-2" title={rolesSummary}>
            {rolesSummary}
          </p>
          {!archived && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1" title="Телефон">
                <Phone size={12} className="shrink-0 opacity-70" />
                {actor.phone ? formatPhone(actor.phone) : 'телефон не указан'}
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  telegramConnected ? 'text-emerald-200' : ''
                }`}
                title="Telegram"
              >
                <AtSign size={12} className="shrink-0 opacity-70" />
                {telegramConnected
                  ? 'бот подключён'
                  : telegramUsername
                    ? `@${telegramUsername}`
                    : 'Telegram не указан'}
              </span>
              <span title="Количество ролей в составе">
                {roleCount > 0
                  ? `${roleCount} ${roleCount === 1 ? 'роль' : roleCount < 5 ? 'роли' : 'ролей'}`
                  : 'роли не назначены'}
              </span>
            </div>
          )}
          {!archived && (attendancePercent !== undefined || staleLabel) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {attendancePercent !== undefined && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                  {attendancePercent}% посещаемость
                </span>
              )}
              {staleLabel && (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                  {staleLabel}
                </span>
              )}
            </div>
          )}
          {archived && actor.archiveReason && (
            <p className="mt-2 text-xs text-muted">
              <span className="text-muted/70">Причина: </span>
              {actor.archiveReason}
            </p>
          )}
        </div>
      </div>
      {!archived && actor.notes && (
        <p className="border-t border-gold/10 px-5 py-3 text-sm text-muted">{actor.notes}</p>
      )}
      <div className="card-actions flex min-h-10 gap-2 border-t border-gold/10 px-5 py-3">
        <Button variant="ghost" className="!min-h-10 !min-w-10 !px-2 !py-1" onClick={() => onEdit(actor)}>
          <Pencil size={16} />
        </Button>
        <DeleteButton label="Удалить участника" className="!min-h-10 !min-w-10" onClick={() => onDelete(actor.id)} />
      </div>
    </div>
  );
}

export function ActorsPage() {
  const { state, dispatch, readOnly } = useRehearsalStore();
  const { confirm } = useConfirmDialog();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Actor | null>(null);
  const [form, setForm] = useState(emptyActor());
  const [unavailForm, setUnavailForm] = useState({ from: '', to: '', reason: '' });

  const activeActors = getActiveActors(state);
  const archivedActors = getArchivedActors(state);
  const displayed = tab === 'active' ? activeActors : archivedActors;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyActor());
    setUnavailForm({ from: '', to: '', reason: '' });
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
    setUnavailForm({ from: '', to: '', reason: '' });
    setModalOpen(true);
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadFile(file);
      setForm((f) => ({ ...f, photoUrl: uploaded.url }));
    } catch {
      // ignore — пользователь может повторить загрузку
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
    const impact = getActorDeletionImpact(state, id);
    const confirmed = await confirm({
      title: 'Удалить участника навсегда?',
      message: formatActorDeletionImpactMessage(impact),
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_ACTOR', payload: id });
  };

  const addUnavailability = () => {
    if (!unavailForm.from || !unavailForm.to || readOnly) return;
    const entry: ActorUnavailability = {
      id: generateId(),
      from: unavailForm.from,
      to: unavailForm.to,
      reason: unavailForm.reason.trim() || undefined,
    };
    setForm((f) => ({
      ...f,
      unavailability: [...(f.unavailability ?? []), entry],
    }));
    setUnavailForm({ from: '', to: '', reason: '' });
  };

  const removeUnavailability = (id: string) => {
    if (readOnly) return;
    setForm((f) => ({
      ...f,
      unavailability: (f.unavailability ?? []).filter((entry) => entry.id !== id),
    }));
  };

  const formatPeriod = (from: string, to: string) => {
    const fmt = (d: string) => d.split('-').reverse().join('.');
    return from === to ? fmt(from) : `${fmt(from)} — ${fmt(to)}`;
  };

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Участники</h1>
          <p className="mt-1 text-muted">
            {activeActors.length} активных
            {archivedActors.length > 0 && ` · ${archivedActors.length} в архиве`}
          </p>
        </div>
        <Button onClick={openCreate} disabled={readOnly}>
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
          {displayed.map((actor) => {
            const miniBadges = tab === 'active' ? getActorMiniBadges(state, actor.id) : {};
            return (
            <ActorCard
              key={actor.id}
              actor={actor}
              archived={tab === 'archived'}
              rolesSummary={formatActorRolesSummary(state, actor.id)}
              roleCount={countActorRoles(state, actor.id)}
              unavailabilityBadge={
                tab === 'active' ? getActorUnavailabilityBadge(actor) : undefined
              }
              attendancePercent={miniBadges.attendancePercent}
              staleLabel={miniBadges.staleLabel}
              onOpen={(id) => navigate(appPaths.actor(id))}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
            );
          })}
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
              {editing && (
                <ActorTelegramBotLink
                  actorId={editing.id}
                  theaterId={editing.theaterId ?? state.activeTheaterId}
                  telegramChatId={
                    state.actors.find((actor) => actor.id === editing.id)?.telegramChatId ??
                    editing.telegramChatId
                  }
                />
              )}
              <Textarea
                label="Заметки"
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div className="space-y-3 rounded-xl border border-gold/10 bg-background/20 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <CalendarOff size={16} className="text-gold/70" />
                  Недоступность
                </div>
                {(form.unavailability ?? []).length > 0 ? (
                  <ul className="space-y-2">
                    {(form.unavailability ?? []).map((period) => (
                      <li
                        key={period.id}
                        className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="text-white">{formatPeriod(period.from, period.to)}</p>
                          {period.reason && (
                            <p className="text-xs text-muted">{period.reason}</p>
                          )}
                        </div>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => removeUnavailability(period.id)}
                            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-red-500/10 hover:text-red-300"
                            aria-label="Удалить период недоступности"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">Периодов недоступности пока нет.</p>
                )}
                {!readOnly && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      label="С"
                      type="date"
                      value={unavailForm.from}
                      onChange={(e) =>
                        setUnavailForm((f) => ({ ...f, from: e.target.value }))
                      }
                    />
                    <Input
                      label="По"
                      type="date"
                      value={unavailForm.to}
                      onChange={(e) =>
                        setUnavailForm((f) => ({ ...f, to: e.target.value }))
                      }
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Причина (необязательно)"
                        value={unavailForm.reason}
                        onChange={(e) =>
                          setUnavailForm((f) => ({ ...f, reason: e.target.value }))
                        }
                        placeholder="Отпуск, гастроли..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="!py-1.5 text-sm"
                        disabled={!unavailForm.from || !unavailForm.to}
                        onClick={addUnavailability}
                      >
                        <Plus size={14} />
                        Добавить период
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
