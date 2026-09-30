import {
  getEmbeddableVideoFromStoredUrl,
  isOutcomeVideoFileUrl,
} from '../../shared/outcomeVideoEmbed';

/** Высота/ширина медиа в lightbox (с учётом оверлея кнопок). */
export const LIGHTBOX_MEDIA_MAX_HEIGHT = 'calc(100dvh - 8rem)';
export const LIGHTBOX_MEDIA_MAX_WIDTH = 'calc(100vw - 4rem)';

interface OutcomeVideoPlayerProps {
  url: string;
  className?: string;
  title?: string;
  /** inline — в карточке; lightbox — в поп-апе, вписывается в экран (в т.ч. вертикальное). */
  variant?: 'inline' | 'lightbox';
}

export function OutcomeVideoPlayer({
  url,
  className = '',
  title,
  variant = 'inline',
}: OutcomeVideoPlayerProps) {
  const embed = getEmbeddableVideoFromStoredUrl(url);
  const isLightbox = variant === 'lightbox';

  if (embed) {
    if (isLightbox) {
      return (
        <div
          className={`relative mx-auto shrink-0 overflow-hidden rounded-xl bg-black ${className}`}
          style={{
            width: `min(${LIGHTBOX_MEDIA_MAX_WIDTH}, calc(${LIGHTBOX_MEDIA_MAX_HEIGHT} * 16 / 9))`,
            height: `min(calc(${LIGHTBOX_MEDIA_MAX_WIDTH} * 9 / 16), ${LIGHTBOX_MEDIA_MAX_HEIGHT})`,
          }}
        >
          <iframe
            src={embed.embedUrl}
            title={title ?? embed.provider}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      );
    }

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
    if (isLightbox) {
      return (
        <div className="flex max-h-full max-w-full items-center justify-center">
          <video
            src={url}
            controls
            controlsList="nodownload"
            playsInline
            preload="metadata"
            className={`block shrink-0 rounded-xl object-contain ${className}`}
            style={{
              maxHeight: LIGHTBOX_MEDIA_MAX_HEIGHT,
              maxWidth: LIGHTBOX_MEDIA_MAX_WIDTH,
            }}
          >
            {title}
          </video>
        </div>
      );
    }

    return (
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className={`max-h-64 w-full rounded-lg border border-gold/15 bg-black/30 ${className}`}
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
