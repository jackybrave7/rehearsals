import type { PlayRole } from '../types';
import { findCharacterRoleId } from './sceneRoleAssignment';
import {
  CHARACTER_CUE_LINE_RE,
  CHARACTER_DIALOGUE_INLINE_RE,
  expandScriptTextToLines,
} from './scriptTextLines';

export type SceneLearnLineKind = 'direction' | 'cue' | 'dialogue' | 'text';

export interface SceneLearnLine {
  id: string;
  kind: SceneLearnLineKind;
  text: string;
  roleId?: string;
  roleName?: string;
  /** Реплика актёра — скрывается при заучивании */
  isActorLine: boolean;
}

function normalizeCharacterToken(value: string): string {
  return value.replace(/[:.]$/, '').trim();
}

/** Продолжение реплики на следующей строке — только если речь обрывается. */
function speechInvitesContinuation(speech: string): boolean {
  const trimmed = speech.trim();
  if (!trimmed) return true;
  if (/(\.\.\.|—|,|:)\s*$/.test(trimmed)) return true;
  return !/[.!?]\s*$/.test(trimmed);
}

/** Делить строку на реплику и встроенные (ремарки) только после завершённого предложения. */
function shouldSplitInlineDirections(trimmed: string): boolean {
  if (CHARACTER_DIALOGUE_INLINE_RE.test(trimmed)) return true;
  const firstParen = trimmed.indexOf('(');
  if (firstParen <= 0) return false;
  const before = trimmed.slice(0, firstParen).trim();
  if (!before) return false;
  return /[.!?]\s*$/.test(before);
}

function isKnownCharacterLine(
  trimmed: string,
  playRoles: PlayRole[],
  playId: string
): boolean {
  const inline = trimmed.match(CHARACTER_DIALOGUE_INLINE_RE);
  if (inline) {
    return Boolean(findCharacterRoleId(playRoles, playId, normalizeCharacterToken(inline[1])));
  }
  if (CHARACTER_CUE_LINE_RE.test(trimmed)) {
    return Boolean(findCharacterRoleId(playRoles, playId, normalizeCharacterToken(trimmed)));
  }
  return false;
}

function isLikelyStageDirection(trimmed: string): boolean {
  if (CHARACTER_DIALOGUE_INLINE_RE.test(trimmed)) return false;
  if (CHARACTER_CUE_LINE_RE.test(trimmed)) return false;
  if (/^\([\s\S]+\)$/.test(trimmed)) return true;
  return trimmed.includes('(');
}

/** Ремарка в скобках внутри строки — из курсива docx и т.п. */
const INLINE_DIRECTION_RE = /\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;

function expandLineWithInlineDirections(line: string): Array<{ text: string; isDirection: boolean }> {
  const parts: Array<{ text: string; isDirection: boolean }> = [];
  let lastIndex = 0;

  for (const match of line.matchAll(INLINE_DIRECTION_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const before = line.slice(lastIndex, index).trim();
      if (before) parts.push({ text: before, isDirection: false });
    }
    parts.push({ text: `(${match[1]})`, isDirection: true });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < line.length) {
    const tail = line.slice(lastIndex).trim();
    if (tail) parts.push({ text: tail, isDirection: false });
  }

  if (parts.length === 0) {
    return [{ text: line, isDirection: false }];
  }

  return parts;
}

function pushLearnLine(
  result: SceneLearnLine[],
  lineId: string,
  text: string,
  kind: SceneLearnLineKind,
  actorRoleIds: Set<string>,
  roleId?: string,
  roleName?: string
): void {
  result.push({
    id: lineId,
    kind,
    text,
    roleId,
    roleName,
    isActorLine: Boolean(
      (kind === 'dialogue' || kind === 'cue') && roleId && actorRoleIds.has(roleId)
    ),
  });
}

