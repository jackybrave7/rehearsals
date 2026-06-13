import type { SceneStatus } from '../types';

export const sceneStatusLabels: Record<SceneStatus, string> = {
  not_started: 'Не начата',
  in_progress: 'В работе',
  ready: 'Готова',
};

export const sceneStatusColors: Record<SceneStatus, string> = {
  not_started: 'bg-gray-500/20 text-gray-300',
  in_progress: 'bg-amber-500/20 text-amber-300',
  ready: 'bg-emerald-500/20 text-emerald-300',
};

interface SceneStatusBadgeProps {
  status: SceneStatus;
  className?: string;
}

export function SceneStatusBadge({ status, className = '' }: SceneStatusBadgeProps) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${sceneStatusColors[status]} ${className}`}
    >
      {sceneStatusLabels[status]}
    </span>
  );
}
