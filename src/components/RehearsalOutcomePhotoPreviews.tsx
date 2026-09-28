import { useState } from 'react';
import { OutcomePhotoLightbox } from './OutcomePhotoLightbox';

interface RehearsalOutcomePhotoPreviewsProps {
  photos: string[];
  maxVisible?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function RehearsalOutcomePhotoPreviews({
  photos,
  maxVisible = 4,
  size = 'md',
  className = '',
}: RehearsalOutcomePhotoPreviewsProps) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const visible = photos.slice(0, maxVisible);
  const hiddenCount = photos.length - visible.length;
  const thumbClass =
    size === 'sm' ? 'h-10 w-14 object-cover' : 'h-14 w-20 object-cover sm:h-16 sm:w-24';

  return (
    <>
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
        {visible.map((url, index) => (
          <button
            key={url}
            type="button"
            className="overflow-hidden rounded-md border border-gold/15 bg-black/20 transition hover:border-gold/35"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setViewerIndex(index);
            }}
          >
            <img
              src={url}
              alt={`Фото ${index + 1}`}
              className={thumbClass}
              loading="lazy"
            />
          </button>
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            className="rounded-md border border-gold/15 bg-gold/10 px-2 py-1 text-xs text-gold-light hover:bg-gold/15"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setViewerIndex(maxVisible);
            }}
          >
            +{hiddenCount}
          </button>
        )}
      </div>

      {viewerIndex !== null && (
        <OutcomePhotoLightbox
          photos={photos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </>
  );
}