function parseSingleLine(
  trimmed: string,
  lineId: string,
  result: SceneLearnLine[],
  playRoles: PlayRole[],
  playId: string,
  actorRoleIds: Set<string>,
  pendingCue: { roleId?: string; roleName?: string } | null,
  pendingDirection: boolean
): {
  pendingCue: { roleId?: string; roleName?: string } | null;
  pendingDirection: boolean;
} {
  const standaloneDirection = trimmed.match(/^\(([\s\S]+)\)$/);
  if (standaloneDirection) {
    pushLearnLine(result, lineId, trimmed, 'direction', actorRoleIds);
    return { pendingCue: null, pendingDirection: true };
  }

  const inlineDialogue = trimmed.match(CHARACTER_DIALOGUE_INLINE_RE);
  if (inlineDialogue) {
    const roleName = normalizeCharacterToken(inlineDialogue[1]);
    const roleId = findCharacterRoleId(playRoles, playId, roleName);
    if (roleId) {
      const speech = inlineDialogue[2] ?? '';
      pushLearnLine(result, lineId, trimmed, 'dialogue', actorRoleIds, roleId, roleName);
      return {
        pendingCue: speechInvitesContinuation(speech) ? { roleId, roleName } : null,
        pendingDirection: false,
      };
    }
  }

  if (CHARACTER_CUE_LINE_RE.test(trimmed)) {
    const roleName = normalizeCharacterToken(trimmed);
    const roleId = findCharacterRoleId(playRoles, playId, roleName);
    if (roleId) {
      pushLearnLine(result, lineId, trimmed, 'cue', actorRoleIds, roleId, roleName);
      return { pendingCue: { roleId, roleName }, pendingDirection: false };
    }
  }

  if (pendingCue?.roleId) {
    pushLearnLine(
      result,
      lineId,
      trimmed,
      'dialogue',
      actorRoleIds,
      pendingCue.roleId,
      pendingCue.roleName
    );
    return { pendingCue, pendingDirection: false };
  }

  if (pendingDirection && !isKnownCharacterLine(trimmed, playRoles, playId)) {
    pushLearnLine(result, lineId, trimmed, 'direction', actorRoleIds);
    return { pendingCue: null, pendingDirection: true };
  }

  const hasInlineDirection =
    trimmed.includes('(') &&
    !CHARACTER_DIALOGUE_INLINE_RE.test(trimmed) &&
    shouldSplitInlineDirections(trimmed);
  if (hasInlineDirection) {
    const segments = expandLineWithInlineDirections(trimmed);
    if (segments.length > 1 || segments[0]?.isDirection) {
      let nextPendingCue = pendingCue;
      let nextPendingDirection = false;
      segments.forEach((segment, segmentIndex) => {
        if (!segment.text.trim()) return;
        const segmentId = `${lineId}-${segmentIndex}`;
        if (segment.isDirection) {
          pushLearnLine(
            result,
            segmentId,
            segment.text,
            'direction',
            actorRoleIds
          );
          nextPendingDirection = true;
          return;
        }

        const parsed = parseSingleLine(
          segment.text,
          segmentId,
          result,
          playRoles,
          playId,
          actorRoleIds,
          null,
          false
        );
        nextPendingCue = parsed.pendingCue;
        nextPendingDirection = parsed.pendingDirection;
      });
      return { pendingCue: nextPendingCue, pendingDirection: nextPendingDirection };
    }
  }

  if (isLikelyStageDirection(trimmed)) {
    pushLearnLine(result, lineId, trimmed, 'direction', actorRoleIds);
    return { pendingCue: null, pendingDirection: true };
  }

  pushLearnLine(result, lineId, trimmed, 'direction', actorRoleIds);
  return { pendingCue: null, pendingDirection: true };
}

export function parseSceneLearnLines(
  raw: string,
  playRoles: PlayRole[],
  playId: string,
  actorRoleIds: Set<string>
): SceneLearnLine[] {
  const lines = expandScriptTextToLines(raw);
  const result: SceneLearnLine[] = [];
  let pendingCue: { roleId?: string; roleName?: string } | null = null;
  let pendingDirection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed) continue;

    const parsed = parseSingleLine(
      trimmed,
      `line-${index}`,
      result,
      playRoles,
      playId,
      actorRoleIds,
      pendingCue,
      pendingDirection
    );
    pendingCue = parsed.pendingCue;
    pendingDirection = parsed.pendingDirection;
  }

  return result;
}
