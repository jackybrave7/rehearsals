import type { AppState, Scene } from '../types';
import { compareScenesByScriptOrder } from './sceneNumbering';
import { getSceneRoles } from '../store/selectors';

const ACT_GROUP_RE = /^Акт\s+\d+(?:,\s*\d+\s*часть)?/i;
const ACTION_GROUP_RE = /^Действие\s+(?:\d+|[IVXLC]+|первое|второе|третье|четв[её]ртое|пятое|шестое|седьмое|восьмое|девятое|десятое)/i;
const SCENE_TITLE_RE =
  /^Акт\s+\d+(?:,\s*\d+\s*часть)?,\s*сц\.\s*(\d+)\s*[—–-]\s*(.+)$/i;
const ACT_SCENE_HEADING_RE =
  /^Акт\s+(\d+)(?:,\s*(\d+)\s*часть)?,\s*сц\.\s*(\d+)/i;

export function getSceneActGroup(scene: Scene): string {
  if (scene.actGroup?.trim()) return scene.actGroup.trim();
  const match = scene.title.match(ACT_GROUP_RE);
  if (match) return match[0];
  const actionMatch = scene.title.match(ACTION_GROUP_RE);
  if (actionMatch) return actionMatch[0];
  return 'Сцены';
}

export function getSceneShortLabel(scene: Scene): string {
  return scene.title;
}

/** «1 акт, 4 сцена» — для Telegram и экспорта */
export function getTelegramSceneHeading(scene: Scene): string {
  const match = scene.title.match(ACT_SCENE_HEADING_RE);
  if (!match) return `сц. ${scene.number}`;
  const [, act, part, sceneNum] = match;
  if (part) return `${act} акт ${part} часть, ${sceneNum} сцена`;
  return `${act} акт, ${sceneNum} сцена`;
}

export function getTelegramSceneLocation(scene: Scene): string | null {
  const match = scene.title.match(SCENE_TITLE_RE);
  return match?.[2]?.trim() ?? null;
}

/** Имена персонажей сцены по пьесе (короткая форма до запятой) */
export function getSceneCharacterNames(state: AppState, scene: Scene): string[] {
  return getSceneRoles(state, scene)
    .filter((role) => role.kind === 'character')
    .map((role) => role.name.split(',')[0]?.trim() || role.name);
}

export function groupScenesByAct(scenes: Scene[]): { group: string; scenes: Scene[] }[] {
  const sorted = [...scenes].sort(compareScenesByScriptOrder);
  const groups = new Map<string, Scene[]>();

  for (const scene of sorted) {
    const group = getSceneActGroup(scene);
    const list = groups.get(group) ?? [];
    list.push(scene);
    groups.set(group, list);
  }

  return Array.from(groups.entries()).map(([group, groupScenes]) => ({
    group,
    scenes: groupScenes,
  }));
}

export function sceneMatchesQuery(scene: Scene, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    scene.title.toLowerCase().includes(normalized) ||
    String(scene.number).includes(normalized) ||
    getSceneShortLabel(scene).toLowerCase().includes(normalized)
  );
}
