import type { AppState, Rehearsal, RehearsalActorNote } from '../types';
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
  const seenActor = new Set<string>();
  const seenRole = new Set<string>();

  for (const assignment of assignments) {
    const actor = state.actors.find((item) => item.id === assignment.actorId);
    const role = state.playRoles.find((item) => item.id === assignment.roleId);
    if (!actor || !role) continue;

    if (!seenRole.has(role.id)) {
      seenRole.add(role.id);
      options.push({
        id: `role:${role.id}`,
        label: role.name,
        hint: actor.name,
        insertText: formatMention(role.name, 'role', role.id),
        searchText: `${role.name} ${actor.name}`.toLowerCase(),
      });
    }

    if (!seenActor.has(actor.id)) {
      seenActor.add(actor.id);
      options.push({
        id: `actor:${actor.id}`,
        label: actor.name,
        hint: role.name,
        insertText: formatMention(actor.name, 'actor', actor.id),
        searchText: actor.name.toLowerCase(),
      });
    }
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
