import type { Play } from '../../types';
import { PlayIcon } from '../PlayIcon';

export function PlayMiniIcon({
  play,
  size = 'md',
  className = '',
}: {
  play: Pick<Play, 'title' | 'iconUrl' | 'iconColor'>;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return <PlayIcon play={play} size={size} className={className} />;
}
