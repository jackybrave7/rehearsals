import { useEffect, useMemo, useState } from 'react';
import { Film, Play } from 'lucide-react';
import {
  isOutcomeVideoFileUrl,
  outcomeVideoThumbnailCandidates,
} from '../../shared/outcomeVideoEmbed';

interface OutcomeVideoThumbnailProps {
  url: string;
  className?: string;
}

/** Превью: обложка хостинга или первый кадр файла с S3. */
export function OutcomeVideoThumbnail({ url, className = '' }: OutcomeVideoThumbnailProps) {
  const candidates = useMemo(() => outcomeVideoThumbnailCandidates(url), [url]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const embedThumb = candidates[candidateIndex] ?? null;

  useEffect(() => {
    setCandidateIndex(0);
  }, [url]);
  const isFile = isOutcomeVideoFileUrl(url);

  const onThumbError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((index) => index + 1);
    }
  };

  return (
    <span className={`relative block overflow-hidden bg-zinc-800 ${className}`}>
      {embedThumb ? (
        <img
          key={embedThumb}
          src={embedThumb}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={onThumbError}
        />
      ) : isFile ? (
        <video
          src={`${url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-muted">
          <Film size={28} className="text-white/50" strokeWidth={1.5} />
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/30">
          <Play size={18} className="ml-0.5 text-white" fill="#ffffff" strokeWidth={0} />
        </span>
      </span>
    </span>
  );
}