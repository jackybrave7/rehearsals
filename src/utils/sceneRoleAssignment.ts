import type { PlayRole } from '../types';

const CHARACTER_DIALOGUE_RE =
  /^([А-ЯA-ZЁ][а-яёА-ЯЁA-Z\s.'\-]{0,48})\.\s+\S/;
const CHARACTER_CUE_LINE_RE = /^[А-ЯA-ZЁ][А-ЯA-ZЁ\s.'\-]{0,48}\.?$/;

const EXCLUDED_CUES = new Set([
  'сцена',
  'акт',
  'действие',
  'конец',
  'занавес',
  'антракт',
  'явление',
  'уходят',
  'входят',
  'пауза',
]);

function normalizeCharacterToken(value: string): string {
  return value.replace(/\.$/, '').trim();
}

function isExcludedCharacterCue(name: string): boolean {
  const norm = normalizeCharacterToken(name).toLowerCase();
  if (!norm || norm.length < 2) return true;
  if (EXCLUDED_CUES.has(norm)) return true;
  return /^сцена\s+\d+/i.test(norm) || /^акт\s+\d+/i.test(norm);
}

function addCharacterName(names: Set<string>, raw: string): void {
  const normalized = normalizeCharacterToken(raw);
  if (!normalized || isExcludedCharacterCue(normalized)) return;
  names.add(normalized);
}

/** Имена персонажей по репликам в тексте сцены (не из заголовка). */
export function extractCharacterNamesFromScriptText(raw: string): string[] {
  const names = new Set<string>();
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const inlineDialogue = line.match(CHARACTER_DIALOGUE_RE);
    if (inlineDialogue) {
      addCharacterName(names, inlineDialogue[1]);
      continue;
    }

    if (CHARACTER_CUE_LINE_RE.test(line)) {
      addCharacterName(names, line);
    }
  }

  return [...names];
}

export function findCharacterRoleId(
  playRoles: PlayRole[],
  playId: string,
  characterName: string
): string | undefined {
  const token = normalizeCharacterToken(characterName).toLowerCase();
  if (!token) return undefined;

  const roles = playRoles.filter((role) => role.playId === playId && role.kind === 'character');

  const exact = roles.find((role) => role.name.trim().toLowerCase() === token);
  if (exact) return exact.id;

  const byFirstWord = roles.find((role) => {
    const firstWord = role.name.split(',')[0]?.trim().toLowerCase();
    return firstWord === token;
  });
  if (byFirstWord) return byFirstWord.id;

  const byPrefix = roles.find((role) => {
    const name = role.name.trim().toLowerCase();
    return name.startsWith(`${token} `) || name.startsWith(`${token},`);
  });
  if (byPrefix) return byPrefix.id;

  return roles.find((role) => role.description?.toLowerCase().includes(token))?.id;
}

export function buildSceneRoleIdsFromScriptText(
  text: string,
  playRoles: PlayRole[],
  playId: string
): string[] {
  const names = extractCharacterNamesFromScriptText(text);
  return [
    ...new Set(
      names
        .map((name) => findCharacterRoleId(playRoles, playId, name))
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

export function buildSceneRoleIdsFromTexts(
  texts: Map<string, string>,
  playRoles: PlayRole[],
  playId: string
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [sceneId, text] of texts.entries()) {
    const roleIds = buildSceneRoleIdsFromScriptText(text, playRoles, playId);
    if (roleIds.length > 0) result.set(sceneId, roleIds);
  }
  return result;
}
