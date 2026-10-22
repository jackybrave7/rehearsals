import type { Rehearsal, ScheduleBlock } from '../types';
import { formatDecidedNotesForDisplay } from './decidedNotesMentions';

export function formatDecidedNotesPlainText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => formatDecidedNotesForDisplay(line))
    .join('\n');
}

/** Собирает общий текст репетиции из полей «Решения и корректировки» блоков плана (по порядку времени). */
export function buildRehearsalSummaryFromDecidedNotes(schedule: ScheduleBlock[]): string {
  const sections: string[] = [];

  for (const block of schedule) {
    const notes = block.decidedNotes?.trim();
    if (!notes) continue;

    const header = `${block.startTime} · ${block.title}`;
    const body = formatDecidedNotesPlainText(notes);
    if (!body) continue;

    sections.push(`${header}\n${body}`);
  }

  return sections.join('\n\n');
}

export function countScheduleBlocksWithDecidedNotes(schedule: ScheduleBlock[]): number {
  return schedule.filter((block) => block.decidedNotes?.trim()).length;
}

export interface RehearsalExportNoteSection {
  title: string;
  body: string;
}

/** Только общий комментарий репетиции (без решений по блокам — они в «Telegram (решения)»). */
export function getRehearsalExportNoteSections(rehearsal: Rehearsal): RehearsalExportNoteSection[] {
  const manual = rehearsal.notes?.trim();
  if (!manual) return [];
  return [{ title: '📝 ЗАМЕТКИ', body: manual }];
}
