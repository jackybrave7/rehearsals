import type { Actor, AppState, Rehearsal, RehearsalActorNote } from '../types';
import { generateId } from './id';
import { resolveRehearsalPerformanceId } from './rehearsalActors';

export type MentionTargetType = 'actor' | 'role';

const MENTION_PATTERN = /@\[([^\]]+)\]\((actor|role):([^)]+)\)/g;

export type DisplaySegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; label: string };

export function parseDisplaySegments(text: string): DisplaySegment[] {
  const segments: DisplaySegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, index) });
    }
    segments.push({ type: 'mention', label: match[1] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

export function parseEditorSegments(text: string): Array<
  { type: 'text'; text: string } | { type: 'mention'; label: string; token: string }
> {
  const segments: Array<
    { type: 'text'; text: string } | { type: 'mention'; label: string; token: string }
  > = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, index) });
    }
    segments.push({ type: 'mention', label: match[1], token: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

export function formatMention(label: string, type: MentionTargetType, id: string): string {
  return `@[${label}](${type}:${id})`;
}

export function formatDecidedNotesForDisplay(text: string): string {
  return text.replace(MENTION_PATTERN, '@$1');
}

function resolveMentionPlayId(
  state: AppState,
  rehearsal: Rehearsal,
  sceneId?: string
): string | undefined {
  const scene = sceneId ? state.scenes.find((item) => item.id === sceneId) : undefined;
  return rehearsal.playId ?? scene?.playId;
}

function findCastAssignmentForRole(
  state: AppState,
  rehearsal: Rehearsal,
  roleId: string,
  sceneId?: string
) {
  const playId = resolveMentionPlayId(state, rehearsal, sceneId);
  if (!playId) return undefined;

  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  return state.castAssignments.find(
    (item) =>
      item.roleId === roleId &&
      item.playId === playId &&
      (!performanceId || item.performanceId === performanceId)
  );
}

function findPrimaryRoleNameForActor(
  state: AppState,
  rehearsal: Rehearsal,
  actorId: string,
  sceneId?: string
): string | undefined {
  const playId = resolveMentionPlayId(state, rehearsal, sceneId);
  if (!playId) return undefined;

  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  const assignment = state.castAssignments.find(
    (item) =>
      item.actorId === actorId &&
      item.playId === playId &&
      (!performanceId || item.performanceId === performanceId)
  );
  return assignment ? state.playRoles.find((role) => role.id === assignment.roleId)?.name : undefined;
}

function formatActorTelegramPlain(actor: Actor): string {
  const username = actor.telegramUsername?.replace(/^@+/, '').trim();
  return username ? `${actor.name} @${username}` : actor.name;
}

function formatActorTelegramHtml(actor: Actor): string {
  const username = actor.telegramUsername?.replace(/^@+/, '').trim();
  if (!username) return escapeTelegramHtml(actor.name);
  return `${escapeTelegramHtml(actor.name)} <a href="https://t.me/${escapeTelegramHtml(username)}">@${escapeTelegramHtml(username)}</a>`;
}

function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveActorForMention(
  state: AppState,
  rehearsal: Rehearsal,
  type: MentionTargetType,
  id: string,
  sceneId?: string
): Actor | undefined {
  if (type === 'actor') {
    return state.actors.find((item) => item.id === id);
  }
  const assignment = findCastAssignmentForRole(state, rehearsal, id, sceneId);
  return assignment
    ? state.actors.find((item) => item.id === assignment.actorId)
    : undefined;
}

function characterLabelForMention(
  state: AppState,
  rehearsal: Rehearsal,
  type: MentionTargetType,
  id: string,
  label: string,
  sceneId?: string
): string {
  if (type === 'role') return label;
  return findPrimaryRoleNameForActor(state, rehearsal, id, sceneId) ?? label;
}

function formatMentionTokenForDecisions(
  state: AppState,
  rehearsal: Rehearsal,
  type: MentionTargetType,
  id: string,
  label: string,
  sceneId?: string,
  html = false
): string {
  const characterLabel = characterLabelForMention(state, rehearsal, type, id, label, sceneId);
  const actor = resolveActorForMention(state, rehearsal, type, id, sceneId);
  if (!actor) {
    return html ? escapeTelegramHtml(characterLabel) : characterLabel;
  }

  const actorPart = html ? formatActorTelegramHtml(actor) : formatActorTelegramPlain(actor);
  if (html) {
    return `<b>${escapeTelegramHtml(characterLabel)}</b> — ${actorPart}`;
  }
  return `${characterLabel} — ${actorPart}`;
}

/** Одна строка «Решения и корректировки» для Telegram: персонаж — актёр @username и текст. */
export function formatDecidedNotesLineForDecisionsExport(
  state: AppState,
  rehearsal: Rehearsal,
  line: string,
  sceneId?: string,
  html = false
): string {
  let output = '';
  let lastIndex = 0;

  for (const match of line.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      const chunk = line.slice(lastIndex, index);
      output += html ? escapeTelegramHtml(chunk) : chunk;
    }

    const type = match[2] as MentionTargetType;
    const id = match[3];
    const label = match[1];
    output += formatMentionTokenForDecisions(state, rehearsal, type, id, label, sceneId, html);
    lastIndex = index + match[0].length;
  }

  if (lastIndex < line.length) {
    const tail = line.slice(lastIndex);
    output += html ? escapeTelegramHtml(tail) : tail;
  }

  return output.trim();
}

function noteSyncKey(scheduleBlockId: string, actorId: string, text: string): string {
  return `${scheduleBlockId}|${actorId}|${text}`;
}

export interface MentionOption {
  id: string;
  label: string;
  hint?: string;
  insertText: string;
  searchText: string;
}

export function buildMentionOptions(
  state: AppState,
  rehearsal: Rehearsal,
  sceneId?: string
): MentionOption[] {
  const scene = sceneId ? state.scenes.find((item) => item.id === sceneId) : undefined;
  const playId = rehearsal.playId ?? scene?.playId;
  if (!playId) return [];

  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  const assignments = state.castAssignments.filter(
    (assignment) =>
      assignment.playId === playId &&
      (!performanceId || assignment.performanceId === performanceId)
  );

  const options: MentionOption[] = [];

  for (const assignment of assignments) {
    const actor = state.actors.find((item) => item.id === assignment.actorId);
    const role = state.playRoles.find((item) => item.id === assignment.roleId);
    if (!actor || !role) continue;

    options.push({
      id: `role:${assignment.id}`,
      label: role.name,
      hint: actor.name,
      insertText: formatMention(role.name, 'role', role.id),
      searchText: `${role.name} ${actor.name}`.toLowerCase(),
    });

    options.push({
      id: `actor:${assignment.id}`,
      label: actor.name,
      hint: role.name,
      insertText: formatMention(actor.name, 'actor', actor.id),
      searchText: `${actor.name} ${role.name}`.toLowerCase(),
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

function resolveMentionToActorIds(
  type: MentionTargetType,
  id: string,
  state: AppState,
  rehearsal: Rehearsal,
  sceneId: string
): string[] {
  if (type === 'actor') {
    return state.actors.some((actor) => actor.id === id) ? [id] : [];
  }

  const scene = state.scenes.find((item) => item.id === sceneId);
  const playId = rehearsal.playId ?? scene?.playId;
  if (!playId) return [];

  const performanceId = resolveRehearsalPerformanceId(state, rehearsal);
  const assignment = state.castAssignments.find(
    (item) =>
      item.roleId === id &&
      item.playId === playId &&
      (!performanceId || item.performanceId === performanceId)
  );
  return assignment ? [assignment.actorId] : [];
}

export interface ParsedMentionLine {
  actorId: string;
  text: string;
}

export function parseDecidedNotesMentions(
  decidedNotes: string,
  state: AppState,
  rehearsal: Rehearsal,
  sceneId: string
): ParsedMentionLine[] {
  const result: ParsedMentionLine[] = [];
  const lines = decidedNotes.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const actorIds = new Set<string>();
    for (const match of line.matchAll(MENTION_PATTERN)) {
      const type = match[2] as MentionTargetType;
      const id = match[3];
      for (const actorId of resolveMentionToActorIds(type, id, state, rehearsal, sceneId)) {
        actorIds.add(actorId);
      }
    }

    if (actorIds.size === 0) continue;

    const text = formatDecidedNotesForDisplay(line);
    for (const actorId of actorIds) {
      result.push({ actorId, text });
    }
  }

  return result;
}

export function syncDecidedNotesToActorNotes(state: AppState): AppState {
  const notes = state.rehearsalActorNotes ?? [];
  const legacyNotes = notes.filter((note) => !note.scheduleBlockId);
  const sentBlockNotes = notes.filter((note) => note.scheduleBlockId && note.sentAt);

  const unsentByKey = new Map<string, RehearsalActorNote>();
  for (const note of notes) {
    if (!note.scheduleBlockId || note.sentAt) continue;
    unsentByKey.set(noteSyncKey(note.scheduleBlockId, note.actorId, note.text), note);
  }

  const desiredUnsent: RehearsalActorNote[] = [];

  for (const rehearsal of state.rehearsals) {
    if (!rehearsal.theaterId) continue;

    for (const block of rehearsal.schedule) {
      if (block.type !== 'scene' || !block.sceneId) continue;

      const parsed = parseDecidedNotesMentions(
        block.decidedNotes ?? '',
        state,
        rehearsal,
        block.sceneId
      );

      for (const item of parsed) {
        const key = noteSyncKey(block.id, item.actorId, item.text);
        const existing = unsentByKey.get(key);
        desiredUnsent.push({
          id: existing?.id ?? generateId(),
          theaterId: rehearsal.theaterId,
          rehearsalId: rehearsal.id,
          actorId: item.actorId,
          sceneId: block.sceneId,
          scheduleBlockId: block.id,
          text: item.text,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          sentAt: undefined,
          acknowledgedAt: undefined,
        });
      }
    }
  }

  return {
    ...state,
    rehearsalActorNotes: [...legacyNotes, ...sentBlockNotes, ...desiredUnsent],
  };
}
