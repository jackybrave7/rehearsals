import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import type { Task, TaskPriority } from '../types';

export const DEFAULT_TASK_PRIORITY: TaskPriority = 'medium';

export function normalizeTask(task: Task): Task {
  return {
    ...task,
    priority: task.priority ?? DEFAULT_TASK_PRIORITY,
  };
}

export function isTaskOverdue(task: Task, today = startOfDay(new Date())): boolean {
  if (task.completed || !task.dueDate) return false;
  return parseISO(task.dueDate) < today;
}

export function isTaskDueSoon(task: Task, days = 3, today = startOfDay(new Date())): boolean {
  if (task.completed || !task.dueDate) return false;
  const due = parseISO(task.dueDate);
  if (due < today) return false;
  return differenceInCalendarDays(due, today) <= days;
}

export function isTaskDueThisWeek(task: Task, today = startOfDay(new Date())): boolean {
  if (task.completed || !task.dueDate) return false;
  const due = parseISO(task.dueDate);
  const diff = differenceInCalendarDays(due, today);
  return diff >= 0 && diff <= 6;
}

export function countOpenTasksByPlay(tasks: Task[], playId: string): number {
  return tasks.filter((task) => !task.completed && task.playId === playId).length;
}

export function getOverdueTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => isTaskOverdue(task));
}

export function getTasksByPlay(tasks: Task[], playId: string): Task[] {
  return tasks.filter((task) => task.playId === playId);
}

export type TaskSection = 'overdue' | 'thisWeek' | 'open' | 'done';

const priorityOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

function sortOpenTasks(a: Task, b: Task): number {
  const pa = priorityOrder[a.priority ?? DEFAULT_TASK_PRIORITY];
  const pb = priorityOrder[b.priority ?? DEFAULT_TASK_PRIORITY];
  if (pa !== pb) return pa - pb;
  const da = a.dueDate ?? '9999-12-31';
  const db = b.dueDate ?? '9999-12-31';
  return da.localeCompare(db) || a.title.localeCompare(b.title, 'ru');
}

export function groupTasksForDisplay(tasks: Task[]): Record<TaskSection, Task[]> {
  const overdue: Task[] = [];
  const thisWeek: Task[] = [];
  const open: Task[] = [];
  const done: Task[] = [];

  for (const task of tasks.map(normalizeTask)) {
    if (task.completed) {
      done.push(task);
      continue;
    }
    if (isTaskOverdue(task)) {
      overdue.push(task);
    } else if (isTaskDueThisWeek(task)) {
      thisWeek.push(task);
    } else {
      open.push(task);
    }
  }

  overdue.sort(sortOpenTasks);
  thisWeek.sort(sortOpenTasks);
  open.sort(sortOpenTasks);
  done.sort(
    (a, b) =>
      (b.dueDate ?? '').localeCompare(a.dueDate ?? '') || a.title.localeCompare(b.title, 'ru')
  );

  return { overdue, thisWeek, open, done };
}

export const priorityLabels: Record<TaskPriority, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};
