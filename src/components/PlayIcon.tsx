import type { Play } from '../types';
import { resolveAssetUrl } from '../utils/fileUrls';
import { resolvePlayIconColor, resolvePlayInitial } from '../utils/playIcon';

type PlayIconProps = {
  play: Pick<Play, 'title' | 'iconUrl' | 'iconColor'>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  xs: 'h-2.5 w-2.5 text-[7px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

export { resolvePlayIconColor, resolvePlayInitial } from '../utils/playIcon';

export function PlayIcon({ play, size = 'md', className = '' }: PlayIconProps) {
  const sizeClass = sizeClasses[size];

  if (play.iconUrl?.trim()) {
    const src = resolveAssetUrl(play.iconUrl.trim());
    if (src) {
      return (
        <img
          src={src}
          alt=""
          className={`shrink-0 rounded-full object-cover ${sizeClass} ${className}`}
        />
      );
    }
  }

  const bg = resolvePlayIconColor(play);
  const initial = resolvePlayInitial(play.title);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${sizeClass} ${className}`}
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {initial}
    </span>
  );
}
