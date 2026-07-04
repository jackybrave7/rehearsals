import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { PlayRole, Scene, SceneStatus } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActorNamesForRoleInPerformance, getSceneRoles } from '../store/selectors';
import { groupScenesByAct, getSceneShortLabel } from '../utils/sceneLabels';
import { buildSceneRehearsalDatesMap } from '../utils/sceneRehearsalHistory';
import {
  countScenesByRole,
  countScenesByStatus,
  sceneMatchesFilters,
  sceneStatusColors,
  sceneStatusFilterOrder,
  sceneStatusLabels,
} from '../utils/sceneFilters';
import type { SceneReadinessItem } from '../utils/sceneReadiness';
import { heatLevelColors, heatLevelLabel } from '../utils/sceneReadiness';
import { SceneStatusBadge } from './SceneStatusBadge';
import { SceneRoleChip } from './SceneRoleChip';

const priorityLabels = {
  high: 'Важно',
  medium: 'Средне',
  low: 'Можно позже',
} as const;

const priorityColors = {
  high: 'bg-red-500/20 text-red-200',
  medium: 'bg-gold/15 text-gold-light',
  low: 'bg-white/5 text-muted',
} as const;

interface ScenePickerProps {
  scenes: Scene[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  characterRoles?: PlayRole[];
  playId?: string;
  performanceId?: string;
  performanceLabel?: string;
  readinessBySceneId?: Map<string, SceneReadinessItem>;
  excludeRehearsalId?: string;
}

export function ScenePicker({
  scenes,
  selectedIds,
  onChange,
  characterRoles = [],
  playId,
  performanceId,
  performanceLabel = 'Состав',
  readinessBySceneId,
  excludeRehearsalId,
}: ScenePickerProps) {
  const { state } = useRehearsalStore();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<SceneStatus>>(new Set());
  const [characterFilter, setCharacterFilter] = useState<Set<string>>(new Set());
  const [characterFilterOnlySelected, setCharacterFilterOnlySelected] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => groupScenesByAct(scenes), [scenes]);
  const statusCounts = useMemo(() => countScenesByStatus(scenes), [scenes]);
  const roleSceneCounts = useMemo(
    () => countScenesByRole(scenes, characterRoles),
    [scenes, characterRoles]
  );
  const sceneRehearsalDates = useMemo(
    () =>
      buildSceneRehearsalDatesMap(state.rehearsals, {
        playId,
        excludeRehearsalId,
        getScenePlayId: (sceneId) => state.scenes.find((s) => s.id === sceneId)?.playId,
      }),
    [state.rehearsals, playId, excludeRehearsalId]
  );

  const filteredGroups = useMemo(
    () =>
      grouped
        .map(({ group, scenes: groupScenes }) => ({
          group,
          scenes: groupScenes.filter((scene) =>
            sceneMatchesFilters(scene, query, statusFilter, characterFilter, {
              onlySelected: characterFilterOnlySelected,
            })
          ),
        }))
        .filter(({ scenes: groupScenes }) => groupScenes.length > 0),
    [grouped, query, statusFilter, characterFilter, characterFilterOnlySelected]
  );

  const visibleCount = filteredGroups.reduce(
    (sum, { scenes: groupScenes }) => sum + groupScenes.length,
    0
  );

  const visibleIds = filteredGroups.flatMap(({ scenes: groupScenes }) =>
    groupScenes.map((scene) => scene.id)
  );

  const hasActiveFilters =
    query.trim().length > 0 ||
    statusFilter.size > 0 ||
    characterFilter.size > 0 ||
    characterFilterOnlySelected;

  const visibleCharacterRoles =
    characterFilterOnlySelected && characterFilter.size > 0
      ? characterRoles.filter((role) => characterFilter.has(role.id))
      : characterRoles;

  const toggleScene = (sceneId: string) => {
    onChange(
      selectedIds.includes(sceneId)
        ? selectedIds.filter((id) => id !== sceneId)
        : [...selectedIds, sceneId]
    );
  };

