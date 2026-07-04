import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, UserPlus, X, Copy } from 'lucide-react';
import { DeleteButton } from './DeleteButton';
import { useRehearsalStore } from '../store/RehearsalContext';
import { formatPerformanceLabel, getActiveActors, getPlayPerformances, getPlayRoles, getRoleAssignmentsForPerformance, isActorAssignedToRole } from '../store/selectors';
import { formatPremiereCountdown, getUpcomingPremiere } from '../utils/premiere';
import { generateId } from '../utils/id';
import type { Performance, PlayRole, PlayRoleKind } from '../types';
import { Button } from './Button';
import { Modal } from './Modal';
import { useConfirmDialog } from './ConfirmDialogContext';
import { Input, Textarea, Select } from './FormFields';
import { ActorAvatar } from './ActorAvatar';
import { fetchTheaterMembers } from '../api/auth';
import { normalizeActorEmail, normalizeActorName } from '../utils/actorProfile';
import { formatScriptAliasesInput, parseScriptAliasesInput } from '../utils/sceneRoleAssignment';

interface CastDistributionPanelProps {
  playId: string;
  readOnly?: boolean;
}

const emptyRole = (playId: string, kind: PlayRoleKind, order: number): Omit<PlayRole, 'id'> => ({
  playId,
  name: '',
  kind,
  order,
  description: '',
});

