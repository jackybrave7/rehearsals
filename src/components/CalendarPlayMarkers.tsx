import { PlayIcon } from './PlayIcon';
import type { CalendarPlayMarker } from '../utils/rehearsalCalendarMarkers';

type CalendarPlayMarkersProps = {
  markers: CalendarPlayMarker[];
  max?: number;
  size?: 'calendar' | 'sm' | 'md';
  className?: string;
};

const playIconSize = {
  calendar: 'xs',
  sm: 'sm',
  md: 'md',
} as const;

export function CalendarPlayMarkers({
  markers,
  max = 4,
  size = 'calendar',
  className = '',
}: CalendarPlayMarkersProps) {
  const list = markers.slice(0, max);
  if (list.length === 0) return null;

  const iconSize = playIconSize[size];
  const overlap = list.length > 1;

  return (
    <span
      className={`inline-flex items-center ${overlap ? '-space-x-0.5' : 'gap-0.5'} ${className}`}
    >
      {list.map((marker) => (
        <span key={marker.id} title={marker.title} className="relative shrink-0">
          <PlayIcon
            play={{ title: marker.title, iconUrl: marker.iconUrl, iconColor: marker.color }}
            size={iconSize}
            className="ring-1 ring-black/15"
          />
        </span>
      ))}
    </span>
  );
}
