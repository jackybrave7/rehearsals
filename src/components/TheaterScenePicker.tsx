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
import { PlayIcon } from './PlayIcon';

interface TheaterScenePickerProps {
  plays: Play[];
  scenes: Scene[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Постановка по умолчанию — обычно текущая выбранная в шапке */
  defaultPlayId?: string | null;
  /** Управляемая постановка (для форм с playId в данных) */
  selectedPlayId?: string | null;
  onPlayChange?: (playId: string) => void;
  selectionMode?: 'single' | 'multiple';
  excludeRehearsalId?: string;
  /** Показывать постановки без заведённых сцен (для блоков плана) */
  includePlaysWithoutScenes?: boolean;
}

export function TheaterScenePicker({
  plays,
  scenes,
  selectedIds,
  onChange,
  defaultPlayId,
  selectedPlayId,
  onPlayChange,
  selectionMode = 'multiple',
  excludeRehearsalId,
  includePlaysWithoutScenes = false,
}: TheaterScenePickerProps) {
  const { state } = useRehearsalStore();

  const selectablePlays = useMemo(() => {
    const list = includePlaysWithoutScenes
      ? [...plays]
      : plays.filter((play) => scenes.some((scene) => scene.playId === play.id));
    return list.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  }, [plays, scenes, includePlaysWithoutScenes]);

  const resolveBrowsePlayId = (preferred?: string | null) => {
    if (preferred && selectablePlays.some((play) => play.id === preferred)) return preferred;
    return selectablePlays[0]?.id ?? '';
  };

  const [browsePlayId, setBrowsePlayId] = useState(() =>
    resolveBrowsePlayId(selectedPlayId ?? defaultPlayId)
  );

  useEffect(() => {
    setBrowsePlayId(resolveBrowsePlayId(selectedPlayId ?? defaultPlayId));
  }, [selectedPlayId, defaultPlayId, selectablePlays]);

  const handlePlayChange = (playId: string) => {
    setBrowsePlayId(playId);
    onPlayChange?.(playId);
  };

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

  const browsePlay = selectablePlays.find((play) => play.id === browsePlayId);

  if (selectablePlays.length === 0) {
    return (
      <p className="text-sm text-muted">
        {includePlaysWithoutScenes
          ? 'Нет постановок в театре.'
          : 'Нет сцен в театре. Добавьте сцены в постановках.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-[12rem] flex-1 items-end gap-2">
          {browsePlay && <PlayIcon play={browsePlay} size="sm" className="mb-2 shrink-0" />}
          <div className="min-w-0 flex-1">
            <Select
              label="Постановка"
              value={browsePlayId}
              onChange={(e) => handlePlayChange(e.target.value)}
              options={selectablePlays.map((play) => ({
                value: play.id,
                label: play.archivedAt ? `«${play.title}» (архив)` : `«${play.title}»`,
              }))}
            />
          </div>
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
          selectionMode={selectionMode}
        />
      ) : (
        <p className="text-sm text-muted">
          {includePlaysWithoutScenes
            ? 'Конкретные сцены ещё не заведены — блок будет привязан к постановке.'
            : 'В этой постановке пока нет сцен.'}
        </p>
      )}
    </div>
  );
}
