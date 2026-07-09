import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Plus,
  Send,
} from 'lucide-react';
import { useRehearsalStore } from '../../store/RehearsalContext';
import { useAuth } from '../../store/AuthContext';
import {
  getActiveActors,
  getTheaterPlays,
  getTheaterRehearsals,
  getTheaterTasks,
  getTheaterVenues,
} from '../../store/selectors';
import { resolveRehearsalLocation } from '../../utils/venue';
import { countRsvpSummary, formatRsvpSummaryLine } from '../../utils/rehearsalRsvp';
import { getRehearsalParticipantActorIds } from '../../utils/rehearsalActors';
import {
  buildAttentionItems,
  buildPremiereAlerts,
  buildPremiereStrip,
  formatPlanScenesPreview,
  getNextTheaterRehearsal,
  getScheduleUrgencyHint,
  getTheaterReadinessStats,
  wasTelegramPlanSent,
  type AttentionItem,
  type PremiereAlert,
} from '../../utils/directorDashboard';
import { appPaths } from '../../navigation/appPaths';
import { pageTitleClass } from '../../utils/pageLayout';
import { PlayMiniIcon } from './PlayMiniIcon';
import { PlayOverviewMini } from '../../pages/OverviewPage';
import { TheaterSetupChecklist } from '../guide/TheaterSetupChecklist';
import { sendTelegramHtmlMessage } from '../../api/telegram';
import { buildRehearsalTelegramBotMessage } from '../../utils/rehearsalTelegramExport';
import { markGuidePlanExported } from '../../utils/guidePlanExport';
import { getRehearsalEventLabel } from '../../utils/rehearsalCalendarMarkers';
import { getLastRehearsalVisit } from '../../utils/lastRehearsalVisit';

const paceStyles = {
  theater: {
    green: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25',
    yellow: 'bg-amber-500/15 text-amber-100 border-amber-500/25',
    red: 'bg-rose-500/15 text-rose-200 border-rose-500/25',
  },
  zen: {
    green: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    yellow: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
    red: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
  },
} as const;

function cardClass(variant: 'theater' | 'zen') {
  return variant === 'zen'
    ? 'zen-card overflow-hidden'
    : 'rounded-2xl border border-gold/10 bg-surface/60 overflow-hidden';
}

function alertClass(severity: PremiereAlert['severity'], variant: 'theater' | 'zen') {
  if (variant === 'zen') {
    return severity === 'red'
      ? 'border-rose-500/50 bg-rose-100'
      : 'border-amber-500/50 bg-amber-100';
  }
  return severity === 'red'
    ? 'border-rose-500/40 bg-rose-500/15 text-rose-100'
    : 'border-amber-500/35 bg-amber-500/10 text-amber-100';
}

function alertTextClass(severity: PremiereAlert['severity'], variant: 'theater' | 'zen') {
  if (variant === 'zen') {
    return severity === 'red' ? 'text-rose-950' : 'text-amber-950';
  }
  return '';
}

function alertSubtextClass(severity: PremiereAlert['severity'], variant: 'theater' | 'zen') {
  if (variant === 'zen') {
    return severity === 'red' ? 'text-rose-900' : 'text-amber-900';
  }
  return 'opacity-80';
}

function alertIconClass(severity: PremiereAlert['severity'], variant: 'theater' | 'zen') {
  if (variant === 'zen') {
    return severity === 'red' ? 'text-rose-800' : 'text-amber-800';
  }
  return '';
}

