import type { AppState } from '../types';
import {
  DEMO_CHAIKA_PLAY_META,
  DEMO_CHAIKA_SCENE_COUNT,
  DEMO_CHAIKA_SCENE_SEEDS,
} from '../data/demoChaika';
import { isDemoTheater } from './demoTheaterIdentity';

/** Синк с Google/файлом подменял заголовки на «Сцена 1 (…)` в каждом действии. */
export function isAmbiguousPerActSceneTitle(title: string): boolean {
  const trimmed = title.trim();
  if (/акт|действие|сц\.\s*\d/i.test(trimmed)) return false;
  return /^Сцена\s+\d+\s*\(/i.test(trimmed);
}

export function migrateDemoChaikaSceneCatalog(state: AppState): AppState {
  const demoTheaterIds = new Set(state.theaters.filter(isDemoTheater).map((theater) => theater.id));
  if (demoTheaterIds.size === 0) return state;

  const demoPlayIds = new Set(
    state.plays
      .filter(
        (play) =>
          play.theaterId &&
          demoTheaterIds.has(play.theaterId) &&
          play.title === DEMO_CHAIKA_PLAY_META.title
      )
      .map((play) => play.id)
  );
  if (demoPlayIds.size === 0) return state;

  let changed = false;
  const scenes = state.scenes.map((scene) => scene);

  for (const playId of demoPlayIds) {
    const playScenes = scenes
      .filter((scene) => scene.playId === playId)
      .sort((a, b) => a.number - b.number);

    if (playScenes.length !== DEMO_CHAIKA_SCENE_COUNT) continue;

    const ambiguous = playScenes.filter((scene) => isAmbiguousPerActSceneTitle(scene.title)).length;
    const mismatched = playScenes.some(
      (scene, index) => scene.title !== DEMO_CHAIKA_SCENE_SEEDS[index]!.title
    );
    if (ambiguous < 3 && !mismatched) continue;

    playScenes.forEach((scene, index) => {
      const seed = DEMO_CHAIKA_SCENE_SEEDS[index]!;
      const idx = scenes.findIndex((item) => item.id === scene.id);
      if (idx < 0) return;

      const next = {
        ...scenes[idx]!,
        title: seed.title,
        number: index + 1,
        actGroup: `Акт ${seed.act}`,
        description: scenes[idx]!.description?.trim() ? scenes[idx]!.description : seed.description,
      };

      if (
        next.title !== scenes[idx]!.title ||
        next.number !== scenes[idx]!.number ||
        next.actGroup !== scenes[idx]!.actGroup
      ) {
        changed = true;
        scenes[idx] = next;
      }
    });
  }

  return changed ? { ...state, scenes } : state;
}
