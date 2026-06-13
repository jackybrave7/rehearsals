import type { Venue } from '../types';

export const DEFAULT_VENUE_ID = 'venue-neverov-library';

export function createDefaultVenue(): Venue {
  return {
    id: DEFAULT_VENUE_ID,
    name: 'Библиотека №90 им. Неверова',
    address: 'Москва, м. Выхино, ул. Молдагуловой, 3Б',
  };
}
