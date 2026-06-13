import synopses from './chaikaSceneSynopses.json';

/** Краткие описания сцен «Чайки» — события и ключевая информация для постановки. */
export const CHAIKA_SCENE_SYNOPSES: Record<string, string> = synopses;

export function chaikaSceneSynopsis(act: number, sceneInAct: number): string {
  return CHAIKA_SCENE_SYNOPSES[`${act}:${sceneInAct}`] ?? '';
}
