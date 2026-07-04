import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import type { Play, Scene } from '../types';
import { getSceneShortLabel, groupScenesByAct } from '../utils/sceneLabels';
import { setPlanPoolDragData } from '../utils/schedulePlan';
import { SceneStatusBadge } from './SceneStatusBadge';
import { SceneScriptLink, ActScriptLink } from './SceneScriptLink';

interface TheaterSceneListGroupedProps {
  plays: Play[];
  scenes: Scene[];
  compact?: boolean;
  draggable?: boolean;
}

export function TheaterSceneListGrouped({
  plays,
  scenes,
  compact,
  draggable,
}: TheaterSceneListGroupedProps) {
  const [collapsedPlays, setCollapsedPlays] = useState<Record<string, boolean>>({});

  const scenesByPlay = useMemo(() => {
    const map = new Map<string, Scene[]>();
    for (const scene of scenes) {
      const list = map.get(scene.playId) ?? [];
      list.push(scene);
      map.set(scene.playId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.number - b.number);
    }
    return map;
  }, [scenes]);

  const orderedPlays = useMemo(
    () =>
      plays
        .filter((play) => (scenesByPlay.get(play.id)?.length ?? 0) > 0)
        .sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [plays, scenesByPlay]
  );

  if (scenes.length === 0) return null;

  if (orderedPlays.length <= 1) {
    const play = orderedPlays[0];
    return (
      <SceneListByPlay
        play={play}
        scenes={scenes}
        compact={compact}
        draggable={draggable}
      />
    );
  }

  return (
    <div className="space-y-2">
      {orderedPlays.map((play) => {
        const playScenes = scenesByPlay.get(play.id) ?? [];
        const playCollapsed = collapsedPlays[play.id] ?? false;

        return (
          <div
            key={play.id}
            className="overflow-hidden rounded-xl border border-gold/10 bg-background/20"
          >
            <button
              type="button"
              onClick={() =>
                setCollapsedPlays((prev) => ({ ...prev, [play.id]: !playCollapsed }))
              }
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03]"
            >
              {playCollapsed ? (
                <ChevronRight size={14} className="shrink-0 text-muted" />
              ) : (
                <ChevronDown size={14} className="shrink-0 text-muted" />
              )}
              <span className="text-sm font-medium text-white">«{play.title}»</span>
              <span className="ml-auto text-xs text-muted">{playScenes.length}</span>
            </button>
            {!playCollapsed && (
              <div className="border-t border-gold/10 px-2 pb-2 pt-1">
                <SceneListByPlay
                  play={play}
                  scenes={playScenes}
                  compact={compact}
                  draggable={draggable}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SceneListByPlay({
  play,
  scenes,
  compact,
  draggable,
}: {
  play?: Play;
  scenes: Scene[];
  compact?: boolean;
  draggable?: boolean;
}) {
  const groups = groupScenesByAct(scenes);

  return (
    <div className="space-y-3">
      {groups.map(({ group, scenes: groupScenes }) => (
        <section key={group}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-gold/80">{group}</h3>
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
                    {play && <SceneScriptLink play={play} scene={scene} compact />}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
