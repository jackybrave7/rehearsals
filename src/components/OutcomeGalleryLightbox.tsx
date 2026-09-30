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

  const content = (
    <div
      className="fixed inset-0 z-[200] bg-black/90"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Медиа строго по центру viewport */}
      <div
        className="absolute inset-0 flex items-center justify-center px-14 py-16 sm:px-20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex max-h-full max-w-full items-center justify-center">
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

      <button
        type="button"
        className="absolute right-3 top-3 z-10 rounded-full bg-black/70 p-2.5 text-white hover:bg-black sm:right-4 sm:top-4"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Закрыть"
      >
        <X size={22} />
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white hover:bg-black sm:left-3"
            onClick={(event) => {
              event.stopPropagation();
              showPrev();
            }}
            aria-label="Предыдущее"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white hover:bg-black sm:right-3"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            aria-label="Следующее"
          >
            <ChevronRight size={26} />
          </button>
        </>
      )}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-4 pb-4 pt-8"
        onClick={(event) => event.stopPropagation()}
      >
        {footer && <div className="pointer-events-auto">{footer}</div>}
        <p className="rounded-full bg-black/70 px-3 py-1 text-xs text-white/90">
          {index + 1} / {items.length}
          {item.kind === 'video' ? ' · видео' : ' · фото'}
        </p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
