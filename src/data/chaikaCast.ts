export type ChaikaRoleSeed = {
  order: number;
  name: string;
  description: string;
};

export type ChaikaSceneSeed = {
  act: number;
  sceneInAct: number;
  title: string;
  characters: string[];
  description: string;
};

export const CHAIKA_PLAY_TITLE = 'Чайка';

export function findChaikaRoleId(
  playRoles: Array<{ id: string; playId: string; name: string; kind: string; description?: string }>,
  playId: string,
  characterName: string
): string | undefined {
  const token = characterName.trim().toLowerCase();
  if (!token || token === 'никого' || token === 'театр в театре') return undefined;

  const roles = playRoles.filter((role) => role.playId === playId && role.kind === 'character');
  const exact = roles.find((role) => role.name.trim().toLowerCase() === token);
  if (exact) return exact.id;

  return roles.find((role) => role.description?.toLowerCase().includes(token))?.id;
}

export function buildSceneRoleIds(
  playRoles: Array<{ id: string; playId: string; name: string; kind: string; description?: string }>,
  playId: string,
  characters: string[]
): string[] {
  return [
    ...new Set(
      characters
        .map((name) => findChaikaRoleId(playRoles, playId, name))
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

export function parseCharactersFromSceneTitle(title: string): string[] {
  const match = title.match(/\(([^)]+)\)\s*$/);
  if (!match) return [];
  const raw = match[1].trim();
  if (!raw || raw.toLowerCase() === 'никого') return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.toLowerCase() !== 'театр в театре');
}

export function resolveSceneCharacters(
  scene: { title: string; roleIds?: string[] },
  sceneSeed?: ChaikaSceneSeed
): string[] {
  if (sceneSeed?.characters?.length) return sceneSeed.characters;
  return parseCharactersFromSceneTitle(scene.title);
}
