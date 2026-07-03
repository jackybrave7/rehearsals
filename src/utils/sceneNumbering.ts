import type { Scene } from '../types';

export function renumberScenesForPlay(scenes: Scene[], playId: string): Scene[] {
  const playScenes = scenes
    .filter((scene) => scene.playId === playId)
    .sort((a, b) => a.number - b.number);

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
