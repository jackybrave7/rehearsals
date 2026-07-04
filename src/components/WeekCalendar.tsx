import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Rehearsal } from '../types';
import { timeToMinutes } from '../utils/time';

interface WeekCalendarProps {
  weekStart: Date;
  onWeekChange: (date: Date) => void;
  rehearsals: Rehearsal[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const HOUR_START = 10;
const HOUR_END = 23;

export function WeekCalendar({
  weekStart,
  onWeekChange,
  rehearsals,
  selectedDate,
  onSelectDate,
}: WeekCalendarProps) {
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, index) => HOUR_START + index);

  const rehearsalsForDay = (day: Date) =>
    rehearsals.filter((rehearsal) => isSameDay(parseISO(rehearsal.date), day));

  return (
    <div className="rounded-2xl border border-gold/10 bg-surface/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onWeekChange(subWeeks(weekStart, 1))}
          className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
          aria-label="Предыдущая неделя"
        >
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-center text-sm font-semibold text-white sm:text-base">
          {format(weekStart, 'd MMM', { locale: ru })} —{' '}
          {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: ru })}
        </h3>
        <button
          type="button"
          onClick={() => onWeekChange(addWeeks(weekStart, 1))}
          className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
          aria-label="Следующая неделя"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[40rem]">
          <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] gap-px rounded-xl border border-gold/10 bg-gold/10">
            <div className="bg-background/80" />
            {weekDays.map((day) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());
              const dayRehearsals = rehearsalsForDay(day);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className={`bg-background/80 px-2 py-2 text-center transition-colors ${
                    isSelected ? 'bg-gold/15' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted">
                    {format(day, 'EEE', { locale: ru })}
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      isToday ? 'text-gold-light' : 'text-white'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                  {dayRehearsals.length > 0 && (
                    <div className="mt-1 text-[10px] text-muted">{dayRehearsals.length} реп.</div>
                  )}
                </button>
              );
            })}

            {hours.map((hour) => (
              <div key={hour} className="contents">
                <div className="bg-background/60 px-1 py-3 text-right text-[10px] text-muted">
                  {hour}:00
                </div>
                {weekDays.map((day) => {
                  const dayRehearsals = rehearsalsForDay(day).filter((rehearsal) => {
                    const start = timeToMinutes(rehearsal.startTime);
                    const end = timeToMinutes(rehearsal.endTime);
                    const slotStart = hour * 60;
                    const slotEnd = (hour + 1) * 60;
                    return start < slotEnd && end > slotStart;
                  });

                  return (
                    <div
                      key={`${day.toISOString()}-${hour}`}
                      className="min-h-10 bg-background/40 p-0.5"
                    >
                      {dayRehearsals.map((rehearsal) => (
                        <button
                          key={rehearsal.id}
                          type="button"
                          onClick={() => onSelectDate(day)}
                          className="mb-0.5 w-full rounded-md bg-gold/20 px-1 py-0.5 text-left text-[10px] leading-tight text-gold-light hover:bg-gold/30"
                          title={`${rehearsal.startTime}–${rehearsal.endTime}`}
                        >
                          {rehearsal.startTime}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}
