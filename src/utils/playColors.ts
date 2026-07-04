/** Детерминированный цвет постановки (для календаря, заглушек M6). */
const PLAY_PALETTE = [
  '#c45c3e',
  '#3d7a6e',
  '#5b6eae',
  '#b8860b',
  '#8b5a8c',
  '#2d8a8a',
  '#a0522d',
  '#6b8e23',
] as const;

function hashPlayId(playId: string): number {
  let hash = 0;
  for (let i = 0; i < playId.length; i += 1) {
    hash = (hash * 31 + playId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getPlayColor(playId: string): string {
  return PLAY_PALETTE[hashPlayId(playId) % PLAY_PALETTE.length];
}

export const ETUDE_COLOR = '#9b7bb8';

export function getPlayInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
