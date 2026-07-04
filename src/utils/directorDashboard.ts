import { format, isAfter, parseISO, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AppState, Play, Rehearsal } from '../types';
import { getTheaterPlays, getTheaterRehearsals, getTheaterTasks } from '../store/selectors';
import { formatUpcomingPerformanceCountdown, getUpcomingPremiere } from './premiere';
import type { Performance } from '../types';
import { buildPlayReadinessReport } from './sceneReadiness';
import { rehearsalInvolvesPlay } from './rehearsalPlays';
import { countRsvpSummary } from './rehearsalRsvp';
import { getRehearsalParticipantActorIds } from './rehearsalActors';
import { getActorScheduleConflicts } from './rehearsalInsights';
import { getOverdueTasks } from './tasks';
import { getSceneShortLabel } from './sceneLabels';
import { appPaths } from '../navigation/appPaths';

export const PREMIERE_ALERT_WINDOW_DAYS = 14;
export const PREMIERE_ALERT_RED_DAYS = 7;
export const READINESS_WARN_PERCENT = 70;
export const READINESS_CRITICAL_PERCENT = 50;

export type AlertSeverity = 'yellow' | 'red';
export type PaceStatus = 'green' | 'yellow' | 'red';

export interface PremiereAlert {
  playId: string;
  playTitle: string;
  performance: Performance;
  daysLeft: number;
  readyPercent: number;
  severity: AlertSeverity;
  hasUpcomingRehearsals: boolean;
  message: string;
}

export interface AttentionItem {
  id: string;
  severity: 'warn' | 'info';
  message: string;
  to: string;
  playId?: string;
}

export interface PremiereStripRow {
  play: Play;
  daysLeft: number | null;
  readyPercent: number;
  pace: PaceStatus;
  paceLabel: string;
}

