import type { MemorizationStatus } from '../types';
import { memorizationShortLabels, memorizationStatusColors } from '../utils/memorization';

type MemorizationStatusBadgeProps = {
  status: MemorizationStatus;
  variant?: 'theater' | 'zen';
  className?: string;
};

export function MemorizationStatusBadge({
  status,
  variant = 'theater',
  className = '',
}: MemorizationStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-medium ${memorizationStatusColors(status, variant)} ${className}`}
    >
      {memorizationShortLabels[status]}
    </span>
  );
}
