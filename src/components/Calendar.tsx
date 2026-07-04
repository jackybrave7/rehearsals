import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
  getDay,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Rehearsal } from '../types';
import type { CalendarPlayMarker } from '../utils/rehearsalCalendarMarkers';
import { CalendarPlayMarkers } from './CalendarPlayMarkers';

interface CalendarProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  rehearsals: Rehearsal[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  getPlayMarkers?: (rehearsal: Rehearsal) => CalendarPlayMarker[];
}

function DayMarkers({
  dayRehearsals,
  getPlayMarkers,
}: {
  dayRehearsals: Rehearsal[];
  getPlayMarkers?: (rehearsal: Rehearsal) => CalendarPlayMarker[];
}) {
  if (dayRehearsals.length === 0 || !getPlayMarkers) return null;

  const markerById = new Map<string, CalendarPlayMarker>();
  for (const rehearsal of dayRehearsals) {
    for (const marker of getPlayMarkers(rehearsal)) {
      markerById.set(marker.id, marker);
    }
  }

  const list = [...markerById.values()].slice(0, 4);
  if (list.length === 0) return null;

  return (
    <span className="pointer-events-none absolute bottom-0 left-1/2 max-w-[calc(100%-4px)] -translate-x-1/2">
      <CalendarPlayMarkers markers={list} size="calendar" />
    </span>
  );
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function Calendar({
  currentMonth,
  onMonthChange,
  rehearsals,
  selectedDate,
  onSelectDate,
  getPlayMarkers,
}: CalendarProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = (getDay(monthStart) + 6) % 7;

  const rehearsalDates = new Set(rehearsals.map((r) => r.date));

  const getRehearsalsForDay = (day: Date) =>
    rehearsals.filter((r) => isSameDay(parseISO(r.date), day));

  return (
    <div className="rounded-2xl border border-gold/10 bg-surface/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-semibold capitalize text-white">
          {format(currentMonth, 'LLLL yyyy', { locale: ru })}
        </h3>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted">
            {d}
          </div>
        ))}
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasRehearsal = rehearsalDates.has(dateStr);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const count = getRehearsalsForDay(day).length;

          const dayRehearsals = getRehearsalsForDay(day);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(day)}
              className={`relative flex h-11 items-center justify-center rounded-lg text-sm transition-colors ${
                !isSameMonth(day, currentMonth)
                  ? 'text-muted/30'
                  : isSelected
                    ? 'bg-gold text-background font-semibold'
                    : isToday
                      ? 'bg-gold/20 text-gold-light font-medium'
                      : 'text-white hover:bg-white/5'
              }`}
            >
              {format(day, 'd')}
              {hasRehearsal && !isSelected && (
                <DayMarkers dayRehearsals={dayRehearsals} getPlayMarkers={getPlayMarkers} />
              )}
              {count > 1 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold/80 text-[10px] font-bold text-background">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
