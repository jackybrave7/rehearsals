import { Link } from 'react-router-dom';
import { appPaths } from '../navigation/appPaths';
import { AlertTriangle, Info, X } from 'lucide-react';
import type { ActorScheduleConflict, RehearsalWarning, VenueScheduleConflict } from '../utils/rehearsalInsights';
import {
  filterVisibleRehearsalWarnings,
  getConflictWarningId,
  getVenueConflictWarningId,
} from '../utils/rehearsalInsights';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface RehearsalWarningsPanelProps {
  warnings: RehearsalWarning[];
  conflicts: ActorScheduleConflict[];
  venueConflicts?: VenueScheduleConflict[];
  dismissedIds?: string[];
  onDismiss?: (warningId: string) => void;
}

export function RehearsalWarningsPanel({
  warnings,
  conflicts,
  venueConflicts = [],
  dismissedIds,
  onDismiss,
}: RehearsalWarningsPanelProps) {
  const visible = filterVisibleRehearsalWarnings(
    warnings,
    conflicts,
    venueConflicts,
    dismissedIds
  );

  if (
    visible.warnings.length === 0 &&
    visible.conflicts.length === 0 &&
    visible.venueConflicts.length === 0
  ) {
    return null;
  }

  return (
    <section className="rehearsal-warnings space-y-3 rounded-2xl p-4">
      <h2 className="rehearsal-warnings-title flex items-center gap-2 text-sm font-medium uppercase tracking-wide">
        <AlertTriangle size={15} />
        Перед репетицией
      </h2>

      {visible.warnings.length > 0 && (
        <ul className="space-y-2">
          {visible.warnings.map((warning) => (
            <li
              key={warning.id}
              className={`flex items-start gap-2 text-sm leading-relaxed ${
                warning.severity === 'warn' ? 'rehearsal-warnings-warn' : 'rehearsal-warnings-info'
              }`}
            >
              {warning.severity === 'warn' ? (
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              ) : (
                <Info size={14} className="mt-0.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1">{warning.message}</span>
              {onDismiss && (
                <button
                  type="button"
                  onClick={() => onDismiss(warning.id)}
                  className="rehearsal-warnings-dismiss shrink-0 rounded-md p-1 transition-colors"
                  aria-label="Скрыть уведомление"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {visible.conflicts.length > 0 && (
        <div className="rehearsal-warnings-conflicts space-y-2 pt-3">
          <p className="rehearsal-warnings-conflict-title text-xs font-medium uppercase tracking-wide">
            Конфликты в календаре
          </p>
          <ul className="space-y-1.5">
            {visible.conflicts.map(({ actor, otherRehearsal, otherPlayTitle }) => {
              const conflictId = getConflictWarningId(actor.id, otherRehearsal.id);
              return (
                <li
                  key={conflictId}
                  className="rehearsal-warnings-conflict flex items-start gap-2 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{actor.name}</span> занят(а) в это же время на
                    репетиции «{otherPlayTitle}»{' '}
                    <Link
                      to={appPaths.rehearsal(otherRehearsal.id)}
                      className="rehearsal-warnings-conflict-link"
                    >
                      {format(parseISO(otherRehearsal.date), 'd MMM', { locale: ru })}{' '}
                      {otherRehearsal.startTime}–{otherRehearsal.endTime}
                    </Link>
                  </span>
                  {onDismiss && (
                    <button
                      type="button"
                      onClick={() => onDismiss(conflictId)}
                      className="rehearsal-warnings-dismiss shrink-0 rounded-md p-1 transition-colors"
                      aria-label="Скрыть конфликт"
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {visible.venueConflicts.length > 0 && (
        <div className="rehearsal-warnings-conflicts space-y-2 pt-3">
          <p className="rehearsal-warnings-conflict-title text-xs font-medium uppercase tracking-wide">
            Двойное бронирование площадки
          </p>
          <ul className="space-y-1.5">
            {visible.venueConflicts.map(({ venue, otherRehearsal, otherPlayTitle }) => {
              const conflictId = getVenueConflictWarningId(venue.id, otherRehearsal.id);
              return (
                <li
                  key={conflictId}
                  className="rehearsal-warnings-conflict flex items-start gap-2 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    Площадка «{venue.name}» занята в это же время репетицией «{otherPlayTitle}»{' '}
                    <Link
                      to={appPaths.rehearsal(otherRehearsal.id)}
                      className="rehearsal-warnings-conflict-link"
                    >
                      {format(parseISO(otherRehearsal.date), 'd MMM', { locale: ru })}{' '}
                      {otherRehearsal.startTime}–{otherRehearsal.endTime}
                    </Link>
                  </span>
                  {onDismiss && (
                    <button
                      type="button"
                      onClick={() => onDismiss(conflictId)}
                      className="rehearsal-warnings-dismiss shrink-0 rounded-md p-1 transition-colors"
                      aria-label="Скрыть конфликт"
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
