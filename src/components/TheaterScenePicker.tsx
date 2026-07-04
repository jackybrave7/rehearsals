import { useEffect, useMemo, useState } from 'react';
import type { Play, Scene } from '../types';
import { useRehearsalStore } from '../store/RehearsalContext';
import {
  formatPerformanceLabel,
  getPlayRoles,
  getSelectedPerformance,
} from '../store/selectors';
import { buildPlayReadinessReport } from '../utils/sceneReadiness';
import { Select } from './FormFields';
import { ScenePicker } from './ScenePicker';

interface TheaterScenePickerProps {
  plays: Play[];
  scenes: Scene[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Постановка по умолчанию — обычно текущая выбранная в шапке */
  defaultPlayId?: string | null;
  excludeRehearsalId?: string;
}

export function TheaterScenePicker({
  plays,
  scenes,
  selectedIds,
  onChange,
  defaultPlayId,
  excludeRehearsalId,
}: TheaterScenePickerProps) {
  const { state } = useRehearsalStore();

  const playsWithScenes = useMemo(
    () =>
      plays
        .filter((play) => scenes.some((scene) => scene.playId === play.id))
        .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [plays, scenes]
  );

  const resolveBrowsePlayId = (preferred?: string | null) => {
    if (preferred && playsWithScenes.some((play) => play.id === preferred)) return preferred;
    return playsWithScenes[0]?.id ?? '';
  };

  const [browsePlayId, setBrowsePlayId] = useState(() => resolveBrowsePlayId(defaultPlayId));

  useEffect(() => {
    setBrowsePlayId(resolveBrowsePlayId(defaultPlayId));
  }, [defaultPlayId, playsWithScenes]);

  const browseScenes = useMemo(
    () =>
      scenes
        .filter((scene) => scene.playId === browsePlayId)
        .sort((a, b) => a.number - b.number),
    [scenes, browsePlayId]
  );

  const characterRoles = useMemo(
    () => (browsePlayId ? getPlayRoles(state, browsePlayId, 'character') : []),
    [state, browsePlayId]
  );

  const performance = browsePlayId ? getSelectedPerformance(state, browsePlayId) : null;

  const readinessBySceneId = useMemo(() => {
    if (!browsePlayId) return new Map();
    const report = buildPlayReadinessReport(state, browsePlayId);
    return new Map(report.items.map((item) => [item.scene.id, item]));
  }, [state, browsePlayId]);

  const selectedElsewhere = useMemo(() => {
    const browseIds = new Set(browseScenes.map((scene) => scene.id));
    return selectedIds.filter((id) => !browseIds.has(id)).length;
  }, [selectedIds, browseScenes]);

  if (playsWithScenes.length === 0) {
    return <p className="text-sm text-muted">Нет сцен в театре. Добавьте сцены в постановках.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          <Select
            label="Постановка"
            value={browsePlayId}
            onChange={(e) => setBrowsePlayId(e.target.value)}
            options={playsWithScenes.map((play) => ({
              value: play.id,
              label: play.archivedAt ? `«${play.title}» (архив)` : `«${play.title}»`,
            }))}
          />
        </div>
        {selectedIds.length > 0 && (
          <p className="pb-2 text-xs text-muted">
            Выбрано {selectedIds.length}
            {selectedElsewhere > 0 ? ` · ${selectedElsewhere} из других постановок` : ''}
          </p>
        )}
      </div>

      {performance && (
        <p className="text-xs text-muted">
          Состав: {formatPerformanceLabel(performance)} — наведите на персонажа, чтобы увидеть актёра
        </p>
      )}

      {browseScenes.length > 0 ? (
        <ScenePicker
          scenes={browseScenes}
          selectedIds={selectedIds}
          onChange={onChange}
          characterRoles={characterRoles}
          playId={browsePlayId}
          performanceId={performance?.id}
          performanceLabel={performance ? formatPerformanceLabel(performance) : undefined}
          readinessBySceneId={readinessBySceneId}
          excludeRehearsalId={excludeRehearsalId}
        />
      ) : (
        <p className="text-sm text-muted">В этой постановке пока нет сцен.</p>
      )}
    </div>
  );
}
