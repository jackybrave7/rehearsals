import {
  getEmbeddableVideoFromStoredUrl,
  isOutcomeVideoFileUrl,
} from '../../shared/outcomeVideoEmbed';

interface OutcomeVideoPlayerProps {
  url: string;
  className?: string;
  title?: string;
}

export function OutcomeVideoPlayer({ url, className = '', title }: OutcomeVideoPlayerProps) {
  const embed = getEmbeddableVideoFromStoredUrl(url);

  if (embed) {
    return (
      <iframe
        src={embed.embedUrl}
        title={title ?? embed.provider}
        className={`aspect-video w-full rounded-xl border-0 bg-black ${className}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  if (isOutcomeVideoFileUrl(url)) {
    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={`max-h-full max-w-full rounded-xl ${className}`}
      >
        {title}
      </video>
    );
  }

  return (
    <p className="text-sm text-muted">
      Не удалось воспроизвести видео.{' '}
      <a href={url} target="_blank" rel="noreferrer" className="text-gold underline">
        Открыть ссылку
      </a>
    </p>
  );
}
