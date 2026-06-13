import { appPaths } from '../navigation/appPaths';
import type { Rehearsal } from '../types';

export function getRehearsalPlanUrl(rehearsalId: string): string {
  const path = appPaths.rehearsal(rehearsalId);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function getRehearsalEventTitle(playTitle?: string): string {
  return playTitle ? `Репетиция «${playTitle}»` : 'Репетиция';
}

function toCalendarStamp(date: string, time: string): string {
  const [y, m, d] = date.split('-');
  const [hh, mm] = time.split(':');
  return `${y}${m}${d}T${hh}${mm ?? '00'}00`;
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildGoogleCalendarUrl(options: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
}): string {
  const start = toCalendarStamp(options.date, options.startTime);
  const end = toCalendarStamp(options.date, options.endTime);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: options.title,
    dates: `${start}/${end}`,
  });
  if (options.location) params.set('location', options.location);
  if (options.description) params.set('details', options.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildRehearsalCalendarEvent(
  rehearsal: Rehearsal,
  title: string,
  location: string | undefined,
  planUrl: string
) {
  const description = [`План репетиции: ${planUrl}`, rehearsal.notes?.trim()].filter(Boolean).join('\n\n');
  return {
    title,
    date: rehearsal.date,
    startTime: rehearsal.startTime,
    endTime: rehearsal.endTime,
    location,
    description,
    googleUrl: buildGoogleCalendarUrl({
      title,
      date: rehearsal.date,
      startTime: rehearsal.startTime,
      endTime: rehearsal.endTime,
      location,
      description,
    }),
  };
}

export function buildRehearsalIcs(
  rehearsal: Rehearsal,
  title: string,
  location: string | undefined,
  planUrl: string
): string {
  const start = toCalendarStamp(rehearsal.date, rehearsal.startTime);
  const end = toCalendarStamp(rehearsal.date, rehearsal.endTime);
  const description = [`План: ${planUrl}`, rehearsal.notes?.trim()].filter(Boolean).join('\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rehearsals//RU',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:rehearsal-${rehearsal.id}@rehearsals`,
    `DTSTAMP:${toCalendarStamp(rehearsal.date, rehearsal.startTime)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
  ];
  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadRehearsalIcs(rehearsal: Rehearsal, title: string, location: string | undefined): void {
  const planUrl = getRehearsalPlanUrl(rehearsal.id);
  const ics = buildRehearsalIcs(rehearsal, title, location, planUrl);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `rehearsal-${rehearsal.date}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function openGoogleCalendar(rehearsal: Rehearsal, title: string, location: string | undefined): void {
  const planUrl = getRehearsalPlanUrl(rehearsal.id);
  const event = buildRehearsalCalendarEvent(rehearsal, title, location, planUrl);
  window.open(event.googleUrl, '_blank', 'noopener,noreferrer');
}
