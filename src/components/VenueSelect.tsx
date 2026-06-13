import type { Venue } from '../types';
import { VENUE_OTHER, getVenueLabel } from '../utils/venue';
import { Input, Select } from './FormFields';

interface VenueSelectProps {
  venues: Venue[];
  venueId?: string;
  location?: string;
  onChange: (patch: { venueId?: string; location?: string }) => void;
}

export function VenueSelect({ venues, venueId, location, onChange }: VenueSelectProps) {
  const selectedKey = venueId ?? (location?.trim() ? VENUE_OTHER : '');

  const handleVenueChange = (value: string) => {
    if (value === '') {
      onChange({ venueId: undefined, location: '' });
      return;
    }
    if (value === VENUE_OTHER) {
      onChange({ venueId: undefined, location: location ?? '' });
      return;
    }
    const venue = venues.find((v) => v.id === value);
    if (venue) {
      onChange({ venueId: venue.id, location: getVenueLabel(venue) });
    }
  };

  return (
    <>
      <Select
        label="Площадка"
        value={selectedKey}
        onChange={(e) => handleVenueChange(e.target.value)}
        options={[
          { value: '', label: '— не указано —' },
          ...venues.map((v) => ({ value: v.id, label: v.name })),
          { value: VENUE_OTHER, label: 'Другое' },
        ]}
      />
      {selectedKey === VENUE_OTHER && (
        <Input
          label="Место (своё)"
          value={location ?? ''}
          onChange={(e) => onChange({ venueId: undefined, location: e.target.value })}
          placeholder="Репетиционный зал №2"
        />
      )}
    </>
  );
}
