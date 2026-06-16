import type { AppState } from '../types';
import { getActorAssignments } from '../store/selectors';

export function getActorDeletionImpact(state: AppState, actorId: string) {
  const assignments = getActorAssignments(state, actorId).length;
  const rehearsals = state.rehearsals.filter(
    (rehearsal) =>
      rehearsal.actorIds.includes(actorId) ||
      Object.prototype.hasOwnProperty.call(rehearsal.attendance ?? {}, actorId)
  ).length;
  const tasks = state.tasks.filter((task) => task.assignedActorIds.includes(actorId)).length;

  return { assignments, rehearsals, tasks };
}

export function formatActorDeletionImpactMessage(impact: ReturnType<typeof getActorDeletionImpact>): string {
  const parts: string[] = [];
  if (impact.assignments > 0) {
    parts.push(
      `${impact.assignments} ${impact.assignments === 1 ? 'назначение' : impact.assignments < 5 ? 'назначения' : 'назначений'} в постановках`
    );
  }
  if (impact.rehearsals > 0) {
    parts.push(
      `${impact.rehearsals} ${impact.rehearsals === 1 ? 'репетиция' : impact.rehearsals < 5 ? 'репетиции' : 'репетиций'}`
    );
  }
  if (impact.tasks > 0) {
    parts.push(
      `${impact.tasks} ${impact.tasks === 1 ? 'задача' : impact.tasks < 5 ? 'задачи' : 'задач'}`
    );
  }
  if (parts.length === 0) {
    return 'Участник не привязан к ролям и репетициям.';
  }
  return `Будут затронуты: ${parts.join(', ')}. Рекомендуем перевести в архив вместо удаления.`;
}
