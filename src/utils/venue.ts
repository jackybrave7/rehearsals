import type { Rehearsal, Venue } from '../types';

export const VENUE_OTHER = '__other__';

export function getVenueLabel(venue: Venue): string {
  if (venue.address) {
    return `${venue.name}, ${venue.address}`;
  }
  return venue.name;
}

export function resolveRehearsalLocation(
  rehearsal: Rehearsal,
  venues: Venue[]
): string | undefined {
  if (rehearsal.venueId) {
    const venue = venues.find((v) => v.id === rehearsal.venueId);
    if (venue) return getVenueLabel(venue);
  }
  return rehearsal.location?.trim() || undefined;
}

export function getVenueSelectValue(rehearsal: {
  venueId?: string;
  location?: string;
}): string {
  if (rehearsal.venueId) return rehearsal.venueId;
  if (rehearsal.location?.trim()) return VENUE_OTHER;
  return '';
}
