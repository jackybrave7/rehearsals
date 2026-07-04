import { useEffect, useState } from 'react';
import { RotateCcw, X, ZoomIn } from 'lucide-react';
import { useDesign } from '../../store/DesignContext';
import { Modal } from '../Modal';

interface GuideMediaProps {
  kind: 'screen' | 'gif';
  description: string;
  slug: string;
}

function mediaPath(slug: string, isZen: boolean, ext: 'png' | 'gif') {
  const suffix = isZen ? '-zen' : '';
  return `/guide/v2/${slug}${suffix}.${ext}`;
}

export function GuideMedia({ kind, description, slug }: GuideMediaProps) {
  const { isZen } = useDesign();
  const ext = kind === 'gif' ? 'gif' : 'png';
  const primarySrc = mediaPath(slug, isZen, ext);
  const fallbackSrc = isZen ? mediaPath(slug, false, ext) : null;
  const [src, setSrc] = useState(primarySrc);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setSrc(primarySrc);
    setLoaded(false);
    setFailed(false);
  }, [primarySrc]);

  const frameClass = `relative mx-auto w-full max-w-[720px] overflow-hidden rounded-xl border ${
    isZen ? 'border-border/60 bg-white shadow-sm' : 'border-gold/15 bg-black/30'
  }`;

  const placeholderMessage = failed
    ? 'Скриншот недоступен'
    : 'Изображение загружается';

  const placeholder = (
    <div
      className={`flex min-h-[180px] flex-col items-center justify-center gap-2 px-6 py-10 text-center text-muted`}
    >
      <span className="text-xs font-medium uppercase tracking-wide opacity-80">
        {kind === 'gif' ? 'GIF' : 'Скриншот'}
      </span>
      <p className="text-sm leading-relaxed">{description}</p>
      <p className="text-xs opacity-70">{placeholderMessage}</p>
    </div>
  );

  const mediaContent =
    kind === 'gif' ? (
      <div className="relative">
        <img
          src={src}
          alt={description}
          loading="lazy"
          decoding="async"
          className="block max-h-[480px] w-full object-contain"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (fallbackSrc && src !== fallbackSrc) {
              setSrc(fallbackSrc);
              return;
            }
            setFailed(true);
          }}
        />
        <button
          type="button"
          onClick={() => {
            const img = document.querySelector<HTMLImageElement>(`img[src="${CSS.escape(src)}"]`);
            if (img) {
              const url = img.src;
              img.src = '';
              img.src = url;
            }
          }}
          className={`absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
            isZen
              ? 'border border-border/60 bg-white/90 text-foreground'
              : 'border border-gold/20 bg-black/70 text-gold-light'
          }`}
        >
          <RotateCcw size={14} />
          Повтор
        </button>
      </div>
    ) : (
      <img
        src={src}
        alt={description}
        loading="lazy"
        decoding="async"
        className="block max-h-[480px] w-full object-contain"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (fallbackSrc && src !== fallbackSrc) {
            setSrc(fallbackSrc);
            return;
          }
          setFailed(true);
        }}
      />
    );

  return (
    <figure className="my-4">
      <button
        type="button"
        onClick={() => !failed && setLightboxOpen(true)}
        className={`${frameClass} group cursor-zoom-in text-left`}
        aria-label={`Увеличить: ${description}`}
        disabled={failed}
      >
        {failed || !loaded ? placeholder : null}
        <div className={failed ? 'hidden' : loaded ? 'block' : 'sr-only'}>{mediaContent}</div>
        {loaded && !failed && (
          <span
            className={`pointer-events-none absolute right-3 top-3 rounded-full p-1.5 opacity-0 transition-opacity group-hover:opacity-100 ${
              isZen ? 'bg-white/90 text-foreground' : 'bg-black/60 text-gold-light'
            }`}
          >
            <ZoomIn size={16} />
          </span>
        )}
      </button>
      <figcaption className="mt-2 text-center text-xs text-muted">{description}</figcaption>

      <Modal open={lightboxOpen} onClose={() => setLightboxOpen(false)} title={description}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-0 top-0 rounded-lg p-2 text-muted hover:text-foreground"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
          <div
            className={`mt-6 overflow-hidden rounded-xl border ${
              isZen ? 'border-border/60 bg-white' : 'border-gold/15 bg-black/40'
            }`}
          >
            <img src={src} alt={description} className="max-h-[70vh] w-full object-contain" />
          </div>
        </div>
      </Modal>
    </figure>
  );
}
