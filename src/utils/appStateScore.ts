import type { AppState } from '../types';

export function scoreAppState(state: AppState): number {
  let score = 0;
  score += state.rehearsals.length * 10_000;
  score += state.rehearsals.reduce((sum, rehearsal) => sum + rehearsal.schedule.length, 0) * 100;
  score += state.rehearsals.reduce((sum, rehearsal) => sum + rehearsal.sceneIds.length, 0) * 10;
  score += state.scenes.length * 5;
  score += state.castAssignments.length * 2;
  score += state.tasks.length;
  score += state.actors.length;
  score += state.theaters.length;
  return score;
}

export function pickBestAppState(
  ...candidates: Array<AppState | null | undefined>
): AppState | null {
  let best: AppState | null = null;
  let bestScore = -1;

  for (const state of candidates) {
    if (!state) continue;
    const score = scoreAppState(state);
    if (score > bestScore) {
      best = state;
      bestScore = score;
    }
  }

  return best;
}
