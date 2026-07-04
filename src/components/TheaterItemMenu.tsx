import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

export type TheaterMenuAction = {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type TheaterItemMenuProps = {
  actions: TheaterMenuAction[];
  variant: 'zen' | 'sidebar';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const LONG_PRESS_MS = 500;

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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

export function useTheaterRowLongPress(onLongPress: () => void, enabled = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressHandledRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlers = {
    onTouchStart: () => {
      if (!enabled) return;
      longPressHandledRef.current = false;
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        longPressHandledRef.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onTouchMove: clearTimer,
    onTouchEnd: clearTimer,
    onTouchCancel: clearTimer,
    consumeLongPress: () => {
      if (!longPressHandledRef.current) return false;
      longPressHandledRef.current = false;
      return true;
    },
  };

  return handlers;
}

export function TheaterItemMenu({ actions, variant, open: controlledOpen, onOpenChange }: TheaterItemMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
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
    document.addEventListener('touchstart', onDocumentClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('touchstart', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open, setOpen]);

  const closeAnd = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const visibleActions = actions.filter((action) => !action.disabled);
  if (visibleActions.length === 0) return null;

  const triggerClass =
    variant === 'zen'
      ? 'inline-flex shrink-0 items-center justify-center rounded-xl p-2 text-muted transition-colors hover:bg-black/[0.04] hover:text-foreground'
      : 'inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-white';

  const panelClass =
    variant === 'zen'
      ? 'absolute right-0 top-full z-30 mt-1 min-w-[11.5rem] overflow-hidden rounded-xl border border-border/80 bg-surface py-1 shadow-lg shadow-black/10'
      : 'absolute right-0 top-full z-30 mt-1 min-w-[11.5rem] overflow-hidden rounded-xl border border-gold/15 bg-surface py-1 shadow-lg shadow-black/30';

  const dangerActions = visibleActions.filter((action) => action.danger);
  const regularActions = visibleActions.filter((action) => !action.danger);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        aria-label="Действия с театром"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(!open);
        }}
        className={triggerClass}
      >
        <MoreVertical size={variant === 'zen' ? 18 : 16} />
      </button>

      {open ? (
        <div role="menu" className={panelClass}>
          {regularActions.map((action) => (
            <MenuItem
              key={action.id}
              icon={action.icon}
              label={action.label}
              onClick={closeAnd(action.onClick)}
              disabled={action.disabled}
            />
          ))}
          {dangerActions.length > 0 && regularActions.length > 0 ? (
            <div className="my-1 border-t border-gold/10" />
          ) : null}
          {dangerActions.map((action) => (
            <MenuItem
              key={action.id}
              icon={action.icon}
              label={action.label}
              onClick={closeAnd(action.onClick)}
              danger
              disabled={action.disabled}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
