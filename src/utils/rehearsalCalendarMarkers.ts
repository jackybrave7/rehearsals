import type { AppState, Rehearsal } from '../types';
import { ETUDE_COLOR } from './playColors';
import { resolvePlayIconColor } from './playIcon';
import { getRehearsalPlayIds, rehearsalHasEtudeBlocks } from './rehearsalPlays';

const DEFAULT_MARKER = '#c9a227';

export interface CalendarPlayMarker {
  id: string;
  title: string;
  iconUrl?: string;
  color: string;
}

export function getRehearsalPlayMarkers(
  state: AppState,
  rehearsal: Rehearsal
): CalendarPlayMarker[] {
  const markers: CalendarPlayMarker[] = [];

  for (const playId of getRehearsalPlayIds(state, rehearsal)) {
    const play = state.plays.find((item) => item.id === playId);
    if (!play) continue;
    markers.push({
      id: playId,
      title: play.title,
      iconUrl: play.iconUrl,
      color: resolvePlayIconColor(play),
    });
  }

  if (rehearsalHasEtudeBlocks(rehearsal)) {
    markers.push({ id: '__etude__', title: 'Этюд', color: ETUDE_COLOR });
  }

  if (markers.length === 0) {
    return [{ id: '__default__', title: 'Репетиция', color: DEFAULT_MARKER }];
  }

  return markers;
}

export function getRehearsalMarkerColors(state: AppState, rehearsal: Rehearsal): string[] {
  const colors = getRehearsalPlayMarkers(state, rehearsal).map((marker) => marker.color);
  return colors.length > 0 ? colors : [DEFAULT_MARKER];
}

export function getRehearsalEventLabel(state: AppState, rehearsal: Rehearsal): string {
  const titles = getRehearsalPlayMarkers(state, rehearsal)
    .filter((marker) => marker.id !== '__etude__' && marker.id !== '__default__')
    .map((marker) => marker.title);
  if (titles.length === 0) return 'Репетиция';
  if (titles.length === 1) return `Репетиция «${titles[0]}»`;
  return `Репетиция: ${titles.join(' · ')}`;
}
