import { Link, useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  AtSign,
  CalendarOff,
} from 'lucide-react';
import { useMemo } from 'react';
import { useRehearsalStore } from '../store/RehearsalContext';
import { useDesign } from '../store/DesignContext';
import { ActorAvatar } from '../components/ActorAvatar';
import { ActorTelegramBotLink } from '../components/ActorTelegramBotLink';
import { Button } from '../components/Button';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { useSubscription } from '../hooks/useSubscription';
import { getActorUnavailabilityBadge } from '../utils/actorAvailability';
import { getActorWorkload, groupRolesByPlay } from '../utils/actorInsights';
import { formatPhone } from '../utils/phone';
import { resolveRehearsalLocation } from '../utils/venue';
import { getTheaterVenues } from '../store/selectors';
import { appPaths } from '../navigation/appPaths';

const attendanceLabels = {
  present: 'Был(а)',
  late: 'Опоздал(а)',
  absent: 'Не был(а)',
  substitute: 'Замена',
} as const;

const roleKindLabels = {
  character: 'Роль',
  crew: 'Постановка',
  technical: 'Техника',
} as const;

export function ActorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useRehearsalStore();
  const { isZen } = useDesign();
  const { isPro } = useSubscription();
  const actor = state.actors.find((item) => item.id === id);
  const venues = getTheaterVenues(state);

  const workload = useMemo(
    () => (actor ? getActorWorkload(state, actor.id) : null),
    [state, actor]
  );

  if (!actor) {
    return (
      <div className="rounded-2xl border border-dashed border-gold/20 p-12 text-center text-muted">
        <p>Участник не найден.</p>
        <Link to={appPaths.actors} className="mt-3 inline-block text-gold-light hover:underline">
          К списку участников
        </Link>
      </div>
    );
  }

  const cardClass = isZen ? 'zen-card p-5' : 'rounded-2xl border border-gold/10 bg-surface/40 p-5';
  const rolesGrouped = workload ? groupRolesByPlay(workload.rolesByPlay) : [];
  const unavailabilityBadge = getActorUnavailabilityBadge(actor);
  const telegramUsername = actor.telegramUsername?.replace(/^@+/, '').trim();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <Button variant="ghost" className="!px-2" onClick={() => navigate(appPaths.actors)}>
            <ArrowLeft size={18} />
          </Button>
          <ActorAvatar name={actor.name} photoUrl={actor.photoUrl} size="lg" archived={actor.status === 'archived'} />
          <div className="min-w-0">
            <h1 className={`text-2xl font-bold ${isZen ? 'text-foreground' : 'text-white'}`}>
              {actor.name}
            </h1>
            {actor.status === 'archived' && (
              <p className="mt-1 text-sm text-muted">В архиве · {actor.archiveReason}</p>
            )}
            {unavailabilityBadge && (
              <p className="mt-1 text-sm text-amber-200">{unavailabilityBadge}</p>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cardClass}>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Контакты</h2>
          <div className="space-y-2 text-sm text-muted">
            {actor.phone && (
              <p className="flex items-center gap-2">
                <Phone size={14} /> {formatPhone(actor.phone)}
              </p>
            )}
            {actor.email && (
              <p className="flex items-center gap-2">
                <Mail size={14} /> {actor.email}
              </p>
            )}
            {telegramUsername && (
              <p className="flex items-center gap-2">
                <AtSign size={14} /> @{telegramUsername}
              </p>
            )}
            {!actor.phone && !actor.email && !telegramUsername && (
              <p>Контакты не указаны.</p>
            )}
            {actor.notes && <p className="pt-2 text-muted">{actor.notes}</p>}
            {actor.status === 'active' && (
              <div className="pt-3">
                <ActorTelegramBotLink
                  actorId={actor.id}
                  theaterId={actor.theaterId ?? state.activeTheaterId}
                  telegramChatId={actor.telegramChatId}
                />
              </div>
            )}
          </div>
        </section>

        {workload && workload.attendance.total > 0 && (
          <section className={cardClass}>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
              Посещаемость
            </h2>
            {isPro ? (
              <>
                <p className="mb-3 text-3xl font-bold text-white">{workload.attendance.ratePercent}%</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(attendanceLabels) as Array<keyof typeof attendanceLabels>).map(
                    (key) => (
                      <span
                        key={key}
                        className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-muted"
                      >
                        {attendanceLabels[key]}: {workload.attendance[key]}
                      </span>
                    )
                  )}
                </div>
                {workload.staleRehearsal && (
                  <p className="mt-3 text-sm text-amber-200">
                    Давно не репетировал(а)
                    {workload.daysSinceLastRehearsal !== null &&
                      ` — ${workload.daysSinceLastRehearsal} дн. назад`}
                  </p>
                )}
                {workload.lastRehearsedAt && !workload.staleRehearsal && (
                  <p className="mt-3 text-sm text-muted">
                    Последняя репетиция:{' '}
                    {format(parseISO(workload.lastRehearsedAt), 'd MMMM yyyy', { locale: ru })}
                  </p>
                )}
              </>
            ) : (
              <UpgradePrompt
                compact
                title="Аналитика посещаемости — в Pro"
                description="Процент явок, история репетиций и давность последнего выхода."
              />
            )}
          </section>
        )}
      </div>

      <section className={cardClass}>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
          Роли по постановкам
        </h2>
        {rolesGrouped.length === 0 ? (
          <p className="text-sm text-muted">Роли не назначены.</p>
        ) : (
          <div className="space-y-4">
            {rolesGrouped.map((group) => (
              <div key={group.playId}>
                <p className="font-medium text-white">{group.playTitle}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted">
                  {group.roles.map((role) => (
                    <li key={`${role.performanceName}-${role.roleName}`}>
                      {role.performanceName}: {role.roleName}{' '}
                      <span className="text-muted/70">({roleKindLabels[role.roleKind]})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {(actor.unavailability ?? []).length > 0 && actor.status !== 'archived' && (
        <section className={cardClass}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted">
            <CalendarOff size={14} />
            Недоступность
          </h2>
          <ul className="space-y-2 text-sm">
            {(actor.unavailability ?? []).map((period) => (
              <li key={period.id} className="rounded-lg bg-white/5 px-3 py-2">
                <p className="text-white">
                  {period.from.split('-').reverse().join('.')}
                  {period.from !== period.to &&
                    ` — ${period.to.split('-').reverse().join('.')}`}
                </p>
                {period.reason && <p className="text-muted">{period.reason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {workload && workload.upcomingRehearsals.length > 0 && (
        <section className={cardClass}>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
            Ближайшие репетиции
          </h2>
          <ul className="space-y-2">
            {workload.upcomingRehearsals.map((rehearsal) => {
              const location = resolveRehearsalLocation(rehearsal, venues);
              return (
                <li key={rehearsal.id}>
                  <Link
                    to={appPaths.rehearsal(rehearsal.id)}
                    className="flex items-center justify-between rounded-xl border border-gold/10 bg-background/20 px-4 py-3 transition-colors hover:border-gold/25"
                  >
                    <div>
                      <p className="font-medium text-white capitalize">
                        {format(parseISO(rehearsal.date), 'EEEE, d MMMM', { locale: ru })}
                      </p>
                      <p className="text-sm text-muted">
                        {rehearsal.startTime}–{rehearsal.endTime}
                        {location && (
                          <>
                            {' '}
                            · <MapPin size={12} className="mr-0.5 inline" />
                            {location}
                          </>
                        )}
                      </p>
                    </div>
                    <CalendarDays size={16} className="text-gold/70" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
