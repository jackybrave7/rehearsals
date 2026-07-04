import type { Rehearsal, RsvpStatus } from '../types';

export const rsvpLabels: Record<RsvpStatus, string> = {
  confirmed: 'Приду',
  declined: 'Не смогу',
  late: 'Опоздаю',
};

export const rsvpShortLabels: Record<RsvpStatus, string> = {
  confirmed: '✅',
  declined: '❌',
  late: '⏰',
};

export const rsvpColors: Record<RsvpStatus, string> = {
  confirmed: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25',
  declined: 'text-rose-300 bg-rose-500/15 border-rose-500/25',
  late: 'text-amber-300 bg-amber-500/15 border-amber-500/25',
};

export interface RsvpSummary {
  total: number;
  confirmed: number;
  declined: number;
  late: number;
  pending: number;
}

export function countRsvpSummary(rehearsal: Rehearsal, participantIds: string[]): RsvpSummary {
  const rsvp = rehearsal.rsvp ?? {};
  let confirmed = 0;
  let declined = 0;
  let late = 0;
  for (const actorId of participantIds) {
    const status = rsvp[actorId];
    if (status === 'confirmed') confirmed += 1;
    else if (status === 'declined') declined += 1;
    else if (status === 'late') late += 1;
  }
  const total = participantIds.length;
  return {
    total,
    confirmed,
    declined,
    late,
    pending: total - confirmed - declined - late,
  };
}

export function formatRsvpSummaryLine(summary: RsvpSummary): string {
  if (summary.total === 0) return 'Нет участников';
  if (summary.confirmed === summary.total) {
    return `Все ${summary.total} подтвердили`;
  }
  if (summary.confirmed > 0) {
    return `${summary.confirmed} из ${summary.total} подтвердили`;
  }
  if (summary.pending === summary.total) return 'Ожидаем ответы';
  const parts: string[] = [];
  if (summary.confirmed > 0) parts.push(`${summary.confirmed} придут`);
  if (summary.late > 0) parts.push(`${summary.late} опоздают`);
  if (summary.declined > 0) parts.push(`${summary.declined} не смогут`);
  if (summary.pending > 0) parts.push(`${summary.pending} без ответа`);
  return parts.join(', ');
}

export function buildRsvpTelegramKeyboard(rehearsalId: string) {
  return [
    [
      { text: '✅ Приду', callback_data: `rsvp:${rehearsalId}:confirmed` },
      { text: '❌ Не смогу', callback_data: `rsvp:${rehearsalId}:declined` },
      { text: '⏰ Опоздаю', callback_data: `rsvp:${rehearsalId}:late` },
    ],
  ];
}
