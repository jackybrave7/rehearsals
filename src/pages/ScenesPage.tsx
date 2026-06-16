import { useMemo, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { DeleteButton } from '../components/DeleteButton';
import { Link } from 'react-router-dom';
import { appPaths } from '../navigation/appPaths';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActivePlay, getPlayRoles, getPlayScenes, getSceneRoles, getSelectedPerformance, getActorNamesForRoleInPerformance, formatPerformanceLabel } from '../store/selectors';
import { DEFAULT_SCENE_REHEARSAL_MINUTES } from '../utils/sceneDefaults';
import { generateId } from '../utils/id';
import { formatDuration } from '../utils/time';
import { getSceneShortLabel, groupScenesByAct } from '../utils/sceneLabels';
import type { Scene, ScenePriority, SceneStatus } from '../types';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { useConfirmDialog } from '../components/ConfirmDialogContext';
import { Input, Textarea, Select } from '../components/FormFields';
import { SceneRoleChip } from '../components/SceneRoleChip';
import { SceneWorkHistoryPanel } from '../components/SceneWorkHistoryPanel';
import { GoogleDocsLinksPanel } from '../components/GoogleDocsLinksPanel';
import { SceneScriptLink } from '../components/SceneScriptLink';
import { SceneTimingHint, getSuggestedRehearsalMinutes } from '../components/SceneTimingHint';
import { PremiereBanner } from '../components/PremiereBanner';
import { parseAnchorFromGoogleDocsUrl } from '../utils/googleDocs';
import { resolveSceneTimingSettings } from '../utils/sceneTiming';
import { buildSceneWorkHistory } from '../utils/sceneRehearsalHistory';
import { sceneMatchesCharacterFilter } from '../utils/sceneFilters';

const statusLabels: Record<SceneStatus, string> = {
  not_started: 'Не начата',
  in_progress: 'В работе',
  ready: 'Готова',
};

const statusColors: Record<SceneStatus, string> = {
  not_started: 'bg-gray-500/20 text-gray-300',
  in_progress: 'bg-amber-500/20 text-amber-300',
  ready: 'bg-emerald-500/20 text-emerald-300',
};

const emptyScene = (): Omit<Scene, 'id' | 'playId'> => ({
  number: 1,
  title: '',
  description: '',
  directorNotes: '',
  estimatedMinutes: DEFAULT_SCENE_REHEARSAL_MINUTES,
  status: 'not_started',
  priority: 'medium',
  roleIds: [],
});

const statusFilterOrder: SceneStatus[] = ['not_started', 'in_progress', 'ready'];
const priorityFilterOrder: ScenePriority[] = ['high', 'medium', 'low'];

const priorityLabels: Record<ScenePriority, string> = {
  high: 'Важно',
  medium: 'Средне',
  low: 'Можно позже',
};

const priorityColors: Record<ScenePriority, string> = {
  high: 'bg-red-500/20 text-red-200',
  medium: 'bg-gold/15 text-gold-light',
  low: 'bg-white/5 text-muted',
};

