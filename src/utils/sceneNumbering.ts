import type { Scene } from '../types';
import { parseActScene } from './googleDocs';

export function sceneScriptNumber(scene: Pick<Scene, 'title' | 'number'>): number {
  return parseActScene(scene.title).scene ?? scene.number;
}

export function compareScenesByScriptOrder(
  a: Pick<Scene, 'title' | 'number'>,
  b: Pick<Scene, 'title' | 'number'>
): number {
  const aKey = parseActScene(a.title);
  const bKey = parseActScene(b.title);

  if (aKey.act !== undefined && bKey.act !== undefined && aKey.act !== bKey.act) {
    return aKey.act - bKey.act;
  }

  const aScene = aKey.scene ?? a.number;
  const bScene = bKey.scene ?? b.number;
  if (aScene !== bScene) return aScene - bScene;

  return a.number - b.number;
}

export function resolveSceneNumberFromTitle(title: string, fallbackOrder: number): number {
  return parseActScene(title).scene ?? fallbackOrder;
}

/** Выставляет scene.number по номеру в заголовке («Сцена 4» → 4). */
export function normalizeSceneNumbersFromTitles(scenes: Scene[], playId: string): Scene[] {
  const playScenes = scenes.filter((scene) => scene.playId === playId);
  const sorted = [...playScenes].sort(compareScenesByScriptOrder);
  const byId = new Map(
    sorted.map((scene, index) => [
      scene.id,
      {
        ...scene,
        number: resolveSceneNumberFromTitle(scene.title, index + 1),
      },
    ])
  );

  if (playScenes.every((scene) => byId.get(scene.id)?.number === scene.number)) {
    return scenes;
  }

  return scenes.map((scene) => byId.get(scene.id) ?? scene);
}

export function buildSceneNumberUpdates(
  before: Scene[],
  scenes: Scene[],
  playId: string
): Scene[] {
  const normalized = normalizeSceneNumbersFromTitles(scenes, playId);
  return normalized.filter((scene) => {
    if (scene.playId !== playId) return false;
    const previous = before.find((item) => item.id === scene.id);
    return previous != null && previous.number !== scene.number;
  });
}

export function renumberScenesForPlay(scenes: Scene[], playId: string): Scene[] {
  const playScenes = scenes
    .filter((scene) => scene.playId === playId)
    .sort((a, b) => compareScenesByScriptOrder(a, b));

  const renumbered = new Map(
    playScenes.map((scene, index) => [scene.id, { ...scene, number: index + 1 }])
  );

  if (playScenes.every((scene, index) => scene.number === index + 1)) {
    return scenes;
  }

  return scenes.map((scene) => renumbered.get(scene.id) ?? scene);
}

export function normalizeAllSceneNumbers(scenes: Scene[]): Scene[] {
  const playIds = [...new Set(scenes.map((scene) => scene.playId))];
  return playIds.reduce((result, playId) => renumberScenesForPlay(result, playId), scenes);
}

export function renumberPlayScenesAfterDelete(scenes: Scene[], deletedSceneId: string): Scene[] {
  const deletedScene = scenes.find((scene) => scene.id === deletedSceneId);
  if (!deletedScene) return scenes;

  const remaining = scenes.filter((scene) => scene.id !== deletedSceneId);
  return renumberScenesForPlay(remaining, deletedScene.playId);
}

export function scenesNumbersChanged(before: Scene[], after: Scene[]): boolean {
  return after.some((scene) => {
    const original = before.find((item) => item.id === scene.id);
    return original != null && original.number !== scene.number;
  });
}
