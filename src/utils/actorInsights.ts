import { differenceInCalendarDays, isAfter, parseISO, startOfDay } from 'date-fns';
import type { AppState, AttendanceStatus, PlayRole, Rehearsal } from '../types';
import { getActorAssignments } from '../store/selectors';

export interface ActorRoleInPlay {
  playId: string;
  playTitle: string;
  performanceName: string;
  roleName: string;
  roleKind: PlayRole['kind'];
}

export interface ActorAttendanceStats {
  present: number;
  late: number;
  absent: number;
  substitute: number;
  total: number;
  ratePercent: number;
}

export interface ActorWorkload {
  rolesByPlay: ActorRoleInPlay[];
  attendance: ActorAttendanceStats;
  lastRehearsedAt?: string;
  upcomingRehearsals: Rehearsal[];
  daysSinceLastRehearsal: number | null;
  staleRehearsal: boolean;
}

function resolveAttendanceStatus(
  rehearsal: Rehearsal,
  actorId: string
): AttendanceStatus | undefined {
  if (!rehearsal.actorIds.includes(actorId)) return undefined;
  return rehearsal.attendance?.[actorId] ?? 'present';
}

export function getActorWorkload(
  state: AppState,
  actorId: string,
  today = startOfDay(new Date())
): ActorWorkload {
  const actor = state.actors.find((item) => item.id === actorId);
  const staleDays = state.appMeta?.staleSceneDays ?? 21;
  const rolesByPlay: ActorRoleInPlay[] = [];

  for (const assignment of getActorAssignments(state, actorId)) {
    const role = state.playRoles.find((item) => item.id === assignment.roleId);
    const performance = state.performances.find((item) => item.id === assignment.performanceId);
    const play = state.plays.find((item) => item.id === assignment.playId);
    if (!role || !play) continue;
    rolesByPlay.push({
      playId: play.id,
      playTitle: play.title,
      performanceName: performance?.name ?? 'Показ',
      roleName: role.name,
      roleKind: role.kind,
    });
  }

  const theaterRehearsals = state.rehearsals.filter(
    (rehearsal) =>
      (!actor?.theaterId || rehearsal.theaterId === actor.theaterId) &&
      (rehearsal.actorIds.includes(actorId) ||
        Object.prototype.hasOwnProperty.call(rehearsal.attendance ?? {}, actorId))
  );

  const stats: ActorAttendanceStats = {
    present: 0,
    late: 0,
    absent: 0,
    substitute: 0,
    total: 0,
    ratePercent: 0,
  };

  let lastRehearsedAt: string | undefined;

  for (const rehearsal of theaterRehearsals) {
    const rehearsalDay = parseISO(rehearsal.date);
    if (isAfter(rehearsalDay, today)) continue;

    const status = resolveAttendanceStatus(rehearsal, actorId);
    if (!status) continue;

    stats.total += 1;
    stats[status] += 1;

    if (!lastRehearsedAt || rehearsal.date > lastRehearsedAt) {
      lastRehearsedAt = rehearsal.date;
    }
  }

  if (stats.total > 0) {
    stats.ratePercent = Math.round((stats.present / stats.total) * 100);
  }

  const upcomingRehearsals = theaterRehearsals
    .filter(
      (rehearsal) =>
        !isAfter(today, parseISO(rehearsal.date)) && rehearsal.actorIds.includes(actorId)
    )
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)
    );

  const daysSinceLastRehearsal = lastRehearsedAt
    ? differenceInCalendarDays(today, parseISO(lastRehearsedAt))
    : null;

  return {
    rolesByPlay,
    attendance: stats,
    lastRehearsedAt,
    upcomingRehearsals,
    daysSinceLastRehearsal,
    staleRehearsal:
      daysSinceLastRehearsal !== null ? daysSinceLastRehearsal > staleDays : false,
  };
}

export function getActorMiniBadges(
  state: AppState,
  actorId: string,
  today = startOfDay(new Date())
): { attendancePercent?: number; staleLabel?: string } {
  const workload = getActorWorkload(state, actorId, today);
  const badges: { attendancePercent?: number; staleLabel?: string } = {};

  if (workload.attendance.total > 0) {
    badges.attendancePercent = workload.attendance.ratePercent;
  }
  if (workload.staleRehearsal) {
    badges.staleLabel = 'давно не репетировал(а)';
  }

  return badges;
}

export function groupRolesByPlay(roles: ActorRoleInPlay[]) {
  const map = new Map<string, { playTitle: string; roles: ActorRoleInPlay[] }>();
  for (const role of roles) {
    const entry = map.get(role.playId) ?? { playTitle: role.playTitle, roles: [] };
    entry.roles.push(role);
    map.set(role.playId, entry);
  }
  return Array.from(map.entries()).map(([playId, value]) => ({ playId, ...value }));
}
