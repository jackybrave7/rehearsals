import type { Scene } from '../types';
import { getSceneShortLabel, groupScenesByAct } from '../utils/sceneLabels';

interface SceneSelectProps {
  label?: string;
  scenes: Scene[];
  value: string;
  onChange: (sceneId: string) => void;
  emptyLabel?: string;
}

export function SceneSelect({
  label,
  scenes,
  value,
  onChange,
  emptyLabel = '— выбрать —',
}: SceneSelectProps) {
  const groups = groupScenesByAct(scenes);
  const inputId = label?.toLowerCase().replace(/\s/g, '-');

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm text-muted">
          {label}
        </label>
      )}
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gold/20 bg-background/50 px-3 py-2 text-sm text-white focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
      >
        <option value="" className="bg-surface">
          {emptyLabel}
        </option>
        {groups.map(({ group, scenes: groupScenes }) => (
          <optgroup key={group} label={group} className="bg-surface">
            {groupScenes.map((scene) => (
              <option key={scene.id} value={scene.id} className="bg-surface">
                {scene.number}. {getSceneShortLabel(scene)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
