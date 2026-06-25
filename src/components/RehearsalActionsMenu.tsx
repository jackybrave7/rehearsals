import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarPlus, Download, MoreVertical, Pencil, Send, Trash2 } from 'lucide-react';
import type { Rehearsal } from '../types';
import { downloadRehearsalIcs, openGoogleCalendar } from '../utils/rehearsalCalendar';

interface RehearsalActionsMenuProps {
  rehearsal: Rehearsal;
  title: string;
  location?: string;
  onTelegram?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
        danger
          ? 'text-red-300 hover:bg-red-500/10'
          : 'text-foreground/90 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      {label}
    </button>
  );
}

export function RehearsalActionsMenu({
  rehearsal,
  title,
  location,
  onTelegram,
  onEdit,
  onDelete,
}: RehearsalActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const closeAnd = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const iconButtonClass =
    'inline-flex items-center justify-center rounded-lg border border-gold/20 p-2 text-muted transition-colors hover:border-gold/35 hover:bg-white/5 hover:text-gold-light';

  return (
    <div className="flex shrink-0 items-center gap-1" ref={rootRef}>
      {onEdit ? (
        <button
          type="button"
          aria-label="Редактировать репетицию"
          title="Редактировать"
          onClick={() => {
            setOpen(false);
            onEdit();
          }}
          className={iconButtonClass}
        >
          <Pencil size={18} />
        </button>
      ) : null}

      <div className="relative">
        <button
          type="button"
          aria-label="Действия с репетицией"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
          className={iconButtonClass}
        >
          <MoreVertical size={18} />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-30 mt-1 min-w-[11.5rem] overflow-hidden rounded-xl border border-gold/15 bg-surface py-1 shadow-lg shadow-black/30"
          >
            <MenuItem
              icon={<CalendarPlus size={16} />}
              label="Google Календарь"
              onClick={closeAnd(() => openGoogleCalendar(rehearsal, title, location))}
            />
            <MenuItem
              icon={<Download size={16} />}
              label="Файл .ics"
              onClick={closeAnd(() => downloadRehearsalIcs(rehearsal, title, location))}
            />
            {onTelegram ? (
              <MenuItem
                icon={<Send size={16} />}
                label="Telegram"
                onClick={closeAnd(onTelegram)}
              />
            ) : null}
            {onDelete ? (
              <>
                <div className="my-1 border-t border-gold/10" />
                <MenuItem
                  icon={<Trash2 size={16} />}
                  label="Удалить"
                  onClick={closeAnd(onDelete)}
                  danger
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
