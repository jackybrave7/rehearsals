import { Film, Play } from 'lucide-react';
import { isOutcomeVideoFileUrl, outcomeVideoThumbnailUrl } from '../../shared/outcomeVideoEmbed';

interface OutcomeVideoThumbnailProps {
  url: string;
  className?: string;
}

/** Превью: обложка хостинга или первый кадр файла с S3. */
export function OutcomeVideoThumbnail({ url, className = '' }: OutcomeVideoThumbnailProps) {
  const embedThumb = outcomeVideoThumbnailUrl(url);
  const isFile = isOutcomeVideoFileUrl(url);

  return (
    <span className={`relative block overflow-hidden bg-black/40 ${className}`}>
      {embedThumb ? (
        <img src={embedThumb} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : isFile ? (
        <video
          src={`${url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover pointer-events-none"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted">
          <Film size={28} />
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
        <Play size={24} className="text-white" fill="currentColor" />
      </span>
    </span>
  );
}
