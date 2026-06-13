import { AtSign, Users } from 'lucide-react';
import type { ExpectedAttendee } from '../utils/rehearsalInsights';
import { ActorAvatar } from './ActorAvatar';

interface ExpectedAttendeesPanelProps {
  attendees: ExpectedAttendee[];
}

export function ExpectedAttendeesPanel({ attendees }: ExpectedAttendeesPanelProps) {
  if (attendees.length === 0) {
    return (
      <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
          <Users size={15} />
          Кого ждём
        </h2>
        <p className="text-sm text-muted">
          Добавьте сцены или задачи в план — здесь появится список нужных участников.
        </p>
      </section>
    );
  }

  const withoutTelegram = attendees.filter((item) => !item.hasTelegram).length;

  return (
    <section className="rounded-2xl border border-gold/10 bg-surface/40 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
            <Users size={15} />
            Кого ждём
          </h2>
          <p className="mt-1 text-xs text-muted">
            {attendees.length} участник{attendees.length === 1 ? '' : attendees.length < 5 ? 'а' : 'ов'}
            {withoutTelegram > 0 && ` · ${withoutTelegram} без Telegram`}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {attendees.map(({ actor, hasTelegram, sources }) => (
          <li
            key={actor.id}
            className="flex items-start gap-3 rounded-xl border border-gold/10 bg-background/20 px-3 py-2.5"
          >
            <ActorAvatar name={actor.name} photoUrl={actor.photoUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{actor.name}</p>
                {hasTelegram ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-muted">
                    <AtSign size={11} />
                    {actor.telegramUsername?.replace(/^@+/, '')}
                  </span>
                ) : (
                  <span className="warning-badge">нет Telegram</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">{sources.join(' · ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