export function CastDistributionPanel({ playId, readOnly = false }: CastDistributionPanelProps) {
  const { state, dispatch } = useRehearsalStore();
  const { confirm, confirmDelete } = useConfirmDialog();
  const performances = getPlayPerformances(state, playId);
  const savedPerformanceId = state.selectedPerformanceByPlayId?.[playId];
  const [selectedPerformanceId, setSelectedPerformanceId] = useState(
    savedPerformanceId ?? performances.find((p) => p.isDefault)?.id ?? performances[0]?.id ?? ''
  );
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [assignRole, setAssignRole] = useState<PlayRole | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [editingRole, setEditingRole] = useState<PlayRole | null>(null);
  const [editingPerformance, setEditingPerformance] = useState<Performance | null>(null);
  const [roleForm, setRoleForm] = useState(emptyRole(playId, 'character', 1));
  const [roleAliasesText, setRoleAliasesText] = useState('');
  const [performanceForm, setPerformanceForm] = useState<Omit<Performance, 'id'>>({
    playId,
    name: '',
    description: '',
    date: '',
    startTime: '',
  });

  const activePerformance =
    performances.find((p) => p.id === selectedPerformanceId) ?? performances[0];

  const characterRoles = getPlayRoles(state, playId, 'character');
  const crewRoles = getPlayRoles(state, playId, 'crew');
  const technicalRoles = getPlayRoles(state, playId, 'technical');
  const activeActors = getActiveActors(state);

  const sourcePerformanceId = useMemo(
    () => performances.find((p) => p.isDefault)?.id ?? performances[0]?.id,
    [performances]
  );

  useEffect(() => {
    const saved = state.selectedPerformanceByPlayId?.[playId];
    if (saved && performances.some((p) => p.id === saved) && saved !== selectedPerformanceId) {
      setSelectedPerformanceId(saved);
    }
  }, [state.selectedPerformanceByPlayId, playId, performances, selectedPerformanceId]);

  useEffect(() => {
    if (performances.length === 0) return;
    const stillValid = performances.some((p) => p.id === selectedPerformanceId);
    if (!stillValid) {
      const fallback = performances.find((p) => p.isDefault)?.id ?? performances[0].id;
      setSelectedPerformanceId(fallback);
      dispatch({
        type: 'SET_SELECTED_PERFORMANCE',
        payload: { playId, performanceId: fallback },
      });
    }
  }, [performances, selectedPerformanceId, playId, dispatch]);

  const selectPerformance = (performanceId: string) => {
    setSelectedPerformanceId(performanceId);
    dispatch({
      type: 'SET_SELECTED_PERFORMANCE',
      payload: { playId, performanceId },
    });
  };

  const openCreateRole = (kind: PlayRoleKind) => {
    if (readOnly) return;
    const rolesByKind = {
      character: characterRoles,
      crew: crewRoles,
      technical: technicalRoles,
    };
    const roles = rolesByKind[kind];
    setEditingRole(null);
    setRoleForm(emptyRole(playId, kind, roles.length + 1));
    setRoleAliasesText('');
    setRoleModalOpen(true);
  };

  const openEditRole = (role: PlayRole) => {
    if (readOnly) return;
    setEditingRole(role);
    setRoleForm({ ...role });
    setRoleAliasesText(formatScriptAliasesInput(role.scriptAliases));
    setRoleModalOpen(true);
  };

  const saveRole = () => {
    if (readOnly) return;
    if (!roleForm.name.trim()) return;
    dispatch({
      type: editingRole ? 'UPDATE_PLAY_ROLE' : 'ADD_PLAY_ROLE',
      payload: {
        id: editingRole?.id ?? generateId(),
        playId,
        name: roleForm.name.trim(),
        kind: roleForm.kind,
        order: Number(roleForm.order) || 1,
        description: roleForm.description?.trim() || undefined,
        scriptAliases:
          roleForm.kind === 'character' ? parseScriptAliasesInput(roleAliasesText) : undefined,
      },
    });
    setRoleModalOpen(false);
  };

  const deleteRole = async (role: PlayRole) => {
    if (readOnly) return;
    const confirmed = await confirm({
      title: `Удалить роль «${role.name}»?`,
      message: 'Роль будет снята со всех сцен и назначений в этой постановке.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_PLAY_ROLE', payload: role.id });
  };

  const assignActor = (roleId: string, actorId: string) => {
    if (readOnly) return;
    if (!activePerformance) return;
    if (isActorAssignedToRole(state, activePerformance.id, roleId, actorId)) return;
    dispatch({
      type: 'ADD_CAST_ASSIGNMENT',
      payload: {
        id: generateId(),
        playId,
        performanceId: activePerformance.id,
        roleId,
        actorId,
      },
    });
  };

  const unassign = (assignmentId: string) => {
    if (readOnly) return;
    dispatch({ type: 'DELETE_CAST_ASSIGNMENT', payload: assignmentId });
  };

  const openAssignModal = (role: PlayRole) => {
    if (readOnly) return;
    setAssignRole(role);
    setAssignSearch('');
  };

  const closeAssignModal = () => {
    setAssignRole(null);
    setAssignSearch('');
  };

  const assignableActors = useMemo(() => {
    if (!assignRole || !activePerformance) return [];
    const query = assignSearch.trim().toLowerCase();
    return activeActors
      .filter(
        (actor) =>
          !isActorAssignedToRole(state, activePerformance.id, assignRole.id, actor.id)
      )
      .filter((actor) => {
        if (!query) return true;
        const telegram = actor.telegramUsername?.replace(/^@+/, '').toLowerCase() ?? '';
        return (
          actor.name.toLowerCase().includes(query) ||
          telegram.includes(query.replace(/^@+/, ''))
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [assignRole, activePerformance, activeActors, assignSearch, state]);

  const handleAssignFromModal = async (actorId: string) => {
    if (!assignRole) return;
    assignActor(assignRole.id, actorId);

    const actor = state.actors.find((item) => item.id === actorId);
    const theaterId = state.activeTheaterId;
    if (actor && theaterId && !normalizeActorEmail(actor.email)) {
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
        // ignore — режиссёр может указать email вручную
      }
    }

    closeAssignModal();
  };

  const openCreatePerformance = () => {
    if (readOnly) return;
    setEditingPerformance(null);
    setPerformanceForm({ playId, name: '', description: '', date: '', startTime: '' });
    setPerformanceModalOpen(true);
  };

  const openEditPerformance = (performance: Performance) => {
    if (readOnly) return;
    setEditingPerformance(performance);
    setPerformanceForm({
      playId,
      name: performance.name,
      description: performance.description ?? performance.notes ?? '',
      date: performance.date ?? '',
      startTime: performance.startTime ?? '',
      isDefault: performance.isDefault,
    });
    setPerformanceModalOpen(true);
  };

  const savePerformance = () => {
    if (readOnly) return;
    if (!performanceForm.name.trim()) return;
    const payload: Performance = {
      id: editingPerformance?.id ?? generateId(),
      playId,
      name: performanceForm.name.trim(),
      description: performanceForm.description?.trim() || undefined,
      date: performanceForm.date || undefined,
      startTime: performanceForm.startTime || undefined,
      isDefault: editingPerformance?.isDefault,
    };
    dispatch({
      type: editingPerformance ? 'UPDATE_PERFORMANCE' : 'ADD_PERFORMANCE',
      payload,
    });
    if (!editingPerformance) selectPerformance(payload.id);
    setPerformanceModalOpen(false);
  };

  const deletePerformance = async (performance: Performance) => {
    if (readOnly) return;
    if (performance.isDefault) return;
    const confirmed = await confirmDelete({
      title: `Удалить показ «${performance.name}»?`,
      message: 'Состав этого показа и связанные назначения ролей будут удалены без возможности восстановления.',
      confirmLabel: 'Удалить показ',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_PERFORMANCE', payload: performance.id });
  };

  const copyCastFromDefault = () => {
    if (readOnly) return;
    if (!activePerformance || !sourcePerformanceId || activePerformance.isDefault) return;
    if (sourcePerformanceId === activePerformance.id) return;

    const sourceAssignments = state.castAssignments.filter(
      (a) => a.performanceId === sourcePerformanceId
    );
    for (const assignment of sourceAssignments) {
      if (
        isActorAssignedToRole(
          state,
          activePerformance.id,
          assignment.roleId,
          assignment.actorId
        )
      ) {
        continue;
      }
      dispatch({
        type: 'ADD_CAST_ASSIGNMENT',
        payload: {
          id: generateId(),
          playId,
          performanceId: activePerformance.id,
          roleId: assignment.roleId,
          actorId: assignment.actorId,
        },
      });
    }
  };

  const renderRoleTable = (roles: PlayRole[], title: string, kind: PlayRoleKind) => {
    if (!activePerformance) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gold-light">{title}</h4>
          {!readOnly && (
            <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => openCreateRole(kind)}>
              <Plus size={14} /> Роль
            </Button>
          )}
        </div>

        {roles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gold/15 px-4 py-3 text-sm text-muted">
            Список ролей пуст
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gold/10">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="bg-background/40 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Роль</th>
                  <th className="px-4 py-3 font-medium">Участники</th>
                  {!readOnly && <th className="px-4 py-3 font-medium w-20" />}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const assignments = getRoleAssignmentsForPerformance(
                    state,
                    activePerformance.id,
                    role.id
                  );

                  return (
                    <tr key={role.id} className="border-t border-gold/10 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{role.name}</p>
                        {role.kind === 'character' && role.scriptAliases && role.scriptAliases.length > 0 && (
                          <p className="mt-1 text-xs text-muted">
                            В тексте: {role.scriptAliases.join(', ')}
                          </p>
                        )}
                        {role.description && (
                          <p className="mt-1 text-xs text-muted">{role.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {assignments.map((assignment) => {
                            const actor = state.actors.find((a) => a.id === assignment.actorId);
                            if (!actor) return null;
                            return (
                              <span
                                key={assignment.id}
                                className="inline-flex items-center gap-2 rounded-full bg-gold/10 py-1 pl-1 pr-2 text-sm text-gold-light"
                              >
                                <ActorAvatar
                                  name={actor.name}
                                  photoUrl={actor.photoUrl}
                                  size="sm"
                                />
                                {actor.name}
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => unassign(assignment.id)}
                                    className="rounded-full p-0.5 hover:bg-white/10"
                                    aria-label={`Снять ${actor.name} с роли`}
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                          {assignments.length === 0 && (
                            <span className="text-xs text-muted">Не назначены</span>
                          )}
                          {!readOnly &&
                          activeActors.some(
                            (actor) =>
                              !isActorAssignedToRole(
                                state,
                                activePerformance.id,
                                role.id,
                                actor.id
                              )
                          ) ? (
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1 text-xs"
                              onClick={() => openAssignModal(role)}
                            >
                              <UserPlus size={14} />
                              Добавить
                            </Button>
                          ) : null}
                        </div>
                      </td>
                      {!readOnly && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1"
                            onClick={() => openEditRole(role)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <DeleteButton
                            label={`Удалить роль «${role.name}»`}
                            onClick={() => deleteRole(role)}
                          />
                        </div>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="cast" className="mt-5 scroll-mt-28 space-y-5 border-t border-gold/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted">
            Роли и распределение
          </h3>
          <p className="mt-1 text-xs text-muted">
            Состав можно менять для каждого показа — один участник может быть в нескольких ролях,
            постановочной и технической группах
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && !activePerformance?.isDefault && sourcePerformanceId && (
            <Button variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={copyCastFromDefault}>
              <Copy size={14} />
              Скопировать из основного
            </Button>
          )}
          {!readOnly && (
            <Button variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={openCreatePerformance}>
              <Plus size={14} />
              Показ
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {performances.map((performance) => (
          <div key={performance.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => selectPerformance(performance.id)}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                activePerformance?.id === performance.id
                  ? 'bg-gold/15 text-gold-light'
                  : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
              }`}
            >
              {formatPerformanceLabel(performance)}
              {performance.isDefault && (
                <span className="ml-2 text-xs text-muted">· базовый</span>
              )}
            </button>
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={() => openEditPerformance(performance)}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-white/10 hover:text-gold-light"
                  title="Редактировать показ"
                >
                  <Pencil size={14} />
                </button>
                {!performance.isDefault && (
                  <DeleteButton
                    label={`Удалить показ «${performance.name}»`}
                    onClick={() => deletePerformance(performance)}
                  />
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {activePerformance && (
        <div className="rounded-xl border border-gold/10 bg-background/20 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-white">{activePerformance.name}</p>
              {(activePerformance.description ?? activePerformance.notes) && (
                <p className="mt-1 text-sm text-muted whitespace-pre-wrap">
                  {activePerformance.description ?? activePerformance.notes}
                </p>
              )}
              {(activePerformance.date || activePerformance.startTime) && (
                <p className="mt-1 text-xs text-muted">
                  {[
                    activePerformance.date?.split('-').reverse().join('.'),
                    activePerformance.startTime,
                    activePerformance.date
                      ? (() => {
                          const premiere = getUpcomingPremiere(state, playId);
                          if (
                            premiere &&
                            premiere.performance.id === activePerformance.id
                          ) {
                            return formatPremiereCountdown(premiere.daysLeft);
                          }
                          return null;
                        })()
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            {!readOnly && (
              <Button
                variant="secondary"
                className="!px-3 !py-1.5 text-sm shrink-0"
                onClick={() => openEditPerformance(activePerformance)}
              >
                <Pencil size={14} />
                Редактировать
              </Button>
            )}
          </div>
        </div>
      )}

      {renderRoleTable(characterRoles, 'Роли в спектакле', 'character')}
      {renderRoleTable(crewRoles, 'Постановочная группа', 'crew')}
      {renderRoleTable(technicalRoles, 'Техническая группа', 'technical')}

      {!readOnly && (
        <>
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={editingRole ? 'Редактировать роль' : 'Новая роль'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRoleModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={saveRole}>Сохранить</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название роли"
            value={roleForm.name}
            onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
          />
          <Select
            label="Тип"
            value={roleForm.kind}
            onChange={(e) => setRoleForm({ ...roleForm, kind: e.target.value as PlayRoleKind })}
            options={[
              { value: 'character', label: 'Роль в спектакле' },
              { value: 'crew', label: 'Постановочная группа' },
              { value: 'technical', label: 'Техническая группа' },
            ]}
          />
          <Input
            label="Порядок"
            type="number"
            value={roleForm.order}
            onChange={(e) => setRoleForm({ ...roleForm, order: Number(e.target.value) || 1 })}
          />
          <Textarea
            label="Описание"
            value={roleForm.description ?? ''}
            onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
          />
          {roleForm.kind === 'character' && (
            <div className="space-y-1.5">
              <Input
                label="Имена в тексте пьесы"
                value={roleAliasesText}
                onChange={(e) => setRoleAliasesText(e.target.value)}
                placeholder="Михель"
              />
              <p className="text-xs text-muted">
                Через запятую — если в сценарии персонаж подписан иначе, чем в списке ролей
              </p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={performanceModalOpen}
        onClose={() => setPerformanceModalOpen(false)}
        title={editingPerformance ? 'Редактировать показ' : 'Новый показ'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPerformanceModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={savePerformance}>Сохранить</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название"
            value={performanceForm.name}
            onChange={(e) => setPerformanceForm({ ...performanceForm, name: e.target.value })}
            placeholder="Премьера, Показ 2..."
          />
          <Textarea
            label="Описание"
            value={performanceForm.description ?? ''}
            onChange={(e) =>
              setPerformanceForm({ ...performanceForm, description: e.target.value })
            }
            placeholder="Площадка, особенности состава, заметки к показу..."
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Дата"
              type="date"
              value={performanceForm.date ?? ''}
              onChange={(e) => setPerformanceForm({ ...performanceForm, date: e.target.value })}
            />
            <Input
              label="Время"
              type="time"
              value={performanceForm.startTime ?? ''}
              onChange={(e) =>
                setPerformanceForm({ ...performanceForm, startTime: e.target.value })
              }
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(assignRole)}
        onClose={closeAssignModal}
        title={assignRole ? `Участник для «${assignRole.name}»` : 'Выбор участника'}
      >
        <div className="space-y-4">
          <Input
            label="Поиск"
            value={assignSearch}
            onChange={(event) => setAssignSearch(event.target.value)}
            placeholder="Имя или @telegram"
            autoFocus
          />
          {assignableActors.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gold/15 px-4 py-6 text-center text-sm text-muted">
              {assignSearch.trim()
                ? 'Никого не найдено'
                : 'Все активные участники уже назначены на эту роль'}
            </p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-gold/10 bg-background/20 p-1">
              {assignableActors.map((actor) => (
                <li key={actor.id}>
                  <button
                    type="button"
                    onClick={() => void handleAssignFromModal(actor.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gold/10"
                  >
                    <ActorAvatar name={actor.name} photoUrl={actor.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">
                        {actor.name}
                      </span>
                      {actor.telegramUsername && (
                        <span className="block truncate text-xs text-muted">
                          @{actor.telegramUsername.replace(/^@+/, '')}
                        </span>
                      )}
                      {!normalizeActorEmail(actor.email) && (
                        <span className="mt-0.5 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-200">
                          нет email — личный кабинет не откроется
                        </span>
                      )}
                    </span>
                    <UserPlus size={16} className="shrink-0 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
        </>
      )}
    </div>
  );
}
