import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Actor } from '../types';
import { getWeekStart } from './WeekCalendar';
import { getActorDayUnavailabilityKind, getActorUnavailabilityReason } from '../utils/actorAvailability';

type CalendarView = 'month' | 'week';

const WEEKDAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function buildMonthGrid(month: Date): Date[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

interface ActorAvailabilityCalendarProps {
  actor: Actor;
  isZen?: boolean;
  defaultView?: CalendarView;
}

export function ActorAvailabilityCalendar({
  actor,
  isZen = false,
  defaultView = 'month',
}: ActorAvailabilityCalendarProps) {
  const [view, setView] = useState<CalendarView>(defaultView);
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));

  const monthDays = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const visibleDays = view === 'month' ? monthDays : weekDays;

  const navLabel =
    view === 'month'
      ? format(monthAnchor, 'LLLL yyyy', { locale: ru })
      : `${format(weekStart, 'd MMM', { locale: ru })} — ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: ru })}`;

  const goPrev = () => {
    if (view === 'month') setMonthAnchor((current) => subMonths(current, 1));
    else setWeekStart((current) => subWeeks(current, 1));
  };

  const goNext = () => {
    if (view === 'month') setMonthAnchor((current) => addMonths(current, 1));
    else setWeekStart((current) => addWeeks(current, 1));
  };

  const goToday = () => {
    const today = new Date();
    setMonthAnchor(startOfMonth(today));
    setWeekStart(getWeekStart(today));
  };

  const toggleClass = (active: boolean) =>
    active
      ? isZen
        ? 'bg-foreground text-background'
        : 'bg-gold/20 text-gold-light ring-1 ring-gold/30'
      : isZen
        ? 'text-muted hover:bg-black/[0.04] hover:text-foreground'
        : 'text-muted hover:bg-white/5 hover:text-white';

  const dayCellClass = (
    kind: 'none' | 'full' | 'partial',
    isToday: boolean,
    inMonth: boolean
  ) => {
    if (kind === 'full') {
      return isZen
        ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300/60'
        : 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25';
    }
    if (kind === 'partial') {
      return isZen
        ? 'bg-amber-50 text-amber-800 ring-1 ring-dashed ring-amber-400/70'
        : 'bg-amber-500/10 text-amber-100 ring-1 ring-dashed ring-amber-500/35';
    }
    if (isToday) {
      return isZen ? 'bg-black/[0.06] text-foreground ring-1 ring-border' : 'bg-gold/10 text-gold-light ring-1 ring-gold/25';
    }
    if (!inMonth) {
      return isZen ? 'bg-transparent text-muted/40' : 'bg-transparent text-muted/35';
    }
    return isZen ? 'bg-black/[0.03] text-muted' : 'bg-black/15 text-muted';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`inline-flex rounded-lg p-0.5 ${
            isZen ? 'bg-black/[0.04]' : 'bg-black/20 ring-1 ring-white/5'
          }`}
        >
          <button
            type="button"
            onClick={() => setView('month')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${toggleClass(view === 'month')}`}
          >
            Месяц
          </button>
          <button
            type="button"
            onClick={() => setView('week')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${toggleClass(view === 'week')}`}
          >
            Неделя
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          className={`text-xs font-medium underline-offset-2 hover:underline ${
            isZen ? 'text-muted hover:text-foreground' : 'text-muted hover:text-gold-light'
          }`}
        >
          Сегодня
        </button>
      </div>

      <div
        className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 ${
          isZen ? 'bg-black/[0.03]' : 'bg-black/15'
        }`}
      >
        <button
          type="button"
          onClick={goPrev}
          className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
          aria-label={view === 'month' ? 'Предыдущий месяц' : 'Предыдущая неделя'}
        >
          <ChevronLeft size={18} />
        </button>
        <p className={`text-sm font-medium capitalize ${isZen ? 'text-foreground' : 'text-white'}`}>
          {navLabel}
        </p>
        <button
          type="button"
          onClick={goNext}
          className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
          aria-label={view === 'month' ? 'Следующий месяц' : 'Следующая неделя'}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-1 py-1 text-center text-[10px] font-medium uppercase text-muted"
          >
            {label}
          </div>
        ))}
        {visibleDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const kind = getActorDayUnavailabilityKind(actor, dateStr);
          const isToday = isSameDay(day, new Date());
          const inMonth = view === 'week' || isSameMonth(day, monthAnchor);
          return (
            <div
              key={dateStr}
              className={`rounded-lg px-1 py-2 text-center transition-colors ${dayCellClass(kind, isToday, inMonth)}`}
              title={kind !== 'none' ? getActorUnavailabilityReason(actor, dateStr) : undefined}
            >
              <div className={`text-sm font-medium ${view === 'month' ? '' : 'mt-0.5'}`}>
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
