import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AppState, RehearsalActorNote, Scene } from '../types';
import { getSceneShortLabel } from './sceneLabels';

export function getNotesForRehearsal(
  notes: RehearsalActorNote[] | undefined,
  rehearsalId: string
): RehearsalActorNote[] {
  return (notes ?? [])
    .filter((note) => note.rehearsalId === rehearsalId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getNotesForActor(
  notes: RehearsalActorNote[] | undefined,
  actorId: string
): RehearsalActorNote[] {
  return (notes ?? [])
    .filter((note) => note.actorId === actorId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function formatNoteLabel(
  note: RehearsalActorNote,
  scenes: Scene[],
  rehearsalDate?: string
): string {
  const scene = note.sceneId ? scenes.find((item) => item.id === note.sceneId) : undefined;
  const sceneLabel = scene ? getSceneShortLabel(scene) : null;
  const dateLabel = rehearsalDate
    ? format(parseISO(rehearsalDate), 'd MMM yyyy', { locale: ru })
    : format(parseISO(note.createdAt), 'd MMM yyyy', { locale: ru });
  if (sceneLabel) return `${dateLabel} · ${sceneLabel}`;
  return dateLabel;
}

export function groupNotesByScene(
  notes: RehearsalActorNote[]
): Map<string | null, RehearsalActorNote[]> {
  const groups = new Map<string | null, RehearsalActorNote[]>();
  for (const note of notes) {
    const key = note.sceneId ?? null;
    const list = groups.get(key) ?? [];
    list.push(note);
    groups.set(key, list);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return groups;
}

export function groupNotesByActor(
  notes: RehearsalActorNote[],
  actorIds: string[]
): Map<string, RehearsalActorNote[]> {
  const groups = new Map<string, RehearsalActorNote[]>();
  for (const actorId of actorIds) {
    groups.set(actorId, []);
  }
  for (const note of notes) {
    const list = groups.get(note.actorId) ?? [];
    list.push(note);
    groups.set(note.actorId, list);
  }
  for (const [, list] of groups) {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return groups;
}

export function formatNotesTelegramHtml(
  state: AppState,
  notes: RehearsalActorNote[],
  actorId: string
): string {
  const actorNotes = getNotesForActor(notes, actorId).slice(0, 10);
  if (actorNotes.length === 0) {
    return 'Личных замечаний пока нет.';
  }

  const lines = actorNotes.map((note) => {
    const rehearsal = state.rehearsals.find((item) => item.id === note.rehearsalId);
    const label = formatNoteLabel(note, state.scenes, rehearsal?.date);
    const ack = note.acknowledgedAt ? ' ✓' : '';
    return `• <b>${label}</b>${ack}\n${escapeHtml(note.text)}`;
  });

  return `<b>Мои замечания</b>\n\n${lines.join('\n\n')}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