  const toggleGroup = (groupSceneIds: string[]) => {
    const allSelected = groupSceneIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      onChange(selectedIds.filter((id) => !groupSceneIds.includes(id)));
      return;
    }
    onChange([...new Set([...selectedIds, ...groupSceneIds])]);
  };

  const selectVisible = () => onChange([...new Set([...selectedIds, ...visibleIds])]);
  const clearAll = () => onChange([]);

  const toggleStatusFilter = (status: SceneStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

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

  const toggleCollapsed = (group: string) => {
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  if (scenes.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Сцены для прохождения</p>
        <p className="text-xs text-muted">
          Выбрано {selectedIds.length} из {scenes.length}
          {hasActiveFilters ? ` · видно ${visibleCount}` : ''}
        </p>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по номеру, месту, акту..."
          className="w-full rounded-lg border border-gold/15 bg-background/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-gold/30 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Статус:</span>
        <button
          type="button"
          onClick={() => setStatusFilter(new Set())}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            statusFilter.size === 0
              ? 'bg-gold/20 text-gold-light ring-1 ring-gold/30'
              : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
          }`}
        >
          Все ({scenes.length})
        </button>
        {sceneStatusFilterOrder.map((status) => {
          const selected = statusFilter.has(status);
          const count = statusCounts[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                selected
                  ? `${sceneStatusColors[status]} ring-1 ring-white/10`
                  : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
              }`}
            >
              {sceneStatusLabels[status]} ({count})
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
              onClick={() => {
                setCharacterFilter(new Set());
                setCharacterFilterOnlySelected(false);
              }}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectVisible}
          className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          Выбрать видимые
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          Снять все
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setStatusFilter(new Set());
              setCharacterFilter(new Set());
              setCharacterFilterOnlySelected(false);
            }}
            className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-muted transition-colors hover:bg-white/10 hover:text-white"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto rounded-xl border border-gold/10 bg-background/20">
        {filteredGroups.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">Ничего не найдено</p>
        ) : (
          filteredGroups.map(({ group, scenes: groupScenes }) => {
            const groupIds = groupScenes.map((scene) => scene.id);
            const selectedInGroup = groupIds.filter((id) => selectedIds.includes(id)).length;
            const isCollapsed = collapsed[group] ?? false;

            return (
              <section key={group} className="border-b border-gold/10 last:border-b-0">
                <div className="sticky top-0 z-10 flex items-center gap-2 bg-surface/95 px-3 py-2 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(group)}
                    className="rounded p-0.5 text-muted hover:text-white"
                    aria-label={isCollapsed ? 'Развернуть' : 'Свернуть'}
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleGroup(groupIds)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="text-sm font-medium text-gold-light">{group}</span>
                    <span className="ml-2 text-xs text-muted">
                      {selectedInGroup}/{groupScenes.length}
                    </span>
                  </button>
                </div>

                {!isCollapsed && (
                  <ul className="divide-y divide-gold/5">
                    {groupScenes.map((scene) => {
                      const selected = selectedIds.includes(scene.id);
                      const pastDates = sceneRehearsalDates.get(scene.id);
                      const sceneCharacters = getSceneRoles(state, scene).filter(
                        (role) => role.kind === 'character'
                      );
                      const readiness = readinessBySceneId?.get(scene.id);
                      return (
                        <li
                          key={scene.id}
                          className={selected ? 'bg-emerald-500/[0.07]' : undefined}
                        >
                          <label
                            className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors ${
                              selected ? 'hover:bg-emerald-500/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleScene(scene.id)}
                              className="sr-only"
                            />
                            <span
                              aria-hidden
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                                selected
                                  ? 'border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/30'
                                  : 'border-white/20 bg-background/40 text-transparent hover:border-emerald-400/50'
                              }`}
                            >
                              <Check size={20} strokeWidth={3} />
                            </span>
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gold/10 text-xs font-semibold text-gold">
                              {scene.number}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm text-white">
                                  {getSceneShortLabel(scene)}
                                </span>
                                <SceneStatusBadge status={scene.status} />
                                {readiness && readiness.heat !== 'recent' && (
                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${heatLevelColors(readiness.heat, 'theater')}`}
                                    title={heatLevelLabel(readiness.heat)}
                                  >
                                    {heatLevelLabel(readiness.heat)}
                                  </span>
                                )}
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                                    priorityColors[scene.priority ?? 'medium']
                                  }`}
                                >
                                  {priorityLabels[scene.priority ?? 'medium']}
                                </span>
                              </span>
                              {scene.description && (
                                <span className="mt-1 block text-xs leading-relaxed text-muted">
                                  {scene.description}
                                </span>
                              )}
                              {sceneCharacters.length > 0 && (
                                <span className="mt-1.5 flex flex-wrap gap-1">
                                  {sceneCharacters.map((role) =>
                                    performanceId ? (
                                      <SceneRoleChip
                                        key={role.id}
                                        roleName={role.name.split(',')[0]}
                                        performanceName={performanceLabel}
                                        actorNames={getActorNamesForRoleInPerformance(
                                          state,
                                          performanceId,
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
                                </span>
                              )}
                              {pastDates && pastDates.length > 0 && (
                                <span className="mt-0.5 block text-xs text-muted/80">
                                  Репетиции: {pastDates.join(' · ')}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
