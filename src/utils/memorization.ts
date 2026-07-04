import type { MemorizationStatus } from '../types';

export const memorizationLabels: Record<MemorizationStatus, string> = {
  not_started: 'не начал',
  learning: 'учу',
  known: 'знаю',
};

export const memorizationShortLabels: Record<MemorizationStatus, string> = {
  not_started: 'Не начал',
  learning: 'Учу',
  known: 'Знаю',
};

export function memorizationStatusColors(
  status: MemorizationStatus,
  variant: 'theater' | 'zen' = 'theater'
): string {
  if (variant === 'zen') {
    if (status === 'not_started') return 'bg-black/[0.06] text-foreground border border-border/60';
    if (status === 'learning') return 'bg-amber-100 text-amber-950 border border-amber-300';
    return 'bg-emerald-100 text-emerald-900 border border-emerald-300';
  }
  if (status === 'not_started') return 'bg-white/5 text-muted border border-gold/10';
  if (status === 'learning') return 'bg-amber-500/15 text-amber-200 border border-amber-500/25';
  return 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/25';
}

export function getMemorizationStatus(
  map: Record<string, MemorizationStatus> | undefined,
  sceneId: string
): MemorizationStatus {
  return map?.[sceneId] ?? 'not_started';
}

export function countMemorizationProgress(
  sceneIds: string[],
  map: Record<string, MemorizationStatus> | undefined
): { known: number; learning: number; total: number } {
  let known = 0;
  let learning = 0;
  for (const sceneId of sceneIds) {
    const status = getMemorizationStatus(map, sceneId);
    if (status === 'known') known += 1;
    else if (status === 'learning') learning += 1;
  }
  return { known, learning, total: sceneIds.length };
}
