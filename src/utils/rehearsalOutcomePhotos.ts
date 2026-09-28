import { parseISO, startOfDay } from 'date-fns';
import type { Rehearsal } from '../types';

function getRehearsalEndDate(rehearsal: Rehearsal): Date {
  const [year, month, day] = rehearsal.date.split('-').map(Number);
  const [hours, minutes] = rehearsal.endTime.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

/** Репетиция уже завершилась (день в прошлом или сегодня после endTime). */
export function isRehearsalEnded(rehearsal: Rehearsal, now = new Date()): boolean {
  const rehearsalDay = startOfDay(parseISO(rehearsal.date));
  const today = startOfDay(now);
  if (rehearsalDay.getTime() < today.getTime()) return true;
  if (rehearsalDay.getTime() > today.getTime()) return false;
  return now.getTime() >= getRehearsalEndDate(rehearsal).getTime();
}

export function collectOutcomePhotoUrls(
  rehearsals: Rehearsal[],
  options?: { limit?: number; endedOnly?: boolean }
): string[] {
  const limit = options?.limit;
  const endedOnly = options?.endedOnly ?? false;
  const urls: string[] = [];

  for (const rehearsal of rehearsals) {
    if (endedOnly && !isRehearsalEnded(rehearsal)) continue;
    for (const url of rehearsal.outcomePhotoUrls ?? []) {
      if (urls.includes(url)) continue;
      urls.push(url);
      if (limit !== undefined && urls.length >= limit) return urls;
    }
  }

  return urls;
}

export type GalleryPhotoEntry = {
  url: string;
  rehearsalId: string;
  rehearsalDate: string;
};

/** Все фото итогов репетиций, новые даты первыми. */
export function collectGalleryPhotos(rehearsals: Rehearsal[]): GalleryPhotoEntry[] {
  const entries: GalleryPhotoEntry[] = [];
  for (const rehearsal of rehearsals) {
    for (const url of rehearsal.outcomePhotoUrls ?? []) {
      entries.push({
        url,
        rehearsalId: rehearsal.id,
        rehearsalDate: rehearsal.date,
      });
    }
  }
  entries.sort((a, b) => {
    const byDate = b.rehearsalDate.localeCompare(a.rehearsalDate);
    if (byDate !== 0) return byDate;
    return a.url.localeCompare(b.url);
  });
  return entries;
}

export type GalleryDateGroup = {
  date: string;
  items: GalleryPhotoEntry[];
};

export function groupGalleryPhotosByDate(entries: GalleryPhotoEntry[]): GalleryDateGroup[] {
  const byDate = new Map<string, GalleryPhotoEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.rehearsalDate) ?? [];
    list.push(entry);
    byDate.set(entry.rehearsalDate, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}
