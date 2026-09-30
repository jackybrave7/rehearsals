import { useEffect, type ReactNode } from 'react';
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

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85" onClick={onClose}>
      <button
        type="button"
        className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Закрыть"
      >
        <X size={20} />
      </button>

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 sm:left-4"
            onClick={(event) => {
              event.stopPropagation();
              showPrev();
            }}
            aria-label="Предыдущее"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 sm:right-4"
            onClick={(event) => {
              event.stopPropagation();
              showNext();
            }}
            aria-label="Следующее"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4 pb-2"
        onClick={(event) => event.stopPropagation()}
      >
        {item.kind === 'photo' ? (
          <img
            src={item.url}
            alt={`Фото репетиции ${index + 1}`}
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        ) : (
          <div className="w-full max-w-4xl">
            <OutcomeVideoPlayer url={item.url} title={`Видео репетиции ${index + 1}`} />
          </div>
        )}
      </div>

      <div
        className="flex shrink-0 flex-col items-center gap-3 px-4 pb-4 pt-2"
        onClick={(event) => event.stopPropagation()}
      >
        {footer}
        <p className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/90">
          {index + 1} / {items.length}
          {item.kind === 'video' ? ' · видео' : ' · фото'}
        </p>
      </div>
    </div>
  );
}
