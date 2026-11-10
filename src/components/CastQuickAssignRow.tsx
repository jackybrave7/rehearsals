import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveActors, getPlayRoles, isActorAssignedToRole } from '../store/selectors';
import { generateId } from '../utils/id';
import { fetchTheaterMembers } from '../api/auth';
import { normalizeActorEmail, normalizeActorName } from '../utils/actorProfile';
import type { Performance } from '../types';
import { Button } from './Button';
import { Input, Select } from './FormFields';

const NEW_ACTOR_VALUE = '__new_actor__';

type CastQuickAssignRowProps = {
  playId: string;
  performance: Performance;
  onAssign: (roleId: string, actorId: string) => void;
};

export function CastQuickAssignRow({ playId, performance, onAssign }: CastQuickAssignRowProps) {
  const { state, dispatch } = useRehearsalStore();
  const [roleName, setRoleName] = useState('');
  const [actorPick, setActorPick] = useState('');
  const [newActorName, setNewActorName] = useState('');
  const [saving, setSaving] = useState(false);

  const activeActors = getActiveActors(state);
  const characterRoles = getPlayRoles(state, playId, 'character');

  const trySyncActorEmail = async (actorId: string) => {
    const actor = state.actors.find((item) => item.id === actorId);
    const theaterId = state.activeTheaterId;
    if (!actor || !theaterId || normalizeActorEmail(actor.email)) return;
    try {
      const members = await fetchTheaterMembers(theaterId);
      const member = members.find(
        (entry) =>
          entry.role === 'actor' &&
          normalizeActorName(entry.name) === normalizeActorName(actor.name)
      );
      if (member?.email) {
        dispatch({ type: 'UPDATE_ACTOR', payload: { ...actor, email: member.email } });
      }
    } catch {
      // ignore
    }
  };

  const resetForm = () => {
    setRoleName('');
    setActorPick('');
    setNewActorName('');
    document.getElementById('cast-quick-role')?.focus();
  };

  const handleSubmit = async () => {
    const trimmedRole = roleName.trim();
    if (!trimmedRole || saving) return;

    let actorId = actorPick;
    if (actorId === NEW_ACTOR_VALUE) {
      const trimmedName = newActorName.trim();
      if (!trimmedName) return;
      actorId = generateId();
      dispatch({
        type: 'ADD_ACTOR',
        payload: {
          id: actorId,
          name: trimmedName,
          status: 'active',
          theaterId: state.activeTheaterId ?? undefined,
        },
      });
    } else if (!actorId) {
      return;
    }

    setSaving(true);
    try {
      const existingRole = characterRoles.find(
        (role) => role.name.trim().toLowerCase() === trimmedRole.toLowerCase()
      );
      let roleId = existingRole?.id;
      if (!roleId) {
        roleId = generateId();
        dispatch({
          type: 'ADD_PLAY_ROLE',
          payload: {
            id: roleId,
            playId,
            name: trimmedRole,
            kind: 'character',
            order: characterRoles.length + 1,
          },
        });
      }

      if (!isActorAssignedToRole(state, performance.id, roleId, actorId)) {
        onAssign(roleId, actorId);
      }

      await trySyncActorEmail(actorId);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const actorOptions = [
    { value: '', label: 'Выберите участника' },
    ...activeActors
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .map((actor) => ({ value: actor.id, label: actor.name })),
    { value: NEW_ACTOR_VALUE, label: '+ Создать участника' },
  ];

  return (
    <section className="rounded-xl border border-gold/20 bg-gold/5 p-4">
      <p className="mb-3 text-sm font-medium text-white">Роль — участник</p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Input
          id="cast-quick-role"
          label="Роль"
          value={roleName}
          onChange={(event) => setRoleName(event.target.value)}
          placeholder="Михель"
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSubmit();
          }}
        />
        <div className="space-y-3">
          <Select
            label="Участник"
            value={actorPick}
            onChange={(event) => setActorPick(event.target.value)}
            options={actorOptions}
          />
          {actorPick === NEW_ACTOR_VALUE ? (
            <Input
              label="Имя нового участника"
              value={newActorName}
              onChange={(event) => setNewActorName(event.target.value)}
              placeholder="Иван Петров"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSubmit();
              }}
            />
          ) : null}
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto sm:shrink-0"
          disabled={
            saving ||
            !roleName.trim() ||
            !actorPick ||
            (actorPick === NEW_ACTOR_VALUE && !newActorName.trim())
          }
          onClick={() => void handleSubmit()}
        >
          <Plus size={16} />
          Сохранить и добавить ещё
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Контакты и второй участник на роль — в таблице ниже или в разделе «Участники».
      </p>
    </section>
  );
}
