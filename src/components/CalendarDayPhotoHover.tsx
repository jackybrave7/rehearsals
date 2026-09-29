interface CalendarDayPhotoHoverProps {
  photos: string[];
}

export function CalendarDayPhotoHover({ photos }: CalendarDayPhotoHoverProps) {
  const preview = photos.slice(0, 3);
  if (preview.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-max max-w-none -translate-x-1/2 group-hover/day:flex"
      role="presentation"
    >
      <div className="flex shrink-0 gap-0.5 rounded-lg border border-gold/20 bg-surface/95 p-0.5 shadow-lg backdrop-blur-sm">
        {preview.map((url) => (
          <img
            key={url}
            src={url}
            alt=""
            className="size-9 shrink-0 rounded-sm object-cover"
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}
