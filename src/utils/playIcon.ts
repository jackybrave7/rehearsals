import type { Play } from '../types';

const DEFAULT_COLORS = [
  '#b45309',
  '#0d9488',
  '#7c3aed',
  '#be123c',
  '#1d4ed8',
  '#15803d',
];

function hashTitle(title: string): number {
  let hash = 0;
  for (let index = 0; index < title.length; index += 1) {
    hash = (hash * 31 + title.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function resolvePlayIconColor(play: Pick<Play, 'title' | 'iconColor'>): string {
  if (play.iconColor?.trim()) return play.iconColor.trim();
  return DEFAULT_COLORS[hashTitle(play.title) % DEFAULT_COLORS.length];
}

export function resolvePlayInitial(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '?';
  const match = trimmed.match(/[«"]?([А-ЯA-ZЁа-яa-zё])/);
  return (match?.[1] ?? trimmed[0]).toUpperCase();
}
