import type { Rehearsal } from '../types';
import {
  collectGalleryPhotos,
  groupGalleryPhotosByDate,
  type GalleryDateGroup,
  type GalleryPhotoEntry,
} from './rehearsalOutcomePhotos';

export type GalleryMediaEntry = {
  kind: 'photo' | 'video';
  url: string;
  rehearsalId: string;
  rehearsalDate: string;
};

export function collectGalleryMedia(rehearsals: Rehearsal[]): GalleryMediaEntry[] {
  const entries: GalleryMediaEntry[] = [];

  const sorted = [...rehearsals].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });

  for (const rehearsal of sorted) {
    for (const url of rehearsal.outcomePhotoUrls ?? []) {
      entries.push({
        kind: 'photo',
        url,
        rehearsalId: rehearsal.id,
        rehearsalDate: rehearsal.date,
      });
    }
    for (const url of rehearsal.outcomeVideoUrls ?? []) {
      entries.push({
        kind: 'video',
        url,
        rehearsalId: rehearsal.id,
        rehearsalDate: rehearsal.date,
      });
    }
  }

  return entries;
}

export type GalleryMediaDateGroup = {
  date: string;
  items: GalleryMediaEntry[];
};

export function groupGalleryMediaByDate(entries: GalleryMediaEntry[]): GalleryMediaDateGroup[] {
  const byDate = new Map<string, GalleryMediaEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.rehearsalDate) ?? [];
    list.push(entry);
    byDate.set(entry.rehearsalDate, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }));
}

/** @deprecated use collectGalleryMedia */
export { collectGalleryPhotos, groupGalleryPhotosByDate, type GalleryDateGroup, type GalleryPhotoEntry };