function AttentionList({
  items,
  variant,
  onPlayNavigate,
}: {
  items: AttentionItem[];
  variant: 'theater' | 'zen';
  onPlayNavigate: (playId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p
        className={`flex items-center gap-2 text-sm ${
          variant === 'zen' ? 'text-emerald-700' : 'text-emerald-300'
        }`}
      >
        <CheckCircle2 size={18} />
        Всё в порядке ✓
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={item.to}
            onClick={() => {
              if (item.playId) onPlayNavigate(item.playId);
            }}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              variant === 'zen'
                ? 'border-border/60 bg-black/[0.02] hover:bg-black/[0.04]'
                : 'border-gold/10 bg-background/30 hover:border-gold/25'
            } ${item.severity === 'warn' ? (variant === 'zen' ? 'text-foreground' : 'text-white') : variant === 'zen' ? 'text-muted' : 'text-muted'}`}
          >
            <AlertTriangle
              size={16}
              className={`mt-0.5 shrink-0 ${
                item.severity === 'warn'
                  ? variant === 'zen'
                    ? 'text-amber-600'
                    : 'text-amber-300'
                  : 'opacity-50'
              }`}
            />
            <span className="min-w-0 flex-1">{item.message}</span>
            <ChevronRight size={16} className="mt-0.5 shrink-0 opacity-40" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function DirectorDashboard({ variant }: { variant: 'theater' | 'zen' }) {
  const { state, dispatch } = useRehearsalStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  const theaterVenues = getTheaterVenues(state);
  const theaterPlays = getTheaterPlays(state);
  const theaterRehearsals = getTheaterRehearsals(state);
  const theaterTasks = getTheaterTasks(state);
  const activeActors = getActiveActors(state);

  const nextRehearsal = useMemo(() => getNextTheaterRehearsal(state), [state]);
  const continueRehearsal = useMemo(() => {
    const lastVisit = getLastRehearsalVisit(state.activeTheaterId);
    if (!lastVisit) return null;
    const rehearsal = theaterRehearsals.find((item) => item.id === lastVisit.rehearsalId);
    if (!rehearsal) return null;
    if (nextRehearsal?.id === rehearsal.id) return null;
    return rehearsal;
  }, [state.activeTheaterId, theaterRehearsals, nextRehearsal]);
  const premiereAlerts = useMemo(() => buildPremiereAlerts(state), [state]);
  const attentionItems = useMemo(() => buildAttentionItems(state), [state]);
  const premiereStrip = useMemo(() => buildPremiereStrip(state), [state]);
  const urgencyHint = useMemo(() => getScheduleUrgencyHint(premiereAlerts), [premiereAlerts]);
  const readinessStats = useMemo(() => getTheaterReadinessStats(state), [state]);

  const openTasks = theaterTasks.filter((task) => !task.completed).length;
  const readinessHint =
    readinessStats.totalCount > 0
      ? `${readinessStats.readyPercent}% · ${readinessStats.readyCount}/${readinessStats.totalCount} сцен`
      : 'нет сцен';

  const handlePlayNavigate = (playId: string) => {
    dispatch({ type: 'SET_ACTIVE_PLAY', payload: playId });
  };

  const handleSendTelegram = async () => {
    if (!nextRehearsal) return;
    const theaterId = nextRehearsal.theaterId ?? state.activeTheaterId;
    if (!theaterId) {
      setTelegramError('Не выбран театр');
      return;
    }
    setTelegramSending(true);
    setTelegramError(null);
    try {
      await sendTelegramHtmlMessage(
        theaterId,
        buildRehearsalTelegramBotMessage(state, nextRehearsal, {
          initiatedBy: user?.name?.trim() || user?.email,
        })
      );
      const sentAt = new Date().toISOString();
      dispatch({
        type: 'UPDATE_REHEARSAL',
        payload: { ...nextRehearsal, telegramPlanSentAt: sentAt },
      });
      markGuidePlanExported(dispatch);
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : 'Не удалось отправить');
    } finally {
      setTelegramSending(false);
    }
  };

  const participantIds = nextRehearsal
    ? getRehearsalParticipantActorIds(state, nextRehearsal)
    : [];
  const rsvpLine = nextRehearsal
    ? formatRsvpSummaryLine(countRsvpSummary(nextRehearsal, participantIds))
    : '';
  const planSent = nextRehearsal ? wasTelegramPlanSent(nextRehearsal) : false;

  return (
    <div className={variant === 'zen' ? 'space-y-5 sm:space-y-7' : 'space-y-4 sm:space-y-6'}>
      {variant === 'theater' && (
        <header>
          <h1 className={pageTitleClass}>Обзор</h1>
          <p className="mt-0.5 hidden text-sm text-muted sm:block">Рабочий стол режиссёра</p>
        </header>
      )}

      <TheaterSetupChecklist variant={variant} />

      {continueRehearsal ? (
        <Link
          to={appPaths.rehearsal(continueRehearsal.id)}
          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm ${
            variant === 'zen'
              ? 'border-border/60 bg-black/[0.02] hover:bg-black/[0.04]'
              : 'border-gold/15 bg-gold/5 hover:bg-gold/10'
          }`}
        >
          <span className="min-w-0 truncate">
            Продолжить:{' '}
            <span className="font-medium capitalize">
              {format(parseISO(continueRehearsal.date), 'EEE, d MMM', { locale: ru })}
            </span>
            {' · '}
            {continueRehearsal.startTime}
          </span>
          <ChevronRight size={16} className="shrink-0 opacity-70 sm:h-[18px] sm:w-[18px]" />
        </Link>
      ) : null}

      {/* 1. Ближайшая репетиция */}
      <section className={cardClass(variant)}>
        {nextRehearsal ? (
          <div className="p-4 sm:p-6">
            <p
              className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                variant === 'zen' ? 'text-muted' : 'text-gold-light/80'
              }`}
            >
              Ближайшая репетиция
            </p>
            <Link
              to={appPaths.rehearsal(nextRehearsal.id)}
              className="mt-2 block transition-opacity hover:opacity-90"
            >
              <p
                className={`text-xl font-bold capitalize sm:text-2xl lg:text-3xl ${
                  variant === 'zen' ? 'text-foreground' : 'text-white'
                }`}
              >
                {format(parseISO(nextRehearsal.date), 'EEEE, d MMMM', { locale: ru })}
              </p>
              <p className="mt-1 text-sm text-muted">
                {nextRehearsal.startTime}–{nextRehearsal.endTime}
                {resolveRehearsalLocation(nextRehearsal, theaterVenues) && (
                  <>
                    {' '}
                    · <MapPin size={12} className="inline" />{' '}
                    {resolveRehearsalLocation(nextRehearsal, theaterVenues)}
                  </>
                )}
              </p>
              <p className="mt-2 text-sm text-muted">
                {getRehearsalEventLabel(state, nextRehearsal)}
              </p>
              <p className="mt-1 text-sm">{formatPlanScenesPreview(state, nextRehearsal)}</p>
            </Link>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              {participantIds.length > 0 && (
                <span
                  className={`rounded-full border px-3 py-1 ${
                    variant === 'zen'
                      ? 'border-border/60 bg-black/[0.03]'
                      : 'border-gold/15 bg-gold/5 text-gold-light'
                  }`}
                >
                  {rsvpLine}
                </span>
              )}
              <span
                className={`rounded-full border px-3 py-1 ${
                  planSent
                    ? variant === 'zen'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    : variant === 'zen'
                      ? 'border-border/60 text-muted'
                      : 'border-gold/15 text-muted'
                }`}
              >
                План в Telegram: {planSent ? 'да' : 'нет'}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSendTelegram()}
                disabled={telegramSending}
                className={
                  variant === 'zen'
                    ? 'zen-primary-btn inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60'
                    : 'inline-flex items-center gap-2 rounded-lg border border-gold/25 bg-gold/15 px-4 py-2 text-sm font-medium text-gold-light transition-colors hover:bg-gold/25 disabled:opacity-60'
                }
              >
                <Send size={16} />
                {telegramSending ? 'Отправка…' : 'Отправить план в Telegram'}
              </button>
              <Link
                to={appPaths.rehearsal(nextRehearsal.id)}
                className={
                  variant === 'zen'
                    ? 'inline-flex items-center gap-1 rounded-full border border-border/60 px-4 py-2 text-sm font-medium'
                    : 'inline-flex items-center gap-1 rounded-lg border border-gold/15 px-4 py-2 text-sm text-muted hover:text-white'
                }
              >
                Открыть план <ChevronRight size={16} />
              </Link>
            </div>
            {telegramError && (
              <p className={`mt-2 text-sm ${variant === 'zen' ? 'text-rose-800' : 'text-rose-400'}`}>
                {telegramError}
              </p>
            )}
          </div>
        ) : (
          <div className="p-6 text-center sm:p-8">
            <CalendarDays
              size={32}
              className={`mx-auto mb-3 ${variant === 'zen' ? 'text-muted' : 'text-gold/50'}`}
            />
            <p className={`text-lg font-semibold ${variant === 'zen' ? 'text-foreground' : 'text-white'}`}>
              Репетиций не запланировано
            </p>
            {urgencyHint && (
              <p
                className={`mx-auto mt-2 max-w-md text-sm font-medium ${
                  variant === 'zen' ? 'text-rose-950' : 'text-rose-300'
                }`}
              >
                {urgencyHint}
              </p>
            )}
            <Link
              to={appPaths.rehearsals}
              className={
                variant === 'zen'
                  ? 'zen-primary-btn mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold'
                  : 'mt-5 inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 text-base font-semibold text-background transition-colors hover:bg-gold-light'
              }
            >
              <Plus size={18} />
              Запланировать репетицию
            </Link>
          </div>
        )}
      </section>

      {/* 2. Баннеры премьеры */}
      {premiereAlerts.map((alert) => (
        <Link
          key={alert.playId}
          to={appPaths.readiness}
          onClick={() => handlePlayNavigate(alert.playId)}
          className={`block rounded-2xl border px-4 py-3 transition-opacity hover:opacity-95 sm:px-5 sm:py-4 ${alertClass(alert.severity, variant)} ${alertTextClass(alert.severity, variant)}`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className={`mt-0.5 shrink-0 ${alertIconClass(alert.severity, variant)}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`font-semibold leading-snug ${alertTextClass(alert.severity, variant)}`}>
                {alert.message}
              </p>
              <p className={`mt-1 text-xs font-medium ${alertSubtextClass(alert.severity, variant)}`}>
                Открыть готовность сцен →
              </p>
            </div>
          </div>
        </Link>
      ))}

      {/* 3. Требует внимания */}
      <section className={`${cardClass(variant)} p-5 sm:p-6`}>
        <h2
          className={`mb-4 text-base font-semibold ${
            variant === 'zen' ? 'text-foreground' : 'text-white'
          }`}
        >
          Требует внимания
        </h2>
        <AttentionList items={attentionItems} variant={variant} onPlayNavigate={handlePlayNavigate} />
      </section>

      {/* 4. Полоса премьер */}
      {theaterPlays.length > 0 && (
        <section className={`${cardClass(variant)} p-5 sm:p-6`}>
          <h2
            className={`mb-4 text-base font-semibold ${
              variant === 'zen' ? 'text-foreground' : 'text-white'
            }`}
          >
            Премьеры
          </h2>
          <ul className="space-y-2">
            {premiereStrip.map((row) => (
              <li key={row.play.id}>
                <button
                  type="button"
                  onClick={() => {
                    handlePlayNavigate(row.play.id);
                    navigate(appPaths.readiness);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    variant === 'zen'
                      ? 'border-border/60 hover:bg-black/[0.03]'
                      : 'border-gold/10 bg-background/20 hover:border-gold/25'
                  }`}
                >
                  <PlayMiniIcon play={row.play} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate font-medium ${
                        variant === 'zen' ? 'text-foreground' : 'text-white'
                      }`}
                    >
                      {row.play.title}
                    </p>
                    <p className="text-xs text-muted">
                      {row.daysLeft != null ? `через ${row.daysLeft} дн.` : 'без даты'} · готово{' '}
                      {row.readyPercent}%
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${paceStyles[variant][row.pace]}`}
                  >
                    {row.paceLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {theaterPlays.length >= 2 && <PlayOverviewMini />}

      {/* Счётчики — только в «Ещё» для zen; для theater убраны */}
      {variant === 'zen' && (
        <section className="zen-card">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5 [&::-webkit-details-marker]:hidden">
              <span className="text-base font-semibold text-foreground">Ещё разделы</span>
              <ChevronRight
                size={18}
                className="text-muted transition-transform group-open:rotate-90"
              />
            </summary>
            <div className="space-y-1 border-t border-border/60 px-3 pb-3 pt-2">
              {[
                { label: 'Готовность', to: appPaths.readiness, hint: readinessHint },
                { label: 'Сцены', value: state.scenes.filter((s) => theaterPlays.some((p) => p.id === s.playId)).length, to: appPaths.scenes },
                { label: 'Репетиции', value: theaterRehearsals.length, to: appPaths.rehearsals },
                { label: 'Участники', value: activeActors.length, to: appPaths.actors },
                { label: 'Постановки', to: appPaths.play, hint: `${theaterPlays.length}` },
                { label: 'Площадки', to: appPaths.venues },
                { label: 'Задачи', to: appPaths.tasks, hint: openTasks ? `${openTasks} открытых` : undefined },
                { label: 'Настройки', to: appPaths.settings },
              ].map((link) => (
                <Link
                  key={link.to + link.label}
                  to={link.to}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-base text-foreground transition-colors hover:bg-black/[0.03]"
                >
                  <span>
                    {link.label}
                    {'value' in link && link.value !== undefined ? (
                      <span className="ml-2 text-sm text-muted">{link.value}</span>
                    ) : null}
                  </span>
                  {'hint' in link && link.hint ? (
                    <span className="text-sm text-muted">{link.hint}</span>
                  ) : (
                    <ChevronRight size={16} className="text-muted" />
                  )}
                </Link>
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
