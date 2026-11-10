import { parseISO } from 'date-fns';
import type { AttendanceStatus, Rehearsal } from '../types';

export function getRehearsalStartDate(rehearsal: Rehearsal): Date {
  const [hours, minutes] = rehearsal.startTime.split(':').map(Number);
  const date = parseISO(rehearsal.date);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}

/** Фактическое присутствие можно отмечать только после начала репетиции. */
export function canMarkRehearsalAttendance(rehearsal: Rehearsal, now = new Date()): boolean {
  return now >= getRehearsalStartDate(rehearsal);
}

export function resolveAttendanceValue(
  rehearsal: Rehearsal,
  actorId: string,
  isParticipant: boolean
): AttendanceStatus | '' {
  const stored = rehearsal.attendance?.[actorId];
  if (stored) return stored;
  if (!canMarkRehearsalAttendance(rehearsal)) return '';
  return isParticipant ? 'present' : 'absent';
}
