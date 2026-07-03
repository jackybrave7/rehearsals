import { GripVertical } from 'lucide-react';
import type { Scene, Play } from '../types';
import { getSceneShortLabel, groupScenesByAct } from '../utils/sceneLabels';
import { setPlanPoolDragData } from '../utils/schedulePlan';
import { SceneStatusBadge } from './SceneStatusBadge';
import { SceneScriptLink, ActScriptLink } from './SceneScriptLink';

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

interface SceneListGroupedProps {
  scenes: Scene[];
  play?: Play;
  compact?: boolean;
  /** Перетаскивание в план репетиции */
  draggable?: boolean;
}

export function SceneListGrouped({ scenes, play, compact, draggable }: SceneListGroupedProps) {
  const groups = groupScenesByAct(scenes);

  if (scenes.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map(({ group, scenes: groupScenes }) => (
        <section key={group}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gold/80">
              {group}
            </h3>
            {play && <ActScriptLink play={play} actGroup={group} compact />}
          </div>
          <ul className={compact ? 'space-y-1' : 'space-y-2'}>
            {groupScenes.map((scene) => (
              <li
                key={scene.id}
                className={`flex gap-2 text-sm text-white ${
                  compact ? 'items-center' : 'items-start'
                } ${draggable ? 'rounded-lg px-1 py-1 hover:bg-white/[0.03]' : ''}`}
              >
                {draggable ? (
                  <div
                    draggable
                    onDragStart={(event) =>
                      setPlanPoolDragData(event, {
                        source: 'pool',
                        kind: 'scene',
                        id: scene.id,
                      })
                    }
                    aria-label={`Перетащить сцену ${scene.number}`}
                    className="mt-0.5 flex shrink-0 cursor-grab text-muted opacity-60 active:cursor-grabbing hover:opacity-100"
                  >
                    <GripVertical size={14} />
                  </div>
                ) : null}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gold/10 text-[10px] font-bold text-gold">
                  {scene.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-white">{getSceneShortLabel(scene)}</span>
                    <SceneStatusBadge status={scene.status} />
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        priorityColors[scene.priority ?? 'medium']
                      }`}
                    >
                      {priorityLabels[scene.priority ?? 'medium']}
                    </span>
                    {play && <SceneScriptLink play={play} scene={scene} compact />}
                  </span>
                  {scene.description && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                      {scene.description}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
