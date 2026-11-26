import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GalleryMediaEntry } from '../utils/rehearsalOutcomeGallery';
import { OutcomeVideoPlayer } from './OutcomeVideoPlayer';

interface OutcomeGalleryLightboxProps {
  items: GalleryMediaEntry[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  footer?: ReactNode;
}

export function OutcomeGalleryLightbox({
  items,
  index,
  onClose,
  onIndexChange,
  footer,
}: OutcomeGalleryLightboxProps) {
  const item = items[index];
  if (!item) return null;

  const showPrev = () => onIndexChange((index - 1 + items.length) % items.length);
  const showNext = () => onIndexChange((index + 1) % items.length);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (items.length <= 1) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrev();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, items.length, onClose]);

  const chromeBtn =
    'pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/80 text-white shadow-lg backdrop-blur-sm transition hover:bg-black';

  const content = (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/90"
        aria-label="Закрыть просмотр"
        onClick={onClose}
      />

      <div
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-14 py-16 sm:px-20"
      >
        <div
          className="pointer-events-auto flex max-h-full max-w-full items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          {item.kind === 'photo' ? (
            <img
              src={item.url}
              alt={`Фото репетиции ${index + 1}`}
              className="max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-4rem)] rounded-xl object-contain"
            />
          ) : (
            <OutcomeVideoPlayer url={item.url} variant="lightbox" title={`Видео ${index + 1}`} />
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <button
          type="button"
          className={`${chromeBtn} absolute right-3 top-3 sm:right-4 sm:top-4`}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Закрыть"
        >
          <X size={22} color="#ffffff" strokeWidth={2.25} />
        </button>

        {items.length > 1 && (
          <>
            <button
              type="button"
              className={`${chromeBtn} absolute left-2 top-1/2 -translate-y-1/2 sm:left-4`}
              onClick={(event) => {
                event.stopPropagation();
                showPrev();
              }}
              aria-label="Предыдущее"
            >
              <ChevronLeft size={26} color="#ffffff" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className={`${chromeBtn} absolute right-2 top-1/2 -translate-y-1/2 sm:right-4`}
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              aria-label="Следующее"
            >
              <ChevronRight size={26} color="#ffffff" strokeWidth={2.25} />
            </button>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-4 pt-8">
          {footer && <div className="pointer-events-auto">{footer}</div>}
          <p className="rounded-full border border-white/20 bg-black/80 px-3 py-1 text-xs text-white shadow-lg backdrop-blur-sm">
            {index + 1} / {items.length}
            {item.kind === 'video' ? ' · видео' : ' · фото'}
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
