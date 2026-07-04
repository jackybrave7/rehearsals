import type { PlayRole } from '../types';
import {
  CHARACTER_CUE_LINE_RE,
  CHARACTER_DIALOGUE_INLINE_RE,
  expandScriptTextToLines,
} from './scriptTextLines';

export function parseScriptAliasesInput(value: string): string[] | undefined {
  const items = value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return undefined;
  return [...new Set(items)];
}

export function formatScriptAliasesInput(aliases?: string[]): string {
  return aliases?.join(', ') ?? '';
}

function normalizeCharacterToken(value: string): string {
  return value.replace(/[:.]$/, '').trim();
}

function roleNamePrimaryToken(roleName: string): string {
  return roleName.split(/[\s,–-]+/)[0]?.trim().toLowerCase() ?? '';
}

function characterTokenMatchesRoleName(roleName: string, token: string): boolean {
  const normalizedRoleName = normalizeCharacterToken(roleName).toLowerCase();
  if (!normalizedRoleName || !token) return false;

  if (normalizedRoleName === token) return true;

  const primaryToken = roleNamePrimaryToken(normalizedRoleName);
  if (primaryToken === token) return true;

  const firstWord = normalizedRoleName.split(',')[0]?.trim();
  if (firstWord === token) return true;

  return (
    normalizedRoleName.startsWith(`${token} `) ||
    normalizedRoleName.startsWith(`${token},`) ||
    normalizedRoleName.startsWith(`${token}-`)
  );
}

function roleCharacterTokens(role: PlayRole): string[] {
  return [role.name, ...(role.scriptAliases ?? [])];
}

export function characterTokenMatchesRole(role: PlayRole, characterName: string): boolean {
  const token = normalizeCharacterToken(characterName).toLowerCase();
  if (!token) return false;

  return roleCharacterTokens(role).some((candidate) => characterTokenMatchesRoleName(candidate, token));
}

/** Совпадает ли подпись в тексте (Петер:, Михель:) с именем роли строки. */
export function isCharacterLabelForRole(roleName: string | undefined, label: string): boolean {
  if (!roleName || !label) return false;
  return characterTokenMatchesRoleName(roleName, normalizeCharacterToken(label).toLowerCase());
}

export function findCharacterRoleId(
  playRoles: PlayRole[],
  playId: string,
  characterName: string
): string | undefined {
  const token = normalizeCharacterToken(characterName).toLowerCase();
  if (!token) return undefined;

  const roles = playRoles.filter((role) => role.playId === playId && role.kind === 'character');

  const byAlias = roles.find((role) => characterTokenMatchesRole(role, characterName));
  if (byAlias) return byAlias.id;

  return roles.find((role) => role.description?.toLowerCase().includes(token))?.id;
}

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
  const lines = expandScriptTextToLines(raw);

  for (const line of lines) {
    const inlineDialogue = line.match(CHARACTER_DIALOGUE_INLINE_RE);
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