export function getNextTheaterRehearsal(state: AppState): Rehearsal | null {
  const today = startOfDay(new Date());
  const upcoming = getTheaterRehearsals(state)
    .filter((rehearsal) => !isAfter(today, parseISO(rehearsal.date)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  return upcoming[0] ?? null;
}

export function hasUpcomingRehearsalsForPlay(state: AppState, playId: string): boolean {
  const today = startOfDay(new Date());
  return getTheaterRehearsals(state).some(
    (rehearsal) =>
      !isAfter(today, parseISO(rehearsal.date)) && rehearsalInvolvesPlay(state, rehearsal, playId)
  );
}

export function isRehearsalPlanEmpty(rehearsal: Rehearsal): boolean {
  return rehearsal.schedule.length === 0 && rehearsal.sceneIds.length === 0;
}

export function formatPlanScenesPreview(state: AppState, rehearsal: Rehearsal, limit = 4): string {
  const titles: string[] = [];
  for (const block of rehearsal.schedule) {
    if (block.type === 'scene' && block.sceneId) {
      const scene = state.scenes.find((item) => item.id === block.sceneId);
      titles.push(scene ? getSceneShortLabel(scene) : block.title);
    } else if (block.type === 'etude') {
      titles.push(block.title || 'Этюд');
    }
  }
  if (titles.length === 0) {
    for (const sceneId of rehearsal.sceneIds.slice(0, limit)) {
      const scene = state.scenes.find((item) => item.id === sceneId);
      if (scene) titles.push(getSceneShortLabel(scene));
    }
  }
  if (titles.length === 0) return 'План пустой';
  const shown = titles.slice(0, limit);
  const extra = titles.length - shown.length;
  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ');
}

export function wasTelegramPlanSent(rehearsal: Rehearsal): boolean {
  return Boolean(rehearsal.telegramPlanSentAt);
}

export function buildPremiereAlerts(state: AppState): PremiereAlert[] {
  const plays = getTheaterPlays(state);
  const alerts: PremiereAlert[] = [];

  for (const play of plays) {
    const premiere = getUpcomingPremiere(state, play.id);
    if (!premiere || premiere.daysLeft > PREMIERE_ALERT_WINDOW_DAYS) continue;

    const report = buildPlayReadinessReport(state, play.id);
    const readyPercent =
      report.totalCount > 0 ? Math.round((report.readyCount / report.totalCount) * 100) : 0;
    const hasRehearsals = hasUpcomingRehearsalsForPlay(state, play.id);
    const lowReadiness = readyPercent < READINESS_WARN_PERCENT;
    const criticalReadiness = readyPercent < READINESS_CRITICAL_PERCENT;

    if (!lowReadiness && hasRehearsals) continue;

    const severity: AlertSeverity =
      premiere.daysLeft <= PREMIERE_ALERT_RED_DAYS || criticalReadiness || !hasRehearsals
        ? 'red'
        : 'yellow';

    const parts = [
      formatUpcomingPerformanceCountdown(play.title, premiere.performance, premiere.daysLeft),
      `готово ${readyPercent}%`,
    ];
    if (!hasRehearsals) parts.push('репетиций не запланировано');

    alerts.push({
      playId: play.id,
      playTitle: play.title,
      performance: premiere.performance,
      daysLeft: premiere.daysLeft,
      readyPercent,
      severity,
      hasUpcomingRehearsals: hasRehearsals,
      message: parts.join(' · '),
    });
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function buildAttentionItems(state: AppState): AttentionItem[] {
  const items: AttentionItem[] = [];
  const today = startOfDay(new Date());
  const theaterTasks = getTheaterTasks(state);
  const plays = getTheaterPlays(state);

  const upcomingRehearsals = getTheaterRehearsals(state)
    .filter((rehearsal) => !isAfter(today, parseISO(rehearsal.date)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 5);

  for (const rehearsal of upcomingRehearsals) {
    const participantIds = getRehearsalParticipantActorIds(state, rehearsal);
    const rsvp = countRsvpSummary(rehearsal, participantIds);
    if (rsvp.pending > 0 && participantIds.length > 0) {
      const dateLabel = format(parseISO(rehearsal.date), 'd MMM', { locale: ru });
      items.push({
        id: `rsvp-${rehearsal.id}`,
        severity: 'warn',
        message: `${rsvp.pending} без ответа на подтверждение · репетиция ${dateLabel}`,
        to: appPaths.rehearsal(rehearsal.id),
      });
    }

    if (isRehearsalPlanEmpty(rehearsal)) {
      const dateLabel = format(parseISO(rehearsal.date), 'd MMM', { locale: ru });
      items.push({
        id: `empty-plan-${rehearsal.id}`,
        severity: 'warn',
        message: `Пустой план ближайшей репетиции (${dateLabel})`,
        to: appPaths.rehearsal(rehearsal.id),
      });
    }

    for (const conflict of getActorScheduleConflicts(state, rehearsal)) {
      items.push({
        id: `conflict-${rehearsal.id}-${conflict.actor.id}`,
        severity: 'warn',
        message: `${conflict.actor.name}: конфликт в календаре (${format(parseISO(rehearsal.date), 'd MMM', { locale: ru })})`,
        to: appPaths.rehearsal(rehearsal.id),
      });
    }
  }

  for (const play of plays) {
    const report = buildPlayReadinessReport(state, play.id);
    const staleScenes = report.items.filter((item) => item.heat === 'never' || item.heat === 'stale');
    for (const item of staleScenes.slice(0, 2)) {
      const label =
        item.heat === 'never'
          ? `«${getSceneShortLabel(item.scene)}» ни разу не репетировали`
          : `«${getSceneShortLabel(item.scene)}» давно не брали`;
      items.push({
        id: `stale-${play.id}-${item.scene.id}`,
        severity: 'info',
        message: `${play.title}: ${label}`,
        to: appPaths.scenes,
        playId: play.id,
      });
    }
  }

  for (const task of getOverdueTasks(theaterTasks).slice(0, 5)) {
    items.push({
      id: `task-${task.id}`,
      severity: 'warn',
      message: `Просрочена задача: «${task.title}»`,
      to: appPaths.tasks,
    });
  }

  return items.slice(0, 12);
}

export function buildPremiereStrip(state: AppState): PremiereStripRow[] {
  const plays = getTheaterPlays(state);

  return plays
    .map((play): PremiereStripRow => {
      const premiere = getUpcomingPremiere(state, play.id);
      const report = buildPlayReadinessReport(state, play.id);
      const readyPercent =
        report.totalCount > 0 ? Math.round((report.readyCount / report.totalCount) * 100) : 0;

      let pace: PaceStatus = 'yellow';
      let paceLabel = 'Нет даты премьеры';
      if (report.onTrackForPremiere === true) {
        pace = 'green';
        paceLabel = 'Успеваем';
      } else if (report.onTrackForPremiere === false) {
        pace = 'red';
        paceLabel = 'Риск';
      } else if (premiere) {
        paceLabel = report.onTrackLabel;
      }

      return {
        play,
        daysLeft: premiere?.daysLeft ?? null,
        readyPercent,
        pace,
        paceLabel,
      };
    })
    .sort((a, b) => {
      const aDays = a.daysLeft ?? Number.POSITIVE_INFINITY;
      const bDays = b.daysLeft ?? Number.POSITIVE_INFINITY;
      if (aDays !== bDays) return aDays - bDays;
      return a.play.title.localeCompare(b.play.title, 'ru');
    });
}

export function getTheaterReadinessStats(state: AppState): {
  readyCount: number;
  totalCount: number;
  readyPercent: number;
} {
  const plays = getTheaterPlays(state);
  let readyCount = 0;
  let totalCount = 0;
  for (const play of plays) {
    const report = buildPlayReadinessReport(state, play.id);
    readyCount += report.readyCount;
    totalCount += report.totalCount;
  }
  return {
    readyCount,
    totalCount,
    readyPercent: totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0,
  };
}

export function getScheduleUrgencyHint(alerts: PremiereAlert[]): string | null {
  const urgent = alerts.find((alert) => alert.severity === 'red' && !alert.hasUpcomingRehearsals);
  if (urgent) {
    return `${formatUpcomingPerformanceCountdown(urgent.playTitle, urgent.performance, urgent.daysLeft)} — репетиций нет`;
  }
  const any = alerts.find((alert) => !alert.hasUpcomingRehearsals);
  if (any) {
    return `Запланируйте репетицию для «${any.playTitle}»`;
  }
  return null;
}
