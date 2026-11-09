import type { PlayRole } from '../types';
import {
  CHARACTER_CUE_LINE_RE,
  CHARACTER_CUE_NAME_CAPTURE_RE,
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

/** Номер в конце: «мужчина 1» → «1». */
function trailingCharacterNumber(value: string): string | null {
  const match = value.trim().match(/\s+(\d+)$/);
  return match?.[1] ?? null;
}

/**
 * Варианты имени из «Елена (Лена)» / «Официант (Нина)»:
 * полное, без скобок, и содержимое скобок.
 */
export function expandRoleNameForms(roleName: string): string[] {
  const trimmed = roleName.trim();
  if (!trimmed) return [];

  const forms = [trimmed];
  const paren = trimmed.match(/\(([^)]+)\)/);
  if (!paren) return forms;

  const withoutParen = trimmed.replace(/\s*\([^)]+\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutParen) forms.push(withoutParen);

  for (const alt of paren[1].split(/[,;/]/)) {
    const part = alt.trim();
    if (part) forms.push(part);
  }

  return [...new Set(forms)];
}

function characterTokenMatchesRoleName(roleName: string, token: string): boolean {
  const normalizedRoleName = normalizeCharacterToken(roleName).toLowerCase();
  if (!normalizedRoleName || !token) return false;

  if (normalizedRoleName === token) return true;

  const roleNum = trailingCharacterNumber(normalizedRoleName);
  const tokenNum = trailingCharacterNumber(token);
  // «Мужчина 1» и «Мужчина 2» — разные роли; без номера к ним не матчим.
  if (roleNum !== null || tokenNum !== null) {
    return false;
  }

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
  const fromName = expandRoleNameForms(role.name);
  const fromAliases = (role.scriptAliases ?? []).flatMap((alias) => expandRoleNameForms(alias));
  return [...new Set([...fromName, ...fromAliases])];
}

export function characterTokenMatchesRole(role: PlayRole, characterName: string): boolean {
  const token = normalizeCharacterToken(characterName).toLowerCase();
  if (!token) return false;

  return roleCharacterTokens(role).some((candidate) => characterTokenMatchesRoleName(candidate, token));
}

/** Совпадает ли подпись в тексте (Петер:, Михель:) с именем роли строки. */
export function isCharacterLabelForRole(roleName: string | undefined, label: string): boolean {
  if (!roleName || !label) return false;
  return expandRoleNameForms(roleName).some((form) =>
    characterTokenMatchesRoleName(form, normalizeCharacterToken(label).toLowerCase())
  );
}

export function findCharacterRoleId(
  playRoles: PlayRole[],
  playId: string,
  characterName: string
): string | undefined {
  const token = normalizeCharacterToken(characterName).toLowerCase();
  if (!token) return undefined;

  const roles = playRoles.filter((role) => role.playId === playId && role.kind === 'character');

  // Только имя / алиасы / формы в скобках — без description.includes (ложные «жених» → Игорь).
  return roles.find((role) => characterTokenMatchesRole(role, characterName))?.id;
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

/** Следующий заголовок сцены в «протекающем» тексте тела — не брать реплики чужой сцены. */
function isSceneBoundaryLine(line: string): boolean {
  const trimmed = line.trim().replace(/^#{1,6}\s+/, '');
  return /^сцена\s+\d+/i.test(trimmed);
}

function addCharacterName(names: Set<string>, raw: string): void {
  const normalized = normalizeCharacterToken(raw);
  if (!normalized || isExcludedCharacterCue(normalized)) return;
  names.add(normalized);
}

/** Персонажи из строки «Сцена 31. Бланш, Митч, Мексиканка.» */
export function extractCharacterNamesFromSceneTitle(title: string): string[] {
  const trimmed = title.trim();
  if (!trimmed) return [];

  const withoutHeading = trimmed.replace(/^сцена\s+\d+\s*\.?\s*/i, '').trim();
  if (!withoutHeading) return [];

  const names: string[] = [];
  for (const chunk of withoutHeading.split(/[,;]/)) {
    const primary = chunk.split('/')[0]?.trim() ?? '';
    if (!primary) continue;
    const normalized = normalizeCharacterToken(primary.replace(/\.+$/, ''));
    if (!normalized || isExcludedCharacterCue(normalized)) continue;
    names.push(normalized);
  }
  return [...new Set(names)];
}

/** Имена персонажей по репликам в тексте сцены (не из заголовка). */
export function extractCharacterNamesFromScriptText(raw: string): string[] {
  const names = new Set<string>();
  const lines = expandScriptTextToLines(raw);

  for (const line of lines) {
    if (isSceneBoundaryLine(line)) break;

    const inlineDialogue = line.match(CHARACTER_DIALOGUE_INLINE_RE);
    if (inlineDialogue) {
      addCharacterName(names, inlineDialogue[1]);
      continue;
    }

    if (CHARACTER_CUE_LINE_RE.test(line)) {
      const cueMatch = line.match(CHARACTER_CUE_NAME_CAPTURE_RE);
      addCharacterName(names, cueMatch?.[1] ?? line);
    }
  }

  return [...names];
}

function roleIdsFromCharacterNames(
  names: string[],
  playRoles: PlayRole[],
  playId: string
): string[] {
  return [
    ...new Set(
      names
        .map((name) => findCharacterRoleId(playRoles, playId, name))
        .filter((id): id is string => Boolean(id))
    ),
  ];
}

export function buildSceneRoleIdsFromScriptText(
  text: string,
  playRoles: PlayRole[],
  playId: string,
  sceneTitle?: string
): string[] {
  const names = [
    ...extractCharacterNamesFromScriptText(text),
    ...extractCharacterNamesFromSceneTitle(sceneTitle ?? ''),
  ];
  return roleIdsFromCharacterNames(names, playRoles, playId);
}

export function buildSceneRoleIdsFromTexts(
  texts: Map<string, string>,
  playRoles: PlayRole[],
  playId: string,
  scenes?: Array<{ id: string; title?: string }>
): Map<string, string[]> {
  const titleById =
    scenes === undefined
      ? null
      : new Map(scenes.map((scene) => [scene.id, scene.title ?? ''] as const));

  const result = new Map<string, string[]>();
  for (const [sceneId, text] of texts.entries()) {
    const roleIds = buildSceneRoleIdsFromScriptText(
      text,
      playRoles,
      playId,
      titleById?.get(sceneId)
    );
    if (roleIds.length > 0) result.set(sceneId, roleIds);
  }
  return result;
}
