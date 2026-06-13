import type { AppState, Scene } from '../types';
import { getSceneRoles } from '../store/selectors';

const ACT_GROUP_RE = /^Акт\s+\d+(?:,\s*\d+\s*часть)?/i;
const SCENE_TITLE_RE =
  /^Акт\s+\d+(?:,\s*\d+\s*часть)?,\s*сц\.\s*(\d+)\s*[—–-]\s*(.+)$/i;
const ACT_SCENE_HEADING_RE =
  /^Акт\s+(\d+)(?:,\s*(\d+)\s*часть)?,\s*сц\.\s*(\d+)/i;

function formatLocation(location: string): string {
  const trimmed = location.trim().replace(/,\s*$/, '');
  if (trimmed === trimmed.toUpperCase() && /[А-ЯA-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .split(', ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(', ');
  }
  return trimmed;
}

const ACT_SCENE_CHARS_RE =
  /^Акт\s+(\d+)(?:,\s*(\d+)\s*часть)?,\s*сц\.\s*(\d+)\s*\((.+)\)$/i;

export function getSceneActGroup(scene: Scene): string {
  const match = scene.title.match(ACT_GROUP_RE);
  return match?.[0] ?? 'Сцены';
}

export function getSceneShortLabel(scene: Scene): string {
  const charsMatch = scene.title.match(ACT_SCENE_CHARS_RE);
  if (charsMatch) {
    return `сц. ${charsMatch[3]}`;
  }
  const match = scene.title.match(SCENE_TITLE_RE);
  if (match) {
    return `сц. ${match[1]} · ${formatLocation(match[2])}`;
  }
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
  const sorted = [...scenes].sort((a, b) => a.number - b.number);
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
