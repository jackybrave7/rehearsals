import type { Venue } from '../types';
import { generateId } from '../utils/id';

/** @deprecated Старый общий id; в новых данных каждая площадка получает свой uuid. */
export const DEFAULT_VENUE_ID = 'venue-neverov-library';

export function createDefaultVenue(): Venue {
  return {
    id: generateId(),
    name: 'Библиотека №90 им. Неверова',
    address: 'Москва, м. Выхино, ул. Молдагуловой, 3Б',
  };
}
