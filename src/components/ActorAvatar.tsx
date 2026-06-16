import { User } from 'lucide-react';
import { resolveAssetUrl } from '../utils/fileUrls';

interface ActorAvatarProps {
  name: string;
  photoUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  archived?: boolean;
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-16 w-16',
  lg: 'h-20 w-20',
};

const iconSizes = {
  sm: 14,
  md: 28,
  lg: 32,
};

export function ActorAvatar({ name, photoUrl, size = 'md', archived }: ActorAvatarProps) {
  const boxClass = `${sizes[size]} shrink-0 ${size === 'sm' ? 'rounded-full' : 'rounded-xl'} object-cover ${archived ? 'grayscale' : ''}`;
  const src = resolveAssetUrl(photoUrl);

  if (src) {
    return <img src={src} alt={name} className={boxClass} loading="lazy" />;
  }

  return (
    <div
      className={`flex ${sizes[size]} shrink-0 items-center justify-center ${size === 'sm' ? 'rounded-full' : 'rounded-xl'} bg-gold/10 text-gold`}
    >
      <User size={iconSizes[size]} />
    </div>
  );
}