export function ScenesPage() {
  const { state, dispatch } = useRehearsalStore();
  const { confirm } = useConfirmDialog();
  const activePlay = getActivePlay(state);
  const playScenes = getPlayScenes(state, state.activePlayId);
  const selectedPerformance = activePlay ? getSelectedPerformance(state, activePlay.id) : undefined;
  const characterRoles = getPlayRoles(state, activePlay?.id ?? '', 'character');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Scene | null>(null);
  const [form, setForm] = useState(emptyScene());
  const [statusFilter, setStatusFilter] = useState<Set<SceneStatus>>(new Set());
  const [priorityFilter, setPriorityFilter] = useState<Set<ScenePriority>>(new Set());
  const [characterFilter, setCharacterFilter] = useState<Set<string>>(new Set());
  const [characterFilterOnlySelected, setCharacterFilterOnlySelected] = useState(false);
  const [scriptLinkInput, setScriptLinkInput] = useState('');

  const openCreate = () => {
    if (!activePlay) return;
    setEditing(null);
    setForm({ ...emptyScene(), number: playScenes.length + 1 });
    setScriptLinkInput('');
    setModalOpen(true);
  };

  const openEdit = (scene: Scene) => {
    setEditing(scene);
    setForm({ ...scene, roleIds: scene.roleIds ?? [] });
    setScriptLinkInput('');
    setModalOpen(true);
  };

  const toggleRole = (roleId: string) => {
    const roleIds = form.roleIds ?? [];
    setForm({
      ...form,
      roleIds: roleIds.includes(roleId)
        ? roleIds.filter((id) => id !== roleId)
        : [...roleIds, roleId],
    });
  };

  const handleSave = () => {
    if (!activePlay || !form.title.trim()) return;
    const manualAnchor = scriptLinkInput.trim()
      ? parseAnchorFromGoogleDocsUrl(scriptLinkInput.trim())
      : undefined;
    const payload = {
      ...form,
      roleIds: form.roleIds ?? [],
      scriptAnchor: manualAnchor ?? form.scriptAnchor,
    };
    if (editing) {
      dispatch({
        type: 'UPDATE_SCENE',
        payload: { ...payload, id: editing.id, playId: activePlay.id },
      });
    } else {
      dispatch({
        type: 'ADD_SCENE',
        payload: { ...payload, id: generateId(), playId: activePlay.id },
      });
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Удалить сцену?',
      message: 'Сцена будет удалена из постановки и всех связанных планов.',
      confirmLabel: 'Удалить',
      variant: 'danger',
    });
    if (!confirmed) return;
    dispatch({ type: 'DELETE_SCENE', payload: id });
  };

  const handleStatusChange = (scene: Scene, status: SceneStatus) => {
    if (scene.status === status) return;
    dispatch({ type: 'UPDATE_SCENE', payload: { ...scene, status } });
  };

  const sorted = [...playScenes].sort((a, b) => a.number - b.number);

  const statusCounts = useMemo(() => {
    const counts: Record<SceneStatus, number> = {
      not_started: 0,
      in_progress: 0,
      ready: 0,
    };
    for (const scene of sorted) {
      counts[scene.status] += 1;
    }
    return counts;
  }, [sorted]);

  const priorityCounts = useMemo(() => {
    const counts: Record<ScenePriority, number> = {
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const scene of sorted) {
      counts[scene.priority ?? 'medium'] += 1;
    }
    return counts;
  }, [sorted]);

  const roleSceneCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const role of characterRoles) {
      counts.set(role.id, 0);
    }
    for (const scene of sorted) {
      for (const roleId of scene.roleIds ?? []) {
        if (counts.has(roleId)) {
          counts.set(roleId, (counts.get(roleId) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [sorted, characterRoles]);

  const filteredScenes = useMemo(() => {
    let result = sorted;
    if (statusFilter.size > 0) {
      result = result.filter((scene) => statusFilter.has(scene.status));
    }
    if (priorityFilter.size > 0) {
      result = result.filter((scene) => priorityFilter.has(scene.priority ?? 'medium'));
    }
    if (characterFilter.size > 0) {
      result = result.filter((scene) =>
        sceneMatchesCharacterFilter(scene, characterFilter, {
          onlySelected: characterFilterOnlySelected,
        })
      );
    }
    return result;
  }, [sorted, statusFilter, priorityFilter, characterFilter, characterFilterOnlySelected]);

  const groupedScenes = groupScenesByAct(filteredScenes);

  const toggleStatusFilter = (status: SceneStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const clearStatusFilter = () => setStatusFilter(new Set());

  const togglePriorityFilter = (priority: ScenePriority) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(priority)) next.delete(priority);
      else next.add(priority);
      return next;
    });
  };

  const clearPriorityFilter = () => setPriorityFilter(new Set());

  const toggleCharacterFilter = (roleId: string) => {
    setCharacterFilter((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      if (next.size === 0) {
        setCharacterFilterOnlySelected(false);
      }
      return next;
    });
  };

  const clearCharacterFilter = () => {
    setCharacterFilter(new Set());
    setCharacterFilterOnlySelected(false);
  };

  const clearAllFilters = () => {
    setStatusFilter(new Set());
    setPriorityFilter(new Set());
    setCharacterFilter(new Set());
    setCharacterFilterOnlySelected(false);
  };

  const visibleCharacterRoles =
    characterFilterOnlySelected && characterFilter.size > 0
      ? characterRoles.filter((role) => characterFilter.has(role.id))
      : characterRoles;

  const hasActiveFilters =
    statusFilter.size > 0 ||
    priorityFilter.size > 0 ||
    characterFilter.size > 0 ||
    characterFilterOnlySelected;

  if (!activePlay) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Сцены</h1>
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          Сначала добавьте{' '}
          <Link to={appPaths.play} className="text-gold hover:underline">
            постановку
          </Link>
        </div>
      </div>
    );
  }

  const formPreviewScene: Scene = {
    id: editing?.id ?? 'preview',
    playId: activePlay.id,
    ...form,
    scriptCharacterCount: form.scriptCharacterCount ?? editing?.scriptCharacterCount,
  };
  const timingSettings = resolveSceneTimingSettings(state.appMeta);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Сцены</h1>
          <p className="mt-1 text-muted">
            «{activePlay.title}» —{' '}
            {hasActiveFilters
              ? `${filteredScenes.length} из ${sorted.length} сцен`
              : `${sorted.length} сцен`}
          </p>
          {selectedPerformance && (
            <p className="mt-1 text-xs text-muted">
              Состав при наведении:{' '}
              <Link to={appPaths.play} className="text-gold-light hover:underline">
                {formatPerformanceLabel(selectedPerformance)}
              </Link>
            </p>
          )}
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} />
          Добавить сцену
        </Button>
      </header>

      <PremiereBanner state={state} playId={activePlay.id} />

      <GoogleDocsLinksPanel play={activePlay} scenes={sorted} />

      {sorted.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Статус:</span>
            <button
              type="button"
              onClick={clearStatusFilter}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                statusFilter.size === 0
                  ? 'bg-gold/20 text-gold-light ring-1 ring-gold/30'
                  : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
              }`}
            >
              Все ({sorted.length})
            </button>
            {statusFilterOrder.map((status) => {
              const selected = statusFilter.has(status);
              const count = statusCounts[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatusFilter(status)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    selected
                      ? `${statusColors[status]} ring-1 ring-white/10`
                      : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {statusLabels[status]} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Приоритет:</span>
            <button
              type="button"
              onClick={clearPriorityFilter}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                priorityFilter.size === 0
                  ? 'bg-gold/20 text-gold-light ring-1 ring-gold/30'
                  : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
              }`}
            >
              Все
            </button>
            {priorityFilterOrder.map((priority) => {
              const selected = priorityFilter.has(priority);
              const count = priorityCounts[priority];
              return (
                <button
                  key={priority}
                  type="button"
                  onClick={() => togglePriorityFilter(priority)}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    selected
                      ? `${priorityColors[priority]} ring-1 ring-white/10`
                      : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {priorityLabels[priority]} ({count})
                </button>
              );
            })}
          </div>

          {characterRoles.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Персонаж:</span>
                <button
                  type="button"
                  onClick={clearCharacterFilter}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    characterFilter.size === 0
                      ? 'bg-gold/20 text-gold-light ring-1 ring-gold/30'
                      : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                  }`}
                >
                  Все
                </button>
                {visibleCharacterRoles.map((role) => {
                  const selected = characterFilter.has(role.id);
                  const count = roleSceneCounts.get(role.id) ?? 0;
                  const shortName = role.name.split(',')[0];
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleCharacterFilter(role.id)}
                      className={`rounded-full px-3 py-1 text-xs transition-colors ${
                        selected
                          ? 'bg-gold/20 text-gold-light ring-1 ring-gold/30'
                          : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {shortName} ({count})
                    </button>
                  );
                })}
              </div>
              <label
                className={`inline-flex items-center gap-2 text-xs ${
                  characterFilter.size === 0
                    ? 'cursor-not-allowed text-muted/50'
                    : 'cursor-pointer text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  checked={characterFilterOnlySelected}
                  disabled={characterFilter.size === 0}
                  onChange={(event) => setCharacterFilterOnlySelected(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gold/30 accent-gold disabled:opacity-40"
                />
                Только выбранные
              </label>
            </div>
          )}

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted">
                {filteredScenes.length} из {sorted.length} сцен
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-muted underline-offset-2 hover:text-gold-light hover:underline"
              >
                Сбросить все фильтры
              </button>
            </div>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          Добавьте сцены пьесы для планирования репетиций.
        </div>
      ) : filteredScenes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          Нет сцен по выбранным фильтрам.
          <Button className="mt-4" variant="secondary" onClick={clearAllFilters}>
            Показать все
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedScenes.map(({ group, scenes: groupScenes }) => (
            <section
              key={group}
              className="rounded-2xl border border-gold/10 bg-surface/40"
            >
              <div className="border-b border-gold/10 bg-background/30 px-5 py-3">
                <h2 className="text-sm font-semibold text-gold-light">{group}</h2>
                <p className="text-xs text-muted">{groupScenes.length} сцен</p>
              </div>
              <div className="divide-y divide-gold/5">
                {groupScenes.map((scene) => {
                  const roles = getSceneRoles(state, scene);
                  const priority = scene.priority ?? 'medium';
                  const history = buildSceneWorkHistory(state, scene.id);
                  return (
                    <div
                      key={scene.id}
                      className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-xs font-bold text-gold">
                        {scene.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-white">
                          {getSceneShortLabel(scene)}
                        </h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] ${priorityColors[priority]}`}
                          >
                            {priorityLabels[priority]}
                          </span>
                        </div>
                        {scene.description && (
                          <p className="mt-1 text-xs leading-relaxed text-muted">
                            {scene.description}
                          </p>
                        )}
                        <SceneTimingHint scene={scene} appMeta={state.appMeta} compact className="mt-1" />
                        {scene.directorNotes?.trim() && (
                          <p className="mt-1 line-clamp-2 rounded-lg bg-gold/5 px-2 py-1 text-xs text-gold-light/90">
                            Режиссёр: {scene.directorNotes.trim()}
                          </p>
                        )}
                        {roles.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {roles.map((role) =>
                              selectedPerformance ? (
                                <SceneRoleChip
                                  key={role.id}
                                  roleName={role.name.split(',')[0]}
                                  performanceName={formatPerformanceLabel(selectedPerformance)}
                                  actorNames={getActorNamesForRoleInPerformance(
                                    state,
                                    selectedPerformance.id,
                                    role.id
                                  )}
                                />
                              ) : (
                                <span
                                  key={role.id}
                                  className="rounded bg-gold/10 px-1.5 py-0.5 text-[10px] text-gold-light"
                                >
                                  {role.name.split(',')[0]}
                                </span>
                              )
                            )}
                          </div>
                        )}
                        {history.length > 0 && <SceneWorkHistoryPanel history={history} />}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <SceneScriptLink play={activePlay} scene={scene} compact />
                        <span
                          className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted"
                          title="Время на репетицию (можно подставить прогноз из знаков)"
                        >
                          {formatDuration(scene.estimatedMinutes ?? DEFAULT_SCENE_REHEARSAL_MINUTES)}
                        </span>
                        <select
                          value={scene.status}
                          onChange={(e) =>
                            handleStatusChange(scene, e.target.value as SceneStatus)
                          }
                          aria-label={`Статус сцены ${scene.number}`}
                          className={`cursor-pointer rounded-full border border-transparent px-2 py-0.5 text-[10px] transition-colors focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/30 ${statusColors[scene.status]}`}
                        >
                          {(Object.entries(statusLabels) as [SceneStatus, string][]).map(
                            ([value, label]) => (
                              <option key={value} value={value} className="bg-surface text-white">
                                {label}
                              </option>
                            )
                          )}
                        </select>
                        <div className="card-actions flex min-h-10 gap-0.5">
                          <Button
                            variant="ghost"
                            className="!px-1.5 !py-1"
                            onClick={() => openEdit(scene)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <DeleteButton
                            label={`Удалить сцену ${scene.number}`}
                            iconSize={14}
                            onClick={() => handleDelete(scene.id)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Редактировать сцену' : 'Новая сцена'}
        wide
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
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Номер"
              type="number"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
            />
            <Input
              label="На репетицию (мин)"
              type="number"
              value={form.estimatedMinutes ?? DEFAULT_SCENE_REHEARSAL_MINUTES}
              onChange={(e) =>
                setForm({
                  ...form,
                  estimatedMinutes: Number(e.target.value) || DEFAULT_SCENE_REHEARSAL_MINUTES,
                })
              }
            />
          </div>
          <Input
            label="Название"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Акт 1, сц. 2 — Трактир"
          />
          <Textarea
            label="Описание / фрагмент текста"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Текст сцены для прогноза хронометража (знаки с пробелами). Если есть Google Docs — точнее подсчитать оттуда."
          />
          <div className="rounded-xl border border-gold/10 bg-black/20 p-3">
            <SceneTimingHint scene={formPreviewScene} appMeta={state.appMeta} />
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() =>
                setForm({
                  ...form,
                  estimatedMinutes: getSuggestedRehearsalMinutes(formPreviewScene, state.appMeta),
                })
              }
            >
              Подставить прогноз в «На репетицию»
            </Button>
            {timingSettings.charsPerAuthorPage > 0 && (
              <p className="mt-2 text-[11px] text-muted/70">
                1 а.л. = {timingSettings.charsPerAuthorPage.toLocaleString('ru-RU')} зн. ·{' '}
                {timingSettings.performanceMinutesPerAuthorPage} мин спектакль · ×
                {timingSettings.rehearsalMultiplier} на репетицию
              </p>
            )}
          </div>
          <Textarea
            label="Режиссёрские заметки (не для Telegram)"
            value={form.directorNotes ?? ''}
            onChange={(e) => setForm({ ...form, directorNotes: e.target.value })}
          />
          {characterRoles.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-muted">Персонажи в сцене</p>
              <div className="flex flex-wrap gap-2">
                {characterRoles.map((role) => {
                  const selected = (form.roleIds ?? []).includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => toggleRole(role.id)}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        selected
                          ? 'bg-gold/20 text-gold-light ring-1 ring-gold/30'
                          : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {role.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <Select
            label="Статус"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as SceneStatus })}
            options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Приоритет"
            value={form.priority ?? 'medium'}
            onChange={(e) => setForm({ ...form, priority: e.target.value as ScenePriority })}
            options={priorityFilterOrder.map((value) => ({
              value,
              label: priorityLabels[value],
            }))}
          />
          {activePlay.documentUrl && (
            <Input
              label="Ссылка на фрагмент Google Docs"
              value={scriptLinkInput}
              onChange={(e) => setScriptLinkInput(e.target.value)}
              placeholder="Вставьте ссылку с #heading=… или #bookmark=…"
            />
          )}
          {form.scriptAnchor && !scriptLinkInput && (
            <p className="text-xs text-muted">
              Привязан якорь {form.scriptAnchor.type === 'heading' ? 'заголовка' : 'закладки'}:{' '}
              {form.scriptAnchor.id}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
