import { useMemo, useState } from 'react';
import { addDays, addWeeks, format, isSameDay, subWeeks } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRehearsalStore } from '../store/RehearsalContext';
import { getActiveActors } from '../store/selectors';
import { getWeekStart } from '../components/WeekCalendar';
import { isActorUnavailable, getActorUnavailabilityReason } from '../utils/actorAvailability';
import { getExpectedActorIds } from '../utils/rehearsalInsights';
import { appPaths } from '../navigation/appPaths';
import { pageHeaderClass, pageTitleClass } from '../utils/pageLayout';

export function AvailabilityPage() {
  const { state } = useRehearsalStore();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const actors = getActiveActors(state);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const rehearsalsByDate = useMemo(() => {
    const map = new Map<string, typeof state.rehearsals>();
    for (const day of weekDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      map.set(
        dateStr,
        state.rehearsals.filter(
          (rehearsal) =>
            rehearsal.date === dateStr &&
            (!state.activeTheaterId || rehearsal.theaterId === state.activeTheaterId)
        )
      );
    }
    return map;
  }, [state.rehearsals, state.activeTheaterId, weekDays]);

  const getActorDayStatus = (actorId: string, dateStr: string) => {
    const actor = state.actors.find((item) => item.id === actorId);
    if (!actor) return { kind: 'unknown' as const };
    if (isActorUnavailable(actor, dateStr)) {
      return {
        kind: 'unavailable' as const,
        reason: getActorUnavailabilityReason(actor, dateStr),
      };
    }
    const dayRehearsals = rehearsalsByDate.get(dateStr) ?? [];
    const busy = dayRehearsals.filter((rehearsal) =>
      getExpectedActorIds(state, rehearsal).includes(actorId)
    );
    if (busy.length > 0) {
      return { kind: 'rehearsal' as const, count: busy.length };
    }
    return { kind: 'free' as const };
  };

  return (
    <div className="space-y-6">
      <header className={pageHeaderClass}>
        <div>
          <h1 className={pageTitleClass}>Доступность труппы</h1>
          <p className="mt-1 text-muted">
            Недельная сетка: кто свободен, кто отметил недоступность, у кого репетиция
          </p>
        </div>
        <Link
          to={appPaths.rehearsals}
          className="text-sm text-gold-light hover:underline"
        >
          К календарю →
        </Link>
      </header>

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-gold/10 bg-surface/40 px-4 py-3">
        <button
          type="button"
          onClick={() => setWeekStart((current) => subWeeks(current, 1))}
          className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
          aria-label="Предыдущая неделя"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-medium text-white">
          {format(weekStart, 'd MMM', { locale: ru })} —{' '}
          {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: ru })}
        </p>
        <button
          type="button"
          onClick={() => setWeekStart((current) => addWeeks(current, 1))}
          className="rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white"
          aria-label="Следующая неделя"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {actors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
          Нет активных участников.{' '}
          <Link to={appPaths.actors} className="text-gold-light hover:underline">
            Добавить
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gold/10 bg-surface/40">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gold/10">
                <th className="sticky left-0 z-10 bg-surface/95 px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  Участник
                </th>
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date());
                  return (
                    <th
                      key={day.toISOString()}
                      className={`min-w-[4.5rem] px-2 py-3 text-center text-xs font-medium ${
                        isToday ? 'text-gold-light' : 'text-muted'
                      }`}
                    >
                      <div>{format(day, 'EEE', { locale: ru })}</div>
                      <div className="text-base text-white">{format(day, 'd')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {actors.map((actor) => (
                <tr key={actor.id} className="border-b border-gold/5 last:border-0">
                  <td className="sticky left-0 z-10 bg-surface/95 px-4 py-3">
                    <Link
                      to={appPaths.actor(actor.id)}
                      className="line-clamp-2 font-medium text-white hover:text-gold-light"
                      title={actor.name}
                    >
                      {actor.name}
                    </Link>
                  </td>
                  {weekDays.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const status = getActorDayStatus(actor.id, dateStr);
                    return (
                      <td key={dateStr} className="px-2 py-3 text-center">
                        {status.kind === 'unavailable' && (
                          <span
                            className="inline-block rounded-full bg-amber-500/15 px-2 py-1 text-[10px] text-amber-200"
                            title={status.reason ?? 'Недоступен'}
                          >
                            ✕
                          </span>
                        )}
                        {status.kind === 'rehearsal' && (
                          <span
                            className="inline-block rounded-full bg-gold/15 px-2 py-1 text-[10px] text-gold-light"
                            title={`${status.count} репетиций`}
                          >
                            {status.count}
                          </span>
                        )}
                        {status.kind === 'free' && (
                          <span className="inline-block rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
                            ✓
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-200">✓</span>
          свободен
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">✕</span>
          недоступен
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-gold-light">1</span>
          репетиция в этот день
        </span>
      </div>
    </div>
  );
}
