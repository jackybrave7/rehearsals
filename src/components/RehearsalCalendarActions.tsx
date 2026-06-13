import { CalendarPlus, Download } from 'lucide-react';
import type { Rehearsal } from '../types';
import { downloadRehearsalIcs, openGoogleCalendar } from '../utils/rehearsalCalendar';
import { Button } from './Button';

interface RehearsalCalendarActionsProps {
  rehearsal: Rehearsal;
  title: string;
  location?: string;
  compact?: boolean;
}

export function RehearsalCalendarActions({
  rehearsal,
  title,
  location,
  compact = false,
}: RehearsalCalendarActionsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? '' : ''}`}>
      <Button
        variant="secondary"
        className={compact ? '!px-3 !py-1.5 text-sm' : ''}
        onClick={() => openGoogleCalendar(rehearsal, title, location)}
      >
        <CalendarPlus size={16} />
        Google Календарь
      </Button>
      <Button
        variant="secondary"
        className={compact ? '!px-3 !py-1.5 text-sm' : ''}
        onClick={() => downloadRehearsalIcs(rehearsal, title, location)}
      >
        <Download size={16} />
        Файл .ics
      </Button>
    </div>
  );
}
