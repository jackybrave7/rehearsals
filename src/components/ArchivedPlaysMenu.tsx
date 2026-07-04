import { useEffect, useRef, useState } from 'react';
import { Archive, MoreVertical } from 'lucide-react';
import type { Play } from '../types';
import { PlayIcon } from './PlayIcon';

type ArchivedPlaysMenuProps = {
  plays: Play[];
  selectedPlayId: string | null;
  onSelect: (playId: string) => void;
};

export function ArchivedPlaysMenu({ plays, selectedPlayId, onSelect }: ArchivedPlaysMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event: Event) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('touchstart', onDocumentClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('touchstart', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  if (plays.length === 0) return null;

  const viewingArchived = selectedPlayId !== null && plays.some((play) => play.id === selectedPlayId);

  return (
    <div className="relative ml-auto shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-label="Архивные постановки"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors ${
          viewingArchived
            ? 'bg-gold/15 text-gold-light'
            : 'text-muted hover:bg-white/5 hover:text-white'
        }`}
      >
        <MoreVertical size={18} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[14rem] overflow-hidden rounded-xl border border-gold/15 bg-surface py-1 shadow-lg shadow-black/30"
        >
          <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted">
            Архив
          </p>
          {plays.map((play) => (
            <button
              key={play.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(play.id);
              }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                selectedPlayId === play.id
                  ? 'bg-gold/10 text-gold-light'
                  : 'text-foreground/90 hover:bg-white/5 hover:text-white'
              }`}
            >
              <PlayIcon play={play} size="sm" />
              <span className="min-w-0 flex-1 truncate">«{play.title}»</span>
              <Archive size={14} className="shrink-0 opacity-50" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
